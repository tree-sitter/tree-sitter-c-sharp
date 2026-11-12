#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

#include <string.h>
#include <wctype.h>

enum TokenType {
    OPT_SEMI,
    INTERPOLATION_REGULAR_START,
    INTERPOLATION_VERBATIM_START,
    INTERPOLATION_RAW_START,
    INTERPOLATION_START_QUOTE,
    INTERPOLATION_END_QUOTE,
    INTERPOLATION_OPEN_BRACE,
    INTERPOLATION_CLOSE_BRACE,
    INTERPOLATION_STRING_CONTENT,
    RAW_STRING_START,
    RAW_STRING_END,
    RAW_STRING_CONTENT,
    LAMBDA_PAREN_OPEN,
    SKIPPED_TEXT_HAZARD,
    SKIPPED_TEXT_NEVER,
    PREPROC_TRAILING_TEXT,
    PREPROC_IF_OPEN,
    PREPROC_IF_CLOSE,
};

typedef enum {
    REGULAR = 1 << 0,
    VERBATIM = 1 << 1,
    RAW = 1 << 2,
} StringType;

typedef struct {
    uint8_t dollar_count;
    uint8_t open_brace_count;
    uint8_t quote_count;
    StringType string_type;
    // The `DirectiveLines` state of the string's verbatim or raw content, carried across its
    // content tokens: a hole splits the content, not the lines the compiler would scan.
    uint8_t directive_depth;
    bool directive_line_start;
} Interpolation;

static inline bool is_regular(Interpolation *interpolation) { return interpolation->string_type & REGULAR; }

static inline bool is_verbatim(Interpolation *interpolation) { return interpolation->string_type & VERBATIM; }

static inline bool is_raw(Interpolation *interpolation) { return interpolation->string_type & RAW; }

typedef struct {
    uint8_t quote_count;
    // How many `#if` blocks the scan position is inside, counted from the grammar's own `#if`
    // and `#endif` (`PREPROC_IF_OPEN`/`PREPROC_IF_CLOSE`), saturating at 255. At 0 no text can
    // be in a branch the compiler skips.
    uint8_t if_depth;
    Array(Interpolation) interpolation_stack;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

// ---- Helpers for LAMBDA_PAREN_OPEN scanning ---------------------------

static inline bool is_id_start(int32_t c) {
    return c == '_' || iswalpha(c);
}

static inline bool is_id_continue(int32_t c) {
    return c == '_' || iswalnum(c);
}

// Skip whitespace, line comments (//...), and block comments (/* ... */).
// Does NOT skip preprocessor directives — simple-lambda parameter lists
// cannot legally contain them.
static void skip_ws_and_comments(TSLexer *lexer) {
    for (;;) {
        int32_t c = lexer->lookahead;
        if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
            advance(lexer);
        } else if (c == '/') {
            advance(lexer);
            if (lexer->lookahead == '/') {
                while (lexer->lookahead != 0 && lexer->lookahead != '\n') {
                    advance(lexer);
                }
            } else if (lexer->lookahead == '*') {
                advance(lexer);
                int32_t prev = 0;
                while (lexer->lookahead != 0 &&
                       !(prev == '*' && lexer->lookahead == '/')) {
                    prev = lexer->lookahead;
                    advance(lexer);
                }
                if (lexer->lookahead == '/') advance(lexer);
            } else {
                // a stray '/' isn't valid in a param list; bail out by
                // making the caller see something unexpected
                return;
            }
        } else {
            return;
        }
    }
}

// Consume an identifier into a fixed-size buffer. Returns the actual
// length consumed (may exceed `max`, in which case `buf` is only filled
// up to `max` bytes — useful for "too long to be a keyword" detection).
static size_t consume_identifier_into(TSLexer *lexer, char *buf, size_t max) {
    size_t n = 0;
    while (is_id_continue(lexer->lookahead)) {
        if (n < max) {
            buf[n] = (char)lexer->lookahead;
        }
        n++;
        advance(lexer);
    }
    return n;
}

// True iff the first `n` bytes of `buf` equal the C string `kw`.
static bool buf_equals(const char *buf, size_t n, const char *kw) {
    size_t klen = strlen(kw);
    return n == klen && memcmp(buf, kw, klen) == 0;
}

// C# line terminators and the whitespace that may precede a directive's `#`.
static inline bool is_line_break(int32_t c) {
    return c == '\n' || c == '\r' || c == 0x85 || c == 0x2028 || c == 0x2029;
}

static inline bool is_line_space(int32_t c) {
    return c == ' ' || c == '\t' || c == '\v' || c == '\f' || c == 0xA0 || c == 0x1680 ||
           (c >= 0x2000 && c <= 0x200A) || c == 0x202F || c == 0x205F || c == 0x3000;
}

// The lines of a token that can span lines (a `/* */` comment, a verbatim or raw string, the
// content of an interpolated verbatim or raw string), checked for a conditional directive. In a
// branch the compiler skips, such a token is not a token at all: skipped text is only scanned for
// directives, so an `#else`, `#elif` or `#endif` line inside it ends the branch and what follows
// is code, and an `#if` it leaves open makes the branch run on past the `#endif` the tree pairs
// with it. The grammar cannot tell a skipped branch from an active one, so such a token has no
// single right tree when it starts inside an `#if` block (`if_depth` > 0). At depth 0 nothing is
// skipped and the token is what it looks like. `#if`/`#endif` pairs inside the token are
// balanced, as the compiler balances them in skipped text, so commented-out code holding a whole
// `#if` block is still one token anywhere.
typedef struct {
    unsigned depth;
    bool line_start;
} DirectiveLines;

// Called for every character of the token's body, before it is consumed. Consumes the leading
// whitespace of a line and a directive's `#` and name; returns true once a line ends a branch.
static bool directive_lines_step(TSLexer *lexer, DirectiveLines *lines, bool *consumed) {
    *consumed = false;
    int32_t c = lexer->lookahead;
    if (is_line_break(c)) {
        advance(lexer);
        lines->line_start = true;
        *consumed = true;
        return false;
    }
    if (!lines->line_start) return false;
    if (is_line_space(c)) {
        advance(lexer);
        *consumed = true;
        return false;
    }
    lines->line_start = false;
    if (c != '#') return false;
    advance(lexer);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
    char buf[6];
    size_t n = consume_identifier_into(lexer, buf, sizeof(buf));
    *consumed = true;
    if (buf_equals(buf, n, "if")) {
        lines->depth++;
    } else if (buf_equals(buf, n, "endif")) {
        if (lines->depth == 0) return true;
        lines->depth--;
    } else if (buf_equals(buf, n, "else") || buf_equals(buf, n, "elif")) {
        if (lines->depth == 0) return true;
    }
    return false;
}

// After `/*`. True if the comment holds a line that ends a branch, or leaves an `#if` open at its
// `*/`. False at EOF: an unclosed comment is the grammar's error already.
static bool block_comment_hides_directive(TSLexer *lexer) {
    DirectiveLines lines = {0, false};
    while (!lexer->eof(lexer)) {
        bool consumed;
        if (directive_lines_step(lexer, &lines, &consumed)) return true;
        if (consumed) continue;
        if (lexer->lookahead == '*') {
            advance(lexer);
            if (lexer->lookahead == '/') return lines.depth > 0;
            continue;
        }
        advance(lexer);
    }
    return false;
}

// After a verbatim string's opening `"`. True as for a comment.
static bool verbatim_string_hides_directive(TSLexer *lexer) {
    DirectiveLines lines = {0, false};
    while (!lexer->eof(lexer)) {
        bool consumed;
        if (directive_lines_step(lexer, &lines, &consumed)) return true;
        if (consumed) continue;
        if (lexer->lookahead == '"') {
            advance(lexer);
            if (lexer->lookahead != '"') return lines.depth > 0;
        }
        advance(lexer);
    }
    return false;
}

// After a raw string's opening run of `quotes` quotes. True as for a comment.
static bool raw_string_hides_directive(TSLexer *lexer, uint8_t quotes) {
    DirectiveLines lines = {0, false};
    while (!lexer->eof(lexer)) {
        bool consumed;
        if (directive_lines_step(lexer, &lines, &consumed)) return true;
        if (consumed) continue;
        if (lexer->lookahead == '"') {
            unsigned run = 0;
            while (lexer->lookahead == '"') {
                advance(lexer);
                run++;
            }
            if (run >= quotes) return lines.depth > 0;
            continue;
        }
        advance(lexer);
    }
    return false;
}

void *tree_sitter_c_sharp_external_scanner_create() {
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    array_init(&scanner->interpolation_stack);
    return scanner;
}

void tree_sitter_c_sharp_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    array_delete(&scanner->interpolation_stack);
    ts_free(scanner);
}

unsigned tree_sitter_c_sharp_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;

    if (scanner->interpolation_stack.size * 6 + 3 > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
        return 0;
    }

    unsigned size = 0;

    buffer[size++] = (char)scanner->quote_count;
    buffer[size++] = (char)scanner->if_depth;
    buffer[size++] = (char)scanner->interpolation_stack.size;

    for (unsigned i = 0; i < scanner->interpolation_stack.size; i++) {
        Interpolation interpolation = scanner->interpolation_stack.contents[i];
        buffer[size++] = (char)interpolation.dollar_count;
        buffer[size++] = (char)interpolation.open_brace_count;
        buffer[size++] = (char)interpolation.quote_count;
        buffer[size++] = (char)interpolation.string_type;
        buffer[size++] = (char)interpolation.directive_depth;
        buffer[size++] = (char)interpolation.directive_line_start;
    }

    return size;
}

void tree_sitter_c_sharp_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    Scanner *scanner = (Scanner *)payload;

    scanner->quote_count = 0;
    scanner->if_depth = 0;
    array_clear(&scanner->interpolation_stack);
    unsigned size = 0;

    if (length > 0) {
        scanner->quote_count = (unsigned char)buffer[size++];
        scanner->if_depth = (unsigned char)buffer[size++];
        scanner->interpolation_stack.size = (unsigned char)buffer[size++];
        array_reserve(&scanner->interpolation_stack, scanner->interpolation_stack.size);

        for (unsigned i = 0; i < scanner->interpolation_stack.size; i++) {
            Interpolation interpolation = {0};
            interpolation.dollar_count = buffer[size++];
            interpolation.open_brace_count = buffer[size++];
            interpolation.quote_count = buffer[size++];
            interpolation.string_type = (unsigned char)buffer[size++];
            interpolation.directive_depth = (unsigned char)buffer[size++];
            interpolation.directive_line_start = buffer[size++] != 0;
            scanner->interpolation_stack.contents[i] = interpolation;
        }
    }

    assert(size == length);
}

// Outcome of `scan_lambda_paren_open` — distinguishes "didn't start"
// (lexer untouched, wrapper can fall through to other token handlers)
// from "started and failed" (lexer cursor advanced past characters
// the wrapper must not let other handlers consume — they would emit
// tokens with wrong spans, e.g. an `INTERPOLATION_REGULAR_START`
// span covering `(false, $` in `return (false, $"...");`).
typedef enum {
    LAMBDA_SCAN_NO_PAREN,         // not a '(', no advance() done
    LAMBDA_SCAN_FAILED_AFTER_PAREN, // '(' was consumed, dirty state
    LAMBDA_SCAN_SUCCESS,
} LambdaScanResult;

// Try to recognize a C# 14 simple-lambda parameter list at the current
// position. On SUCCESS, `lexer->result_symbol` is LAMBDA_PAREN_OPEN
// and `mark_end` is set on the opening '('. On NO_PAREN, the lexer is
// untouched (only `skip(lexer)` over leading whitespace, which doesn't
// participate in token boundaries). On FAILED_AFTER_PAREN, the lexer
// has advanced past at least the opening '(' and the caller must
// surface this as a false return from the external_scanner_scan
// function so tree-sitter rewinds.
//
// Grammar of the pattern (after the opening '('):
//
//   element (',' element)* ')' '=>'
//
//   element  := modifier+ identifier
//             | identifier
//
//   modifier ∈ { scoped, ref, out, in, readonly }
//
// At least one element must carry a modifier; otherwise we'd over-fire
// on plain `(x, y) => ...` which is already handled by the existing
// `_lambda_parameters` choice.
//
// Implementation note: identifier-tokens are consumed *whole* into a
// small buffer before being classified as modifier-or-name. A
// character-by-character probe against each candidate keyword would be
// unworkable because `ref` is a prefix of `readonly` (they share `re`)
// and TSLexer has no rewind primitive: any probe order leaves one of
// the two keywords unreachable. Buffering the whole identifier
// sidesteps the prefix conflict entirely.
static LambdaScanResult scan_lambda_paren_open(TSLexer *lexer) {
    // External scanners run before whitespace `extras` are skipped, so
    // we need to skip leading whitespace/comments ourselves before
    // checking for the opening '('. `skip(lexer)` consumes the char as
    // an extra (not part of any token), so even on NO_PAREN return the
    // wrapper's fall-through into other handlers is safe — those
    // handlers do their own whitespace skipping.
    while (iswspace(lexer->lookahead)) {
        skip(lexer);
    }
    if (lexer->lookahead != '(') return LAMBDA_SCAN_NO_PAREN;
    advance(lexer);
    lexer->mark_end(lexer);

    // From this point on, the lexer cursor has moved past '('. Any
    // return must be FAILED_AFTER_PAREN unless we reach SUCCESS.
    #define BAIL return LAMBDA_SCAN_FAILED_AFTER_PAREN

    // We require at least one "hard" modifier (ref/out/in/readonly) across
    // the whole list before committing. `scoped` alone is not a valid C#
    // parameter modifier — it must always combine with a hard modifier —
    // and `scoped` is also a legal type name, so accepting `(scoped x) =>`
    // as a modifier+name pair would collide with the existing
    // `parameter_list` path on input that semantically means
    // type+identifier.
    bool saw_hard_modifier = false;
    bool expecting_element = true;

    for (;;) {
        skip_ws_and_comments(lexer);
        int32_t c = lexer->lookahead;

        if (c == 0) BAIL;   // EOF mid-list

        if (c == ')') {
            advance(lexer);
            skip_ws_and_comments(lexer);
            if (!saw_hard_modifier) BAIL;
            if (lexer->lookahead != '=') BAIL;
            advance(lexer);
            if (lexer->lookahead != '>') BAIL;
            lexer->result_symbol = LAMBDA_PAREN_OPEN;
            return LAMBDA_SCAN_SUCCESS;
        }

        if (!expecting_element) {
            if (c != ',') BAIL;
            advance(lexer);
            expecting_element = true;
            continue;
        }

        // Consume identifier-tokens in this element. Each one is either a
        // parameter modifier (`scoped`/`ref`/`out`/`in`/`readonly`) — in which
        // case we continue looking for more — or the parameter name, which
        // ends the element. Consuming the whole token before classifying
        // avoids any need to rewind the lexer on a prefix-conflict (e.g. ref
        // vs readonly).
        bool consumed_name = false;
        while (!consumed_name) {
            skip_ws_and_comments(lexer);
            if (!is_id_start(lexer->lookahead)) BAIL;

            char buf[9];  // "readonly" is 8 chars
            size_t n = consume_identifier_into(lexer, buf, sizeof(buf));

            bool is_hard_modifier = (n <= 8) && (
                buf_equals(buf, n, "ref") ||
                buf_equals(buf, n, "out") ||
                buf_equals(buf, n, "in") ||
                buf_equals(buf, n, "readonly")
            );
            bool is_soft_modifier = (n == 6) && buf_equals(buf, n, "scoped");

            if (is_hard_modifier) {
                saw_hard_modifier = true;
            } else if (is_soft_modifier) {
                // `scoped` is a modifier only when followed by a hard
                // modifier; keep scanning. If the element turns out to
                // end with `scoped <identifier>` and no hard modifier
                // appeared, the final `saw_hard_modifier` check fails
                // and we fall back to the regular parameter_list path.
            } else {
                consumed_name = true;
            }
        }
        expecting_element = false;
    }
}
#undef BAIL

bool tree_sitter_c_sharp_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    uint8_t brace_advanced = 0;
    uint8_t quote_count = 0;
    bool did_advance = false;
    // Every symbol is valid during error recovery; the zero-width depth tokens must not fire then.
    bool recovering = valid_symbols[OPT_SEMI] && valid_symbols[INTERPOLATION_REGULAR_START];

    // Right after an `#if` line: one level deeper.
    if (valid_symbols[PREPROC_IF_OPEN] && !recovering) {
        if (scanner->if_depth < 255) scanner->if_depth++;
        lexer->result_symbol = PREPROC_IF_OPEN;
        return true;
    }

    // Right before `#endif`: one level out. Where `;` is optional too, that token comes first.
    if (valid_symbols[PREPROC_IF_CLOSE] && !valid_symbols[OPT_SEMI] && !recovering) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }
        if (lexer->lookahead == '#') {
            lexer->mark_end(lexer);
            advance(lexer);
            while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
            char buf[6];
            size_t n = consume_identifier_into(lexer, buf, sizeof(buf));
            if (buf_equals(buf, n, "endif")) {
                if (scanner->if_depth > 0 && scanner->if_depth < 255) scanner->if_depth--;
                lexer->result_symbol = PREPROC_IF_CLOSE;
                return true;
            }
            return false;
        }
    }

    // Lambda-paren scanning advances forward speculatively past the
    // opening `(`. If it consumes input and then bails, the lexer
    // cursor is mispositioned and must not be reused by other token
    // handlers below — they would emit tokens with spans starting at
    // the original scan position but ending at the dirty cursor (e.g.
    // an INTERPOLATION_REGULAR_START swallowing `(false, $` in
    // `return (false, $"...");`). When the scanner consumed `(` but
    // didn't confirm a lambda, return false here so tree-sitter
    // rewinds and lets the built-in `(` tokenizer match.
    if (valid_symbols[LAMBDA_PAREN_OPEN]) {
        switch (scan_lambda_paren_open(lexer)) {
            case LAMBDA_SCAN_SUCCESS:
                return true;
            case LAMBDA_SCAN_FAILED_AFTER_PAREN:
                return false;
            case LAMBDA_SCAN_NO_PAREN:
                break;  // lexer untouched; fall through
        }
    }

    // `/*` at the end of a `#pragma` line runs to the end of the line: C# has no delimited comment
    // on a directive line. A `//` is left to the grammar's `comment`.
    if (valid_symbols[PREPROC_TRAILING_TEXT] && !valid_symbols[OPT_SEMI]) {
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\v' ||
               lexer->lookahead == '\f') {
            skip(lexer);
        }
        int32_t c = lexer->lookahead;
        // Text the directive's own tokens do not take: `/*`, or anything that is not a name, a
        // number, a `,` or a `//` comment (`#pragma warning restore X */` warns, CS1696).
        bool text = false;
        if (c == '/') {
            advance(lexer);
            if (lexer->lookahead == '/') return false;
            text = true;
        } else if (c != 0 && c != ',' && c != '"' && !is_id_continue(c) && !is_line_break(c) &&
                   !iswspace(c)) {
            text = true;
        }
        if (text) {
            while (!lexer->eof(lexer) && !is_line_break(lexer->lookahead)) advance(lexer);
            lexer->mark_end(lexer);
            lexer->result_symbol = PREPROC_TRAILING_TEXT;
            return true;
        }
    }

    // A `/* */` comment that hides a branch-ending directive line: see `DirectiveLines`. Every
    // other comment is left to the grammar's own `comment` token (this returns false). Not inside
    // a string or a hole's braces, whose content is not a comment, and not where `;` is optional:
    // that token comes first, zero-width, and the scan runs again in the next state.
    if (scanner->if_depth > 0 && !valid_symbols[OPT_SEMI] && !valid_symbols[INTERPOLATION_STRING_CONTENT] &&
        !valid_symbols[INTERPOLATION_START_QUOTE] && !valid_symbols[INTERPOLATION_END_QUOTE] &&
        !valid_symbols[INTERPOLATION_OPEN_BRACE] && !valid_symbols[INTERPOLATION_CLOSE_BRACE] &&
        !valid_symbols[RAW_STRING_END] && !valid_symbols[RAW_STRING_CONTENT]) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }
        if (lexer->lookahead == '/') {
            advance(lexer);
            if (lexer->lookahead != '*') return false;
            advance(lexer);
            if (!block_comment_hides_directive(lexer)) return false;
            lexer->mark_end(lexer);
            lexer->result_symbol = SKIPPED_TEXT_HAZARD;
            return true;
        }
    }

    // error recovery, gives better trees this way
    if (valid_symbols[OPT_SEMI] && valid_symbols[INTERPOLATION_REGULAR_START]) {
        return false;
    }

    if (valid_symbols[OPT_SEMI]) {
        lexer->result_symbol = OPT_SEMI;
        if (lexer->lookahead == ';') {
            advance(lexer);
        }
        return true;
    }

    if (valid_symbols[RAW_STRING_START]) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }

        if (lexer->lookahead == '"') {
            while (lexer->lookahead == '"') {
                advance(lexer);
                quote_count++;
            }

            if (quote_count >= 3) {
                lexer->mark_end(lexer);
                // Read ahead for a branch-ending line (see `DirectiveLines`); the token stays the
                // opening quotes either way.
                if (scanner->if_depth > 0 && raw_string_hides_directive(lexer, quote_count)) {
                    lexer->result_symbol = SKIPPED_TEXT_HAZARD;
                    return true;
                }
                lexer->result_symbol = RAW_STRING_START;
                scanner->quote_count = quote_count;
                return true;
            }
        }
    }

    if (valid_symbols[RAW_STRING_END] && lexer->lookahead == '"') {
        while (lexer->lookahead == '"') {
            advance(lexer);
            quote_count++;
        }

        if (quote_count == scanner->quote_count) {
            lexer->result_symbol = RAW_STRING_END;
            scanner->quote_count = 0;
            return true;
        }

        did_advance = quote_count > 0;
    }

    if (valid_symbols[RAW_STRING_CONTENT]) {
        while (lexer->lookahead) {
            if (lexer->lookahead == '"') {
                lexer->mark_end(lexer);
                quote_count = 0;

                while (lexer->lookahead == '"') {
                    advance(lexer);
                    quote_count++;
                }

                if (quote_count == scanner->quote_count) {
                    lexer->result_symbol = RAW_STRING_CONTENT;
                    return true;
                }
            }
            advance(lexer);
            did_advance = true;
        }
        lexer->mark_end(lexer);
        lexer->result_symbol = RAW_STRING_CONTENT;
        return true;
    }

    if (valid_symbols[INTERPOLATION_REGULAR_START] || valid_symbols[INTERPOLATION_VERBATIM_START] ||
        valid_symbols[INTERPOLATION_RAW_START]) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }

        uint8_t dollar_advanced = 0;

        bool is_verbatim = false;

        if (lexer->lookahead == '@') {
            is_verbatim = true;
            advance(lexer);
        }

        while (lexer->lookahead == '$' && quote_count == 0) {
            advance(lexer);
            dollar_advanced++;
        }

        if (dollar_advanced > 0 && (lexer->lookahead == '"' || lexer->lookahead == '@')) {
            lexer->result_symbol = INTERPOLATION_REGULAR_START;
            Interpolation interpolation = {
                .dollar_count = dollar_advanced,
                .open_brace_count = 0,
                .quote_count = 0,
                .string_type = 0,
            };

            if (is_verbatim || lexer->lookahead == '@') {
                if (lexer->lookahead == '@') {
                    advance(lexer);
                    is_verbatim = true;
                }
                lexer->result_symbol = INTERPOLATION_VERBATIM_START;
                interpolation.string_type = VERBATIM;
            }

            lexer->mark_end(lexer);
            advance(lexer);

            if (lexer->lookahead == '"' && !is_verbatim) {
                advance(lexer);
                if (lexer->lookahead == '"') {
                    lexer->result_symbol = INTERPOLATION_RAW_START;
                    interpolation.string_type |= RAW;
                    array_push(&scanner->interpolation_stack, interpolation);
                }
                // If we find 1 or 3 quotes, we push an interpolation.
                // If there's only two quotes, that's just an empty string
            } else {
                interpolation.string_type |= REGULAR;
                array_push(&scanner->interpolation_stack, interpolation);
            }

            return true;
        }

        // `@"`: a plain verbatim string, which the grammar lexes itself. Only a string that hides
        // a branch-ending line (see `DirectiveLines`) is taken here; nothing else starts at `@"`.
        if (is_verbatim && dollar_advanced == 0 && lexer->lookahead == '"') {
            advance(lexer);
            if (scanner->if_depth == 0 || !verbatim_string_hides_directive(lexer)) return false;
            lexer->mark_end(lexer);
            lexer->result_symbol = SKIPPED_TEXT_HAZARD;
            return true;
        }
    }

    if (valid_symbols[INTERPOLATION_START_QUOTE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        if (is_verbatim(current_interpolation) || is_regular(current_interpolation)) {
            if (lexer->lookahead == '"') {
                advance(lexer);
                current_interpolation->quote_count++;
            }
        } else {
            while (lexer->lookahead == '"') {
                advance(lexer);
                current_interpolation->quote_count++;
            }
        }

        lexer->result_symbol = INTERPOLATION_START_QUOTE;
        return current_interpolation->quote_count > 0;
    }

    if (valid_symbols[INTERPOLATION_END_QUOTE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        // Verbatim or raw content that leaves an `#if` open (see `DirectiveLines`): the string
        // ends here, so it is a hazard as a plain string would be.
        if (lexer->lookahead == '"' && current_interpolation->directive_depth > 0 &&
            scanner->if_depth > 0 && (is_raw(current_interpolation) || is_verbatim(current_interpolation))) {
            advance(lexer);
            lexer->mark_end(lexer);
            lexer->result_symbol = SKIPPED_TEXT_HAZARD;
            return true;
        }

        while (lexer->lookahead == '"') {
            advance(lexer);
            quote_count++;
        }

        if (quote_count == current_interpolation->quote_count) {
            lexer->result_symbol = INTERPOLATION_END_QUOTE;
            array_pop(&scanner->interpolation_stack);
            return true;
        }

        did_advance = quote_count > 0;
    }

    if (valid_symbols[INTERPOLATION_OPEN_BRACE] && scanner->interpolation_stack.size > 0) {
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (lexer->lookahead == '{' && brace_advanced < current_interpolation->dollar_count) {
            advance(lexer);
            brace_advanced++;
        }

        if (brace_advanced > 0 && brace_advanced == current_interpolation->dollar_count &&
            (brace_advanced == 0 || lexer->lookahead != '{')) {
            current_interpolation->open_brace_count = brace_advanced;
            current_interpolation->directive_line_start = false;
            lexer->result_symbol = INTERPOLATION_OPEN_BRACE;
            return true;
        }
    }

    if (valid_symbols[INTERPOLATION_CLOSE_BRACE] && scanner->interpolation_stack.size > 0) {
        uint8_t brace_advanced = 0;
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);

        while (iswspace(lexer->lookahead)) {
            advance(lexer);
        }

        // A `/* */` comment in the hole, checked as anywhere else (see `DirectiveLines`); only here
        // because whitespace before `}` belongs to the brace token, so the general check above
        // cannot skip it.
        if (lexer->lookahead == '/') {
            if (scanner->if_depth == 0) return false;
            advance(lexer);
            if (lexer->lookahead != '*') return false;
            advance(lexer);
            if (!block_comment_hides_directive(lexer)) return false;
            lexer->mark_end(lexer);
            lexer->result_symbol = SKIPPED_TEXT_HAZARD;
            return true;
        }

        while (lexer->lookahead == '}') {
            advance(lexer);
            brace_advanced++;

            if (brace_advanced == current_interpolation->open_brace_count) {
                current_interpolation->open_brace_count = 0;
                lexer->result_symbol = INTERPOLATION_CLOSE_BRACE;
                return true;
            }
        }

        return false;
    }

    if (valid_symbols[INTERPOLATION_STRING_CONTENT] && scanner->interpolation_stack.size > 0) {
        lexer->result_symbol = INTERPOLATION_STRING_CONTENT;
        Interpolation *current_interpolation = array_back(&scanner->interpolation_stack);
        // Verbatim and raw content can span lines: checked as a comment is (see `DirectiveLines`).
        bool multiline = is_raw(current_interpolation) || is_verbatim(current_interpolation);
        DirectiveLines lines = {current_interpolation->directive_depth,
                                current_interpolation->directive_line_start};

        while (lexer->lookahead) {
            if (multiline && scanner->if_depth > 0) {
                bool consumed;
                bool ends_branch = directive_lines_step(lexer, &lines, &consumed);
                current_interpolation->directive_depth = lines.depth > 255 ? 255 : (uint8_t)lines.depth;
                current_interpolation->directive_line_start = lines.line_start;
                if (ends_branch) {
                    lexer->mark_end(lexer);
                    lexer->result_symbol = SKIPPED_TEXT_HAZARD;
                    return true;
                }
                if (consumed) {
                    brace_advanced = 0;
                    did_advance = true;
                    continue;
                }
            }
            // top-down approach, first see if it's raw
            if (is_raw(current_interpolation)) {
                if (lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    advance(lexer);
                    if (lexer->lookahead == '"') {
                        advance(lexer);
                        uint8_t quote_advanced = 2;
                        while (lexer->lookahead == '"') {
                            quote_advanced++;
                            advance(lexer);
                        }
                        if (quote_advanced == current_interpolation->quote_count) {
                            return did_advance;
                        }
                    }
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) {
                        return did_advance;
                    }
                }
            }

            // then verbatim, since it could be verbatim + raw, but run the raw branch first
            else if (is_verbatim(current_interpolation)) {
                if (lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    advance(lexer);
                    if (lexer->lookahead == '"') {
                        advance(lexer);
                        continue;
                    }
                    return did_advance;
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) {
                        return did_advance;
                    }
                }
            }

            // finally regular
            else if (is_regular(current_interpolation)) {
                if (lexer->lookahead == '\\' || lexer->lookahead == '\n' || lexer->lookahead == '"') {
                    lexer->mark_end(lexer);
                    return did_advance;
                }

                if (lexer->lookahead == '{') {
                    lexer->mark_end(lexer);

                    while (lexer->lookahead == '{' && brace_advanced < current_interpolation->open_brace_count) {
                        advance(lexer);
                        brace_advanced++;
                    }

                    if (brace_advanced == current_interpolation->open_brace_count &&
                        (brace_advanced == 0 || lexer->lookahead != '{')) { // if we're in a brace we're not allowed to
                                                                            // collect more than the open_brace_count
                        return did_advance;
                    }
                }
            }

            if (lexer->lookahead != '{') {
                brace_advanced = 0;
            }
            advance(lexer);
            did_advance = true;
        }

        lexer->mark_end(lexer);
        return did_advance;
    }

    return false;
}
