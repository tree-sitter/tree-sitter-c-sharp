/**
 * @file C# grammar for tree-sitter
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @author Damien Guard <damieng@gmail.com>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  GENERIC: 19,
  CONDITIONAL_BINDING: 19,
  DOT: 18,
  INVOCATION: 18,
  POSTFIX: 18,
  PREFIX: 17,
  UNARY: 17,
  CAST: 17,
  RANGE: 16,
  SWITCH: 15,
  WITH: 14,
  MULT: 13,
  ADD: 12,
  SHIFT: 11,
  REL: 10,
  EQUAL: 9,
  AND: 8,
  XOR: 7,
  OR: 6,
  LOGICAL_AND: 5,
  LOGICAL_OR: 4,
  COALESCING: 3,
  CONDITIONAL: 2,
  ASSIGN: 1,
  SELECT: 0,
};

const decimalDigitSequence = /([0-9][0-9_]*[0-9]|[0-9])/;

const stringEncoding = /(u|U)8/;

export default grammar({
  name: 'c_sharp',

  conflicts: $ => [
    [$._simple_name, $.generic_name],
    [$._simple_name, $.type_parameter],
    [$._simple_name, $.subpattern],

    [$.tuple_element, $.using_variable_declarator],
    [$.tuple_element, $.declaration_expression],
    [$.type, $._var_deconstruction],

    [$.lvalue_expression, $._name],
    [$.parameter, $.lvalue_expression],
    // C# 14 null-conditional assignment: `obj?.x = v` requires
    // `conditional_access_expression` to appear in both lvalue and
    // non-lvalue contexts. Tree-sitter needs GLR for the decision.
    [$.lvalue_expression, $.non_lvalue_expression],

    // After `a?.b`, a `?` either continues the access (`a?.b?[0]`) or starts
    // the branches of a conditional expression (`a?.b ? [0] : c`).
    [$.conditional_access_expression, $._conditional_binding_conditional_access],
    [$._conditional_binding_conditional_access],
    // After `a?.b`, a `!` stays in the chain only if another access follows it.
    [$.conditional_access_expression, $._conditional_binding_null_forgiving],
    [$._conditional_binding_conditional_access, $._conditional_binding_null_forgiving],

    [$.type, $.attribute],
    [$.type, $.nullable_type],
    [$.type, $.nullable_type, $.array_creation_expression],
    [$.type, $._array_base_type],
    [$.type, $._array_base_type, $.array_creation_expression],
    [$.type, $.array_creation_expression],
    [$.type, $._pointer_base_type],

    [$.qualified_name, $.member_access_expression],
    [$.qualified_name, $.explicit_interface_specifier],

    [$._array_base_type, $.stackalloc_expression],

    [$.binary_expression, $.constant_pattern],
    [$.constant_pattern, $.non_lvalue_expression],
    [$.constant_pattern, $._expression_statement_expression],
    [$.constant_pattern, $.lvalue_expression],
    [$.constant_pattern, $._name],
    [$.constant_pattern, $.lvalue_expression, $._name],
    [$.constant_pattern, $.non_lvalue_expression, $.lvalue_expression],

    [$.type, $._name_invocation_pattern, $.recursive_pattern],
    [$.attribute, $.type, $._name_invocation_pattern, $.recursive_pattern],

    [$.parenthesized_pattern, $._parenthesized_pattern_with_designation],

    [$.expression_element, $.argument],
    [$.spread_element, $.range_expression],
    [$._list_pattern_body, $.collection_expression],

    [$._reserved_identifier, $.modifier],
    [$._reserved_identifier, $.scoped_type],
    [$._reserved_identifier, $.implicit_type],
    [$._reserved_identifier, $.from_clause],
    [$._reserved_identifier, $.implicit_type, $.var_pattern],
    [$._reserved_identifier, $.type_parameter_constraint],
    [$._reserved_identifier, $.parameter, $.scoped_type],
    [$._reserved_identifier, $.parameter],
    [$._record_declaration_initializer, $._reserved_identifier],
    [$._simple_name, $.parameter],
    [$.tuple_element, $.parameter, $.declaration_expression],
    [$.parameter, $.tuple_element],

    [$.event_declaration, $.variable_declarator],

    [$.base_list],
    [$.using_directive, $.modifier],
    [$.using_directive],

    // For C# 14 extension declarations: `extension(scoped X x)` —
    // `scoped` can be a parameter modifier, a scoped_type, or a
    // reserved identifier (when there's no further type). Keep all
    // three alive until later tokens disambiguate.
    [$.receiver_parameter, $.scoped_type, $._reserved_identifier],
  ],

  externals: $ => [
    $._optional_semi,
    $.interpolation_regular_start,
    $.interpolation_verbatim_start,
    $.interpolation_raw_start,
    $.interpolation_start_quote,
    $.interpolation_end_quote,
    $.interpolation_open_brace,
    $.interpolation_close_brace,
    $.interpolation_string_content,
    $.raw_string_start,
    $.raw_string_end,
    $.raw_string_content,
    // C# 14: emitted by the scanner at '(' when forward-scanning shows a
    // simple-lambda parameter list (at least one element has a parameter
    // modifier) closed by ')=>'.
    $._lambda_paren_open,
    $._conditional_member_question,
    // From an `#elif` or `#else` line up to the matching `#endif`, unparsed.
    $.preproc_else,
    // The newline that ends a directive line.
    $._preproc_newline,
    // The rest of a directive line. C# has no delimited comment on a
    // directive line, so `/*` is plain text here and must not start a
    // comment that hides the lines after it.
    $.preproc_arg,
    // Text after a complete `#pragma`, read only when it cannot start the
    // warning list: not a word, number or `,`.
    $._preproc_trailing_text,
    // Text in place of a `#pragma` kind, read only when it does not start
    // with `warning` or `checksum`.
    $._preproc_pragma_text,
    // Text in place of a `#pragma warning` action, read only when it does not
    // start with `disable` or `restore`.
    $._preproc_pragma_warning_text,
    // The newlines that end an `#if` and an `#endif` line. The scanner counts the
    // `#if` blocks it is inside from them, which `_skipped_text_hazard` needs.
    $._preproc_if_newline,
    $._preproc_endif_newline,
    // The start of a `_skipped_text`, which can never complete. Inside the first
    // branch of an `#if`, the scanner returns it for a `/* */` comment, a verbatim or
    // raw string, or the content of an interpolated verbatim or raw string that holds
    // an `#else`, `#elif` or `#endif` line it did not open, or leaves an `#if` open.
    // When the compiler skips that branch it reads only directive lines, so that line
    // ends the branch and the text after it is code: no single tree is right.
    $._skipped_text_hazard,
    // Never returned: what makes `_skipped_text` an error wherever it starts.
    $._skipped_text_never,
    // A `<` that can only be less-than. Where `<` could also start type arguments, the scanner
    // reads ahead (C# spec, "Grammar ambiguities"): when the list is well-formed but is followed
    // by another `>` or by the start of an operand the spec does not let follow a type argument
    // list (a literal, unary `+`, `-`, `!`, `~` or `*`), the compiler reads `<` and `>` as
    // operators. So `A < X >> B` is `A < (X >> B)`, not `(A<X>) > B`.
    $._less_than,
  ],

  extras: $ => [
    /[\s\u00A0\uFEFF\u3000\u0085\u2028\u2029]+/,
    $.comment,
    $._preproc_directive,
    $.preproc_else,
  ],

  inline: $ => [
    $._expression_statement_expression,
    $._join_body,
    $._preproc_expression,
    $._interpolated_string_content,
    $._interpolated_unescaped_string_content,
    $._extension_member_declaration,
    $._query_clause,
    $._top_level_item,
    $._switch_expression_body,
    $._ref_base_type,
    $._scoped_base_type,
    $._query_body,
    $._lambda_parameters,
    $._implicit_parameter_list_with_modifiers,
    $._select_or_group_clause,
    $._with_body,
    $._namespace_member_declaration,
    $._object_creation_type,
    $._nullable_base_type,
    $._parameter_type_with_modifiers,
    $._top_level_item_no_statement,
    $._conditional_binding_operand,
    $._conditional_binding,
  ],

  precedences: $ => [
    [$._anonymous_object_member_declarator, $._simple_name],
    [$.block, $.initializer_expression],
  ],

  supertypes: $ => [
    $.declaration,
    $.expression,
    $.non_lvalue_expression,
    $.lvalue_expression,
    $.literal,
    $.statement,
    $.type,
    $.type_declaration,
    $.pattern,
  ],

  word: $ => $._identifier_token,

  rules: {
    compilation_unit: $ => seq(
      optional($.shebang_directive),
      repeat($._top_level_item),
      optional($.file_scoped_namespace_declaration),
    ),

    _top_level_item: $ => prec(2, choice(
      $._top_level_item_no_statement,
      $.global_statement,
    )),

    _top_level_item_no_statement: $ => choice(
      $.extern_alias_directive,
      $.using_directive,
      $.global_attribute,
      $._namespace_member_declaration,
    ),

    global_statement: $ => prec(1, $.statement),

    extern_alias_directive: $ => seq('extern', 'alias', field('name', $.identifier), ';'),

    using_directive: $ => seq(
      optional('global'),
      'using',
      choice(
        seq(
          optional('unsafe'),
          field('name', $.identifier),
          '=',
          $.type,
        ),
        seq(
          repeat(choice('static', 'unsafe')),
          $._name,
        ),
      ),
      ';',
    ),

    global_attribute: $ => seq(
      '[',
      choice('assembly', 'module'),
      ':',
      commaSep1($.attribute),
      optional(','),
      ']',
    ),

    attribute: $ => seq(
      field('name', $._name),
      optional($.attribute_argument_list),
    ),

    attribute_argument_list: $ => prec(-1, seq(
      '(',
      commaSep($.attribute_argument),
      ')',
    )),

    attribute_argument: $ => prec(-1, seq(
      optional(prec(1, seq(field('name', $.identifier), choice(':', '=')))),
      $.expression,
    )),

    attribute_list: $ => seq(
      '[',
      optional($.attribute_target_specifier),
      commaSep1($.attribute),
      optional(','),
      ']',
    ),

    // Higher precedence than `_reserved_identifier`: when both interpretations
    // are valid (e.g. `[field :` could be `_reserved_identifier` followed by
    // bogus `:`, or `attribute_target_specifier`), prefer the target-specifier
    // reading. `_reserved_identifier` still wins when no `:` follows, so
    // `[field]` continues to parse as collection_expression with identifier.
    attribute_target_specifier: _ => prec(1, seq(
      choice('field', 'event', 'method', 'param', 'property', 'return', 'type', 'typevar'),
      ':',
    )),

    _namespace_member_declaration: $ => choice(
      $.namespace_declaration,
      $.type_declaration,
    ),

    namespace_declaration: $ => seq(
      'namespace',
      field('name', $._name),
      field('body', alias($._namespace_body, $.declaration_list)),
      $._optional_semi,
    ),

    // A namespace body may start with `extern alias` directives. In a type body
    // `extern alias A();` is a method returning a type named `alias`, so the
    // directive is not a `declaration`.
    _namespace_body: $ => seq(
      '{',
      repeat($.extern_alias_directive),
      repeat($.declaration),
      '}',
    ),

    // Like Roslyn, the namespace holds every member that follows it, so its
    // range covers the types it declares.
    file_scoped_namespace_declaration: $ => seq(
      'namespace',
      field('name', $._name),
      ';',
      repeat($._top_level_item_no_statement),
    ),

    type_declaration: $ => choice(
      $.class_declaration,
      $.struct_declaration,
      $.enum_declaration,
      $.interface_declaration,
      $.delegate_declaration,
      $.record_declaration,
    ),

    class_declaration: $ => seq(
      $._class_declaration_initializer,
      $._declaration_list_body,
    ),

    _class_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'class',
      field('name', $.identifier),
      repeat(choice($.type_parameter_list, $.parameter_list, $.base_list)),
      repeat($.type_parameter_constraints_clause),
    ),

    struct_declaration: $ => seq(
      $._struct_declaration_initializer,
      $._declaration_list_body,
    ),

    _struct_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      // C# requires `partial` to be the LAST modifier before the type keyword,
      // so the legal order is `ref partial struct`. A modifier after `ref` is a
      // `modifier` node, like the ones before it.
      optional(seq('ref', repeat($.modifier))),
      'struct',
      field('name', $.identifier),
      repeat(choice($.type_parameter_list, $.parameter_list, $.base_list)),
      repeat($.type_parameter_constraints_clause),
    ),

    enum_declaration: $ => seq(
      $._enum_declaration_initializer,
      choice(
        seq(field('body', $.enum_member_declaration_list), $._optional_semi),
        ';',
      ),
    ),

    _enum_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'enum',
      field('name', $.identifier),
      optional($.base_list),
    ),

    enum_member_declaration_list: $ => seq(
      '{',
      commaSep($.enum_member_declaration),
      optional(','),
      '}',
    ),

    enum_member_declaration: $ => seq(
      repeat($.attribute_list),
      field('name', $.identifier),
      optional(seq('=', field('value', $.expression))),
    ),

    interface_declaration: $ => seq(
      $._interface_declaration_initializer,
      $._declaration_list_body,
    ),

    _interface_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'interface',
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter_list)),
      optional($.base_list),
      repeat($.type_parameter_constraints_clause),
    ),

    delegate_declaration: $ => seq(
      $._delegate_declaration_initializer,
      repeat($.type_parameter_constraints_clause),
      ';',
    ),

    _delegate_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'delegate',
      field('type', $.type),
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter_list)),
      field('parameters', $.parameter_list),
    ),

    record_declaration: $ => seq(
      $._record_declaration_initializer,
      $._declaration_list_body,
    ),

    _record_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'record',
      optional(choice('class', 'struct')),
      field('name', $.identifier),
      repeat(choice($.type_parameter_list, $.parameter_list)),
      optional(alias($.record_base, $.base_list)),
      repeat($.type_parameter_constraints_clause),
    ),

    record_base: $ => choice(
      seq(':', commaSep1($._name)),
      seq(':', $.primary_constructor_base_type, optional(seq(',', commaSep1($._name)))),
    ),

    _declaration_list_body: $ => choice(
      seq(field('body', $.declaration_list), $._optional_semi),
      ';',
    ),

    primary_constructor_base_type: $ => seq(
      field('type', $._name),
      $.argument_list,
    ),

    modifier: _ => prec.right(choice(
      'abstract',
      'async',
      'const',
      'extern',
      'file',
      'fixed',
      'internal',
      'new',
      'override',
      'partial',
      'private',
      'protected',
      'public',
      'readonly',
      'required',
      // 'ref',     // `ref` as a modifier can only be used on struct declarations. Other than that it's a ref type or a ref parameter in a declaration.
      // 'scoped',  // `scoped` is either part of a scoped type or a scoped parameter. Both of which are handled outside of `modifier`.
      'sealed',
      'static',
      'unsafe',
      'virtual',
      'volatile',

    )),

    type_parameter_list: $ => seq('<', commaSep1($.type_parameter), '>'),

    type_parameter: $ => seq(
      repeat($.attribute_list),
      optional(choice('in', 'out')),
      field('name', $.identifier),
    ),

    base_list: $ => seq(':', commaSep1(seq($.type, optional($.argument_list)))),

    type_parameter_constraints_clause: $ => seq(
      'where',
      $.identifier,
      ':',
      commaSep1($.type_parameter_constraint),
    ),

    type_parameter_constraint: $ => choice(
      seq('class', optional('?')),
      'struct',
      'notnull',
      'unmanaged',
      'default',
      $.constructor_constraint,
      field('type', $.type),
    ),

    constructor_constraint: _ => seq('new', '(', ')'),

    operator_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('type', $.type),
      optional($.explicit_interface_specifier),
      'operator',
      optional('checked'),
      field('operator', choice(
        '!',
        '~',
        '++',
        '--',
        'true',
        'false',
        '+', '-',
        '*', '/',
        '%', '^',
        '|', '&',
        '<<', '>>', '>>>',
        '==', '!=',
        '>', '<',
        '>=', '<=',
        // C# 14: user-defined compound assignment operators.
        // https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#user-defined-compound-assignment-operators
        '+=', '-=',
        '*=', '/=',
        '%=', '^=',
        '|=', '&=',
        '<<=', '>>=', '>>>=',
      )),
      field('parameters', $.parameter_list),
      $._function_body,
    ),

    conversion_operator_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      choice(
        'implicit',
        'explicit',
      ),
      repeat1(choice( // Intentionally structured this way for grammar size
        $.explicit_interface_specifier,
        'operator',
        'checked',
      )),
      field('type', $.type),
      field('parameters', $.parameter_list),
      $._function_body,
    ),

    declaration_list: $ => seq(
      '{',
      repeat($.declaration),
      '}',
    ),

    declaration: $ => choice(
      $.class_declaration,
      $.struct_declaration,
      $.enum_declaration,
      $.delegate_declaration,
      $.field_declaration,
      $.method_declaration,
      $.event_declaration,
      $.event_field_declaration,
      $.record_declaration,
      $.constructor_declaration,
      $.destructor_declaration,
      $.indexer_declaration,
      $.interface_declaration,
      $.namespace_declaration,
      $.operator_declaration,
      $.conversion_operator_declaration,
      $.property_declaration,
      $.using_directive,
      $.extension_declaration,
    ),

    // C# 14: extension declarations introduce extension methods, properties,
    // and operators with a shared receiver inside a non-generic static class.
    // https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-14.0/extensions
    //
    //   extension_declaration:
    //     'extension' type_parameter_list? '(' receiver_parameter ')'
    //         type_parameter_constraints_clause* extension_body
    //   extension_body: '{' extension_member_declaration* '}' ';'?
    //   extension_member_declaration:
    //     method_declaration | property_declaration | operator_declaration
    //   receiver_parameter: attributes? parameter_modifiers? type identifier?
    //
    // `extension` is contextual; it is recognized as the start of an
    // extension declaration when followed by `<` or `(` in declaration
    // position. Use prec.dynamic so an identifier named `extension` in
    // other positions still parses.
    extension_declaration: $ => prec.dynamic(1, seq(
      repeat($.attribute_list),
      'extension',
      optional($.type_parameter_list),
      '(',
      $.receiver_parameter,
      ')',
      repeat($.type_parameter_constraints_clause),
      $.extension_body,
    )),

    receiver_parameter: $ => seq(
      repeat($.attribute_list),
      $._parameter_type_with_modifiers,
      optional(field('name', $.identifier)),
    ),

    extension_body: $ => seq(
      '{',
      repeat($._extension_member_declaration),
      '}',
      optional(';'),
    ),

    _extension_member_declaration: $ => choice(
      $.method_declaration,
      $.property_declaration,
      $.operator_declaration,
    ),

    field_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      $.variable_declaration,
      ';',
    ),

    constructor_declaration: $ => seq(
      $._constructor_declaration_initializer,
      $._function_body,
    ),

    _constructor_declaration_initializer: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      optional($.constructor_initializer),
    ),

    destructor_declaration: $ => seq(
      repeat($.attribute_list),
      optional('extern'),
      '~',
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      $._function_body,
    ),

    method_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('returns', $.type),
      optional($.explicit_interface_specifier),
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter_list)),
      field('parameters', $.parameter_list),
      repeat($.type_parameter_constraints_clause),
      $._function_body,
    ),

    event_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'event',
      field('type', $.type),
      optional($.explicit_interface_specifier),
      field('name', $.identifier),
      choice(
        field('accessors', $.accessor_list),
        ';',
      ),
    ),

    event_field_declaration: $ => prec.dynamic(1, seq(
      repeat($.attribute_list),
      repeat($.modifier),
      'event',
      $.variable_declaration,
      ';',
    )),

    accessor_list: $ => seq(
      '{',
      repeat($.accessor_declaration),
      '}',
    ),

    accessor_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('name', choice('get', 'set', 'add', 'remove', 'init', $.identifier)),
      $._function_body,
    ),

    indexer_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('type', $.type),
      optional($.explicit_interface_specifier),
      'this',
      field('parameters', $.bracketed_parameter_list),
      choice(
        field('accessors', $.accessor_list),
        seq(field('value', $.arrow_expression_clause), ';'),
      ),
    ),

    bracketed_parameter_list: $ => seq(
      '[',
      sep(choice($.parameter, $._parameter_array), ','),
      ']',
    ),

    property_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('type', $.type),
      optional($.explicit_interface_specifier),
      field('name', $.identifier),
      choice(
        seq(
          field('accessors', $.accessor_list),
          optional($._property_default),
        ),
        seq(
          field('value', $.arrow_expression_clause),
          ';',
        ),
      ),
    ),

    _property_default: $ => seq('=', field('value', $.expression), ';'),

    explicit_interface_specifier: $ => prec(PREC.DOT, seq(
      $._name,
      '.',
    )),

    parameter_list: $ => seq(
      '(',
      sep(choice($.parameter, $._parameter_array), ','),
      ')',
    ),

    _parameter_type_with_modifiers: $ => seq(
      repeat(choice(
        prec.left(alias(choice('this', 'scoped', 'ref', 'readonly'), $.modifier)),
        // `in`/`out` also start an `argument` (prec 1), which won the shift/reduce
        // against this reduction and sent `(in T x) => ...` to ERROR.
        prec.left(1, alias(choice('out', 'in'), $.modifier)),
      )),
      field('type', $.type),
    ),

    parameter: $ => seq(
      repeat($.attribute_list),
      optional($._parameter_type_with_modifiers),
      field('name', $.identifier),
      optional($._variable_initializer),
    ),

    _parameter_array: $ => seq(
      repeat($.attribute_list),
      'params',
      field('type', $.type),
      field('name', $.identifier),
    ),

    constructor_initializer: $ => seq(
      ':',
      choice('base', 'this'),
      $.argument_list,
    ),

    _out_argument: $ => seq('out', choice($.expression, $.declaration_expression)),

    argument_list: $ => seq('(', commaSep($.argument), ')'),

    // A declaration is only valid after `out`, so `M(t * x)` multiplies and
    // `M(a < b, c > d)` compares. Without `out` it stays available for error
    // tolerance, below every expression, including a `generic_name`.
    argument: $ => argumentRule($, -(PREC.GENERIC + 2)),

    // `(A<B> a, C b) = t` declares variables, so a generic type still wins here,
    // while `(a * b, c)` remains a multiplication.
    _tuple_argument: $ => argumentRule($, -1),

    block: $ => seq('{', repeat($.statement), '}'),

    arrow_expression_clause: $ => seq('=>', $.expression),

    _function_body: $ => choice(
      field('body', $.block),
      seq(field('body', $.arrow_expression_clause), ';'),
      ';',
    ),

    variable_declaration: $ => seq(
      field('type', $.type),
      commaSep1($.variable_declarator),
    ),

    using_variable_declaration: $ => seq(
      field('type', $.type),
      commaSep1(alias($.using_variable_declarator, $.variable_declarator)),
    ),

    variable_declarator: $ => seq(
      field('name', $.identifier),
      optional($.bracketed_argument_list),
      optional($._variable_initializer),
    ),

    using_variable_declarator: $ => seq(
      field('name', $.identifier),
      optional($._variable_initializer),
    ),

    _variable_initializer: $ => seq('=', $.expression),

    bracketed_argument_list: $ => seq(
      '[',
      commaSep1($.argument),
      optional(','),
      ']',
    ),

    qualified_identifier: $ => sep1($.identifier, '.'),

    _name: $ => choice(
      $.alias_qualified_name,
      $.qualified_name,
      $._simple_name,
    ),

    alias_qualified_name: $ => seq(
      field('alias', $.identifier),
      '::',
      field('name', $._simple_name),
    ),

    _simple_name: $ => choice(
      $.identifier,
      $.generic_name,
    ),

    qualified_name: $ => prec(PREC.DOT, seq(
      field('qualifier', $._name),
      '.',
      field('name', $._simple_name),
    )),

    generic_name: $ => prec.dynamic(PREC.GENERIC, seq($.identifier, $.type_argument_list)),

    type_argument_list: $ => seq(
      '<',
      choice(
        repeat(','),
        commaSep1($.type),
      ),
      '>',
    ),

    type: $ => choice(
      $.implicit_type,
      $.array_type,
      $._name,
      $.nullable_type,
      $.pointer_type,
      $.function_pointer_type,
      $.predefined_type,
      $.tuple_type,
      $.ref_type,
      $.scoped_type,
    ),

    implicit_type: _ => prec.dynamic(1, 'var'),

    array_type: $ => seq(
      field('type', $._array_base_type),
      field('rank', $.array_rank_specifier),
    ),

    _array_base_type: $ => choice(
      $.array_type,
      $._name,
      $.nullable_type,
      $.pointer_type,
      $.function_pointer_type,
      $.predefined_type,
      $.tuple_type,
    ),

    array_rank_specifier: $ => seq(
      '[',
      commaSep(optional($.expression)),
      ']',
    ),

    nullable_type: $ => seq(field('type', $._nullable_base_type), '?'),

    _nullable_base_type: $ => choice(
      $.array_type,
      $._name,
      $.predefined_type,
      $.tuple_type,
    ),

    pointer_type: $ => seq(field('type', $._pointer_base_type), '*'),

    _pointer_base_type: $ => choice(
      $._name,
      $.nullable_type,
      $.pointer_type,
      $.function_pointer_type,
      $.predefined_type,
      $.tuple_type,
    ),

    function_pointer_type: $ => seq(
      'delegate',
      '*',
      optional($.calling_convention),
      '<',
      repeat(seq($.function_pointer_parameter, ',')),
      field('returns', $.type),
      '>',
    ),

    calling_convention: $ => choice(
      'managed',
      seq(
        'unmanaged',
        optional(seq(
          '[',
          commaSep1(choice(
            'Cdecl',
            'Stdcall',
            'Thiscall',
            'Fastcall',
            $.identifier,
          )),
          ']',
        )),
      ),
    ),

    function_pointer_parameter: $ => seq(
      optional(choice('ref', 'out', 'in')),
      field('type', $._ref_base_type),
    ),

    predefined_type: _ => token(choice(
      'bool',
      'byte',
      'char',
      'decimal',
      'double',
      'float',
      'int',
      'long',
      'object',
      'sbyte',
      'short',
      'string',
      'uint',
      'ulong',
      'ushort',
      'nint',
      'nuint',
      'void',
    )),

    ref_type: $ => seq(
      'ref',
      optional('readonly'),
      field('type', $.type),
    ),

    _ref_base_type: $ => choice(
      $.implicit_type,
      $._name,
      $.nullable_type,
      $.array_type,
      $.pointer_type,
      $.function_pointer_type,
      $.predefined_type,
      $.tuple_type,
    ),

    scoped_type: $ => seq(
      'scoped',
      field('type', $._scoped_base_type),
    ),

    _scoped_base_type: $ => choice(
      $._name,
      $.ref_type,
    ),

    tuple_type: $ => seq(
      '(',
      commaSep2($.tuple_element),
      ')',
    ),

    tuple_element: $ => seq(
      field('type', $.type),
      field('name', optional($.identifier)),
    ),

    statement: $ => prec(1, choice(
      $.block,
      $.break_statement,
      $.checked_statement,
      $.continue_statement,
      $.do_statement,
      $.empty_statement,
      $.expression_statement,
      $.fixed_statement,
      $.for_statement,
      $.return_statement,
      $.lock_statement,
      $.yield_statement,
      $.switch_statement,
      $.throw_statement,
      $.try_statement,
      $.unsafe_statement,
      $.using_statement,
      $.foreach_statement,
      $.goto_statement,
      $.labeled_statement,
      $.if_statement,
      $.while_statement,
      $.local_declaration_statement,
      $.local_function_statement,
    )),

    break_statement: _ => seq('break', ';'),

    checked_statement: $ => seq(choice('checked', 'unchecked'), $.block),

    continue_statement: _ => seq('continue', ';'),

    do_statement: $ => seq(
      'do',
      field('body', $.statement),
      'while',
      $._parenthesized_condition,
      ';',
    ),

    empty_statement: _ => ';',

    expression_statement: $ => seq(
      choice(
        $._expression_statement_expression,
        $.invocation_expression,
        alias($._var_deconstruction_assignment, $.assignment_expression),
        // `a?.b();` is a call statement, with the call inside the access.
        $.conditional_access_expression,
      ),
      ';',
    ),

    fixed_statement: $ => seq('fixed', '(', $.variable_declaration, ')', $.statement),

    for_statement: $ => seq(
      'for',
      $._for_statement_conditions,
      field('body', $.statement),
    ),

    _for_statement_conditions: $ => seq(
      '(',
      field('initializer', optional($._for_statement_initializer)),
      ';',
      field('condition', optional($.expression)),
      ';',
      $._for_update,
    ),

    _for_update: $ => seq(
      field('update', optional(commaSep1($.expression))),
      ')',
    ),

    _for_statement_initializer: $ => choice(
      $.variable_declaration,
      alias($._var_deconstruction_assignment, $.assignment_expression),
      commaSep1($.expression),
    ),

    return_statement: $ => seq(
      'return',
      optional($.expression),
      ';',
    ),

    lock_statement: $ => seq('lock', '(', $.expression, ')', $.statement),

    yield_statement: $ => seq(
      'yield',
      choice(
        seq('return', $.expression),
        'break',
      ),
      ';',
    ),

    switch_statement: $ => seq(
      'switch',
      choice(
        seq(
          '(',
          field('value', $.expression),
          ')',
        ),
        field('value', $.tuple_expression),
      ),
      field('body', $.switch_body),
    ),

    switch_body: $ => seq('{', repeat($.switch_section), '}'),

    switch_section: $ => prec.left(seq(
      choice(
        seq(
          'case',
          choice(
            $._case_expression,
            seq($.pattern, optional($.when_clause)),
          ),
        ),
        'default',
      ),
      ':',
      repeat($.statement),
    )),

    // Only for what a pattern cannot express: `case A | B:` is a pattern. A rule
    // of its own settles this at the `:` rather than at the end of the section.
    _case_expression: $ => prec.dynamic(-2, $.expression),

    throw_statement: $ => seq('throw', optional($.expression), ';'),

    try_statement: $ => seq(
      'try',
      field('body', $.block),
      repeat($.catch_clause),
      optional($.finally_clause),
    ),

    catch_clause: $ => seq(
      'catch',
      repeat(choice($.catch_declaration, $.catch_filter_clause)),
      field('body', $.block),
    ),

    catch_declaration: $ => seq(
      '(',
      field('type', $.type),
      optional(field('name', $.identifier)),
      ')',
    ),

    catch_filter_clause: $ => seq('when', '(', $.expression, ')'),

    finally_clause: $ => seq('finally', $.block),

    unsafe_statement: $ => seq('unsafe', $.block),

    using_statement: $ => seq(
      optional('await'),
      'using',
      '(',
      choice(
        alias($.using_variable_declaration, $.variable_declaration),
        $.expression,
      ),
      ')',
      field('body', $.statement),
    ),

    foreach_statement: $ => seq(
      $._foreach_statement_initializer,
      field('body', $.statement),
    ),

    _foreach_statement_initializer: $ => seq(
      optional('await'),
      'foreach',
      '(',
      $._foreach_target,
      'in',
      field('right', $.expression),
      ')',
    ),

    _foreach_target: $ => choice(
      seq(
        field('type', $.type),
        field('left', $.identifier),
      ),
      // `foreach (var (k, v) in d)` declares, unlike the call `var(k, v)`.
      field('left', prec.dynamic(2, alias($._var_deconstruction, $.declaration_expression))),
      field('left', $.expression),
    ),

    goto_statement: $ => seq(
      'goto',
      optional(choice('case', 'default')),
      optional($.expression),
      ';',
    ),

    labeled_statement: $ => seq(
      $.identifier,
      ':',
      $.statement,
    ),

    if_statement: $ => prec.right(seq(
      'if',
      $._parenthesized_condition,
      field('consequence', $.statement),
      optional(choice(
        seq(
          'else',
          field('alternative', $.statement),
        ),
      )),
    )),

    _parenthesized_condition: $ => seq(
      '(',
      field('condition', $.expression),
      ')',
    ),

    while_statement: $ => seq(
      'while',
      $._parenthesized_condition,
      field('body', $.statement),
    ),

    local_declaration_statement: $ => seq(
      optional('await'),
      optional('using'),
      repeat($.modifier),
      $.variable_declaration,
      ';',
    ),

    local_function_statement: $ => seq(
      $._local_function_declaration,
      repeat($.type_parameter_constraints_clause),
      $._function_body,
    ),

    _local_function_declaration: $ => seq(
      repeat($.attribute_list),
      repeat($.modifier),
      field('type', $.type),
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter_list)),
      field('parameters', $.parameter_list),
    ),

    pattern: $ => choice(
      $.constant_pattern,
      $.declaration_pattern,
      $.discard,
      $.recursive_pattern,
      $.var_pattern,
      $.negated_pattern,
      // This must come before plain parenthesized_pattern to create GLR conflict
      prec.dynamic(1, alias($._parenthesized_pattern_with_designation, $.recursive_pattern)),
      $.parenthesized_pattern,
      $.relational_pattern,
      $.or_pattern,
      $.and_pattern,
      $.list_pattern,
      $.type_pattern,
    ),

    // Uses '(' pattern ')' to create direct conflict with parenthesized_pattern
    _parenthesized_pattern_with_designation: $ => seq(
      '(',
      $.pattern,
      ')',
      $._variable_designation,
    ),

    // After `is`, a bare name is read as a type (see `is_expression`). Anything
    // binding tighter than `is` keeps the name inside the constant, so these
    // alternatives outrank `is_expression`: `x is A + 1`, `x is A.B()`, `x is A!`,
    // `x is a?.B()`.
    // A looser operator is only part of the constant when it cannot apply to the
    // whole `is` expression: `case A | B:`, but `(x is null) || y`.
    constant_pattern: $ => choice(
      prec.dynamic(-1, alias($._loose_binary_expression, $.binary_expression)),
      prec.dynamic(2, alias($._tight_binary_expression, $.binary_expression)),
      $.checked_expression,
      $.default_expression,
      $.interpolated_string_expression,
      $.parenthesized_expression,
      prec.dynamic(2, $.postfix_unary_expression),
      $.prefix_unary_expression,
      $.sizeof_expression,
      $.tuple_expression,
      $.typeof_expression,
      $.member_access_expression,
      prec.dynamic(2, $.conditional_access_expression),
      prec.dynamic(2, alias($._name_invocation_pattern, $.invocation_expression)),
      prec.dynamic(2, alias($._complex_invocation_expression, $.invocation_expression)),
      $.cast_expression,
      $._simple_name,
      $.literal,
    ),

    // The binary operators that bind tighter than `is`.
    _tight_binary_expression: $ => choice(
      ...[
        ['>>', PREC.SHIFT],
        ['>>>', PREC.SHIFT],
        ['<<', PREC.SHIFT],
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULT],
        ['/', PREC.MULT],
        ['%', PREC.MULT],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        )),
      ),
    ),

    // Invocation with name - creates conflict with recursive_pattern's Name(positional_pattern_clause)
    _name_invocation_pattern: $ => seq(
      field('function', $._name),
      field('arguments', $.argument_list),
    ),

    // Invocation where function is not a simple name
    _complex_invocation_expression: $ => prec(PREC.INVOCATION, seq(
      field('function', choice(
        $.member_access_expression,
        $.element_access_expression,
        $.invocation_expression,
        $.parenthesized_expression,
        $.cast_expression,
      )),
      field('arguments', $.argument_list),
    )),

    discard: _ => '_',

    parenthesized_pattern: $ => seq('(', $.pattern, ')'),

    var_pattern: $ => seq('var', $._variable_designation),

    // Precedence above _variable_designation so `case int when x:` reduces
    // to a type pattern before `when` instead of using `when` as a name.
    type_pattern: $ => prec.right(2, field('type', $.type)),

    // The designation-less form outranks the one with a designation so that, on
    // `when`, the parser reduces here and lets `when_clause` take it instead of
    // reading `when` as the designation: `[var a] when Is(a) => ...`.
    list_pattern: $ => choice(
      prec.right(2, $._list_pattern_body),
      prec.right(1, seq($._list_pattern_body, $._variable_designation)),
    ),

    _list_pattern_body: $ => seq(
      '[',
      optional(seq(
        commaSep1(choice($.pattern, $.slice_pattern)),
        optional(','),
      )),
      ']',
    ),

    // C# 11 slice pattern: `..` optionally followed by a subpattern that
    // binds the captured slice. `[a, .. var rest, z]`, `[..]` (bare),
    // `[.. List<int> rest]` (declaration_pattern), etc.
    slice_pattern: $ => choice(
      prec(PREC.RANGE + 1, '..'),
      prec.right(seq('..', $.pattern)),
    ),

    recursive_pattern: $ => prec.left(choice(
      // name followed by positional pattern WITH variable designation
      prec.dynamic(1, seq(
        field('type', $._name),
        $.positional_pattern_clause,
        optional($.property_pattern_clause),
        $._variable_designation,
      )),
      // name followed by positional pattern WITHOUT variable designation
      prec.dynamic(-1, seq(
        field('type', $._name),
        $.positional_pattern_clause,
        optional($.property_pattern_clause),
      )),
      // positional pattern with variable designation (no type prefix)
      prec.dynamic(1, seq(
        $.positional_pattern_clause,
        $._variable_designation,
      )),
      // positional pattern without variable designation (no type prefix)
      $.positional_pattern_clause,
      // other type followed by pattern clauses (type is required here to avoid ambiguity)
      seq(
        field('type', $.type),
        choice(
          seq(
            $.positional_pattern_clause,
            optional($.property_pattern_clause),
          ),
          $.property_pattern_clause,
        ),
        optional($._variable_designation),
      ),
      // no type, just pattern clauses (no variable designation to avoid conflict with above)
      seq(
        choice(
          seq(
            $.positional_pattern_clause,
            $.property_pattern_clause,
          ),
          $.property_pattern_clause,
        ),
        optional($._variable_designation),
      ),
    )),

    positional_pattern_clause: $ => prec(1, seq(
      '(',
      optional(commaSep($.subpattern)),
      ')',
    )),

    property_pattern_clause: $ => prec(1, seq(
      '{',
      commaSep($.subpattern),
      optional(','),
      '}',
    )),

    subpattern: $ => prec.right(seq(
      optional(
        choice(
          seq($.expression, ':'),
          seq($.identifier, ':'),
        ),
      ),
      $.pattern,
    )),

    // The operand ends at the first operator that does not bind tighter than a
    // comparison: `x is > 1 && y` is `(x is > 1) && y`.
    relational_pattern: $ => prec.left(PREC.REL, choice(
      seq('<', $.expression),
      seq('<=', $.expression),
      seq('>', $.expression),
      seq('>=', $.expression),
    )),

    negated_pattern: $ => seq('not', $.pattern),

    and_pattern: $ => prec.left(PREC.AND, seq(
      field('left', $.pattern),
      field('operator', 'and'),
      field('right', $.pattern),
    )),

    or_pattern: $ => prec.left(PREC.OR, seq(
      field('left', $.pattern),
      field('operator', 'or'),
      field('right', $.pattern),
    )),

    declaration_pattern: $ => seq(
      field('type', $.type),
      $._variable_designation,
    ),

    _variable_designation: $ => prec(1, choice(
      $.discard,
      $.parenthesized_variable_designation,
      field('name', $.identifier),
    )),

    parenthesized_variable_designation: $ => seq(
      '(',
      commaSep($._variable_designation),
      ')',
    ),

    expression: $ => choice(
      $.non_lvalue_expression,
      $.lvalue_expression,
    ),

    non_lvalue_expression: $ => choice(
      'base',
      $.binary_expression,
      $.interpolated_string_expression,
      $.conditional_expression,
      $.conditional_access_expression,
      $.literal,
      $._expression_statement_expression,
      $.is_expression,
      $.is_pattern_expression,
      $.as_expression,
      $.cast_expression,
      $.checked_expression,
      $.collection_expression,
      $.switch_expression,
      $.throw_expression,
      $.default_expression,
      $.lambda_expression,
      $.with_expression,
      $.sizeof_expression,
      $.typeof_expression,
      $.makeref_expression,
      $.ref_expression,
      // Address-of (see `_address_of_expression` below): aliased to
      // `prefix_unary_expression` to preserve the public AST shape.
      // Parallels `_pointer_indirection_expression` (the `*` operator),
      // which is similarly aliased back into `lvalue_expression`.
      alias($._address_of_expression, $.prefix_unary_expression),
      $.reftype_expression,
      $.refvalue_expression,
      $.stackalloc_expression,
      $.range_expression,
      $.array_creation_expression,
      $.anonymous_method_expression,
      $.anonymous_object_creation_expression,
      $.implicit_array_creation_expression,
      $.implicit_object_creation_expression,
      $.implicit_stackalloc_expression,
      $.initializer_expression,
      $.query_expression,
    ),

    lvalue_expression: $ => choice(
      'this',
      $.member_access_expression,
      $.tuple_expression,
      $._simple_name,
      $.element_access_expression,
      // Yields to a collection expression: `a ? [1] : [2]`.
      prec.dynamic(-1, alias($.bracketed_argument_list, $.element_binding_expression)),
      alias($._pointer_indirection_expression, $.prefix_unary_expression),
      alias($._parenthesized_lvalue_expression, $.parenthesized_expression),
      // A method that returns by reference can be assigned to: `Unsafe.Add(ref x, i) = v`.
      $.invocation_expression,
      // C# 14 null-conditional assignment: `obj?.x = v`, `obj?[i] = v`.
      // https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-14#null-conditional-assignment
      $.conditional_access_expression,
    ),

    // Covers error CS0201: Only assignment, call, increment, decrement, await, and new object expressions can be used as a statement
    _expression_statement_expression: $ => choice(
      $.assignment_expression,
      $.postfix_unary_expression,
      $.prefix_unary_expression,
      $.await_expression,
      $.object_creation_expression,
      $.parenthesized_expression,
    ),

    assignment_expression: $ => seq(
      field('left', $.lvalue_expression),
      field('operator',
        choice(
          '=',
          '+=',
          '-=',
          '*=',
          '/=',
          '%=',
          '&=',
          '^=',
          '|=',
          '<<=',
          '>>=',
          '>>>=',
          '??=',
        ),
      ),
      field('right', $.expression),
    ),

    binary_expression: $ => choice(
      $._tight_binary_expression,
      $._loose_binary_expression,
    ),

    // The binary operators that do not bind tighter than `is`.
    _loose_binary_expression: $ => choice(
      ...[
        ['&&', PREC.LOGICAL_AND],
        ['||', PREC.LOGICAL_OR],
        ['&', PREC.AND],
        ['^', PREC.XOR],
        ['|', PREC.OR],
        [choice('<', alias($._less_than, '<')), PREC.REL],
        ['<=', PREC.REL],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>=', PREC.REL],
        ['>', PREC.REL],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        )),
      ),
      prec.right(PREC.COALESCING, seq(
        field('left', $.expression),
        field('operator', '??'),
        field('right', $.expression),
      )),
    ),

    postfix_unary_expression: $ => prec(PREC.POSTFIX, seq(
      $.expression,
      choice('++', '--', '!'),
    )),

    prefix_unary_expression: $ => prec(PREC.UNARY, seq(
      // `&` and `*` are intentionally NOT in this choice list:
      //   * `&` → `_address_of_expression` (operand restricted to lvalue
      //           — see comment on that rule for the #413 rationale)
      //   * `*` → `_pointer_indirection_expression` (same shape,
      //           restricted to lvalue, surfaced in `lvalue_expression`)
      // Both are aliased back to `prefix_unary_expression` so the
      // public AST is unaffected.
      choice('++', '--', '+', '-', '!', '~', '^'),
      $.expression,
    )),

    _pointer_indirection_expression: $ => prec.right(PREC.UNARY, seq(
      '*',
      choice(
        $.lvalue_expression,
        // `*(p + 1)` and `*(T*)p`. The operand is not an lvalue, so the #413
        // restriction above shut them out. They stay legal here, but with a
        // negative dynamic precedence so `(a) * (b + c)` still reads as a
        // multiplication rather than a cast of a dereference.
        prec.dynamic(-2, $.parenthesized_expression),
        prec.dynamic(-2, alias($._pointer_cast_expression, $.cast_expression)),
      ),
    )),

    _pointer_cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.pointer_type),
      ')',
      // Not a full `expression`: `*(T*)p = 1` must stay an assignment to the
      // dereference, not a cast of `p = 1`.
      field('value', choice(
        $.lvalue_expression,
        $.parenthesized_expression,
        alias($._address_of_expression, $.prefix_unary_expression),
      )),
    )),

    // Address-of is split out from `prefix_unary_expression` so that
    // `&` can't act as a fallback when the lexer would otherwise
    // emit `&&`. Its operand is restricted to an lvalue (same shape
    // as the spec's `address-of-expression`). This is the fix for
    // tree-sitter#413: `(a) && (b > 0)` was misparsed as
    // `cast(a, &(&(b > 0)))` because the cast state accepted `&` as
    // a unary start and the lexer split `&&` into two `&` tokens.
    // With this split, `&` is only valid before an lvalue, which
    // `(b > 0)` is not — so the cast interpretation can no longer
    // consume the trailing parenthesized expression and `&&` must
    // be emitted as a single token for the binary path to succeed.
    _address_of_expression: $ => prec.right(PREC.UNARY, seq(
      '&',
      $.lvalue_expression,
    )),

    query_expression: $ => seq($.from_clause, $._query_body),

    from_clause: $ => seq(
      'from',
      optional(field('type', $.type)),
      field('name', $.identifier),
      'in',
      $.expression,
    ),

    _query_body: $ => prec.right(sep1(
      seq(
        repeat($._query_clause),
        $._select_or_group_clause,
      ),
      seq('into', $.identifier),
    )),

    _query_clause: $ => choice(
      $.from_clause,
      $.join_clause,
      $.let_clause,
      $.order_by_clause,
      $.where_clause,
    ),

    join_clause: $ => seq(
      'join',
      $._join_header,
      $._join_body,
      optional($.join_into_clause),
    ),

    _join_header: $ => seq(optional(field('type', $.type)), $.identifier, 'in', $.expression),

    _join_body: $ => seq('on', $.expression, 'equals', $.expression),

    join_into_clause: $ => seq('into', $.identifier),

    let_clause: $ => seq(
      'let',
      $.identifier,
      '=',
      $.expression,
    ),

    order_by_clause: $ => seq(
      'orderby',
      commaSep1($._ordering),
    ),

    _ordering: $ => seq(
      $.expression,
      optional(choice('ascending', 'descending')),
    ),

    where_clause: $ => seq('where', $.expression),

    _select_or_group_clause: $ => choice(
      $.group_clause,
      $.select_clause,
    ),

    group_clause: $ => seq('group', $.expression, 'by', $.expression),

    select_clause: $ => seq('select', $.expression),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $.expression),
      '?',
      field('consequence', $._conditional_consequence),
      ':',
      field('alternative', $.expression),
    )),

    _conditional_consequence: $ => $.expression,

    conditional_access_expression: $ => conditionalAccessRule(
      $,
      $.expression,
      PREC.DOT,
      PREC.CONDITIONAL,
    ),

    // Everything after the `?` is skipped when the condition is null, so the
    // whole chain belongs to the conditional access: `a?.b.c()` applies `.c()`
    // to the binding `.b`, not to the result of `a?.b`.
    // A further `?` nests to the right, so a conditional access is only ever the
    // last part of a chain: `a?[0]?[1].c()` is `a?([0]?([1].c()))`.
    _conditional_binding: $ => choice(
      $._conditional_binding_chain,
      alias($._conditional_binding_conditional_access, $.conditional_access_expression),
    ),

    _conditional_binding_chain: $ => choice(
      $.member_binding_expression,
      prec(PREC.DOT, alias($.bracketed_argument_list, $.element_binding_expression)),
      alias($._conditional_binding_member_access, $.member_access_expression),
      alias($._conditional_binding_invocation, $.invocation_expression),
      alias($._conditional_binding_element_access, $.element_access_expression),
    ),

    // A `!` is only part of the chain when the chain continues after it:
    // `a?.b!.c` keeps it inside, while `a?.b!` applies it to the whole access.
    _conditional_binding_operand: $ => choice(
      $._conditional_binding_chain,
      alias($._conditional_binding_null_forgiving, $.postfix_unary_expression),
    ),

    _conditional_binding_member_access: $ => prec(PREC.CONDITIONAL_BINDING, seq(
      field('expression', $._conditional_binding_operand),
      '.',
      field('name', $._simple_name),
    )),

    _conditional_binding_invocation: $ => prec(PREC.CONDITIONAL_BINDING, seq(
      field('function', $._conditional_binding_operand),
      field('arguments', $.argument_list),
    )),

    _conditional_binding_element_access: $ => prec(PREC.CONDITIONAL_BINDING, seq(
      field('expression', $._conditional_binding_operand),
      field('subscript', $.bracketed_argument_list),
    )),

    _conditional_binding_null_forgiving: $ => prec.dynamic(1, prec(PREC.DOT, seq(
      $._conditional_binding_operand,
      '!',
    ))),

    // `a?[0]?[1]` could also end the access after `[0]` and use it as the
    // condition of the next one. Continuing the chain wins.
    _conditional_binding_conditional_access: $ => prec.dynamic(1, conditionalAccessRule(
      $,
      $._conditional_binding_operand,
      PREC.CONDITIONAL_BINDING,
      PREC.DOT,
    )),

    as_expression: $ => prec(PREC.REL, seq(
      field('left', $.expression),
      field('operator', 'as'),
      field('right', $.type),
    )),

    // Outranks a constant pattern so that `x is A`, `x is A.B` and `x is A<T>` are
    // type tests. As in Roslyn, a name that is really a constant parses this way too.
    is_expression: $ => prec(PREC.REL, prec.dynamic(1, seq(
      field('left', $.expression),
      field('operator', 'is'),
      field('right', $.type),
    ))),

    is_pattern_expression: $ => prec(PREC.REL, seq(
      field('expression', $.expression),
      'is',
      field('pattern', $.pattern),
    )),

    cast_expression: $ => prec(PREC.CAST, prec.dynamic(1, seq( // higher than invocation, lower than binary
      '(',
      field('type', $.type),
      ')',
      field('value', $.expression),
    ))),

    checked_expression: $ => seq(
      choice('checked', 'unchecked'),
      '(',
      $.expression,
      ')',
    ),

    invocation_expression: $ => prec(PREC.INVOCATION, seq(
      field('function', $.expression),
      field('arguments', $.argument_list),
    )),

    switch_expression: $ => prec(PREC.SWITCH, seq(
      $.expression,
      'switch',
      $._switch_expression_body,
    )),
    _switch_expression_body: $ => seq(
      '{',
      commaSep($.switch_expression_arm),
      optional(','),
      '}',
    ),


    switch_expression_arm: $ => seq(
      $.pattern,
      optional($.when_clause),
      $._switch_expression_arm_tail,
    ),

    _switch_expression_arm_tail: $ => seq(
      '=>',
      $.expression,
    ),

    when_clause: $ => seq('when', $.expression),

    await_expression: $ => prec.right(PREC.UNARY, seq(
      'await',
      $.expression,
    )),

    throw_expression: $ => seq('throw', $.expression),

    element_access_expression: $ => prec(PREC.POSTFIX, seq(
      field('expression', $.expression),
      field('subscript', $.bracketed_argument_list),
    )),

    interpolated_string_expression: $ => choice(
      seq(
        alias($.interpolation_regular_start, $.interpolation_start),
        alias($.interpolation_start_quote, '"'),
        repeat($._interpolated_string_content),
        alias($.interpolation_end_quote, '"'),
      ),
      seq(
        alias($.interpolation_verbatim_start, $.interpolation_start),
        alias($.interpolation_start_quote, '"'),
        repeat($._interpolated_unescaped_string_content),
        alias($.interpolation_end_quote, '"'),
      ),
      seq(
        alias($.interpolation_raw_start, $.interpolation_start),
        alias($.interpolation_start_quote, $.interpolation_quote),
        repeat($._interpolated_unescaped_string_content),
        alias($.interpolation_end_quote, $.interpolation_quote),
      ),
    ),

    _interpolated_string_content: $ => choice(
      alias($.interpolation_string_content, $.string_content),
      $.escape_sequence,
      $.interpolation,
    ),

    _interpolated_unescaped_string_content: $ => choice(
      alias($.interpolation_string_content, $.string_content),
      $.interpolation,
    ),

    interpolation: $ => seq(
      alias($.interpolation_open_brace, $.interpolation_brace),
      $.expression,
      optional($.interpolation_alignment_clause),
      optional($.interpolation_format_clause),
      alias($.interpolation_close_brace, $.interpolation_brace),
    ),

    interpolation_alignment_clause: $ => seq(',', $.expression),

    interpolation_format_clause: _ => seq(':', /[^}"]+/),

    member_access_expression: $ => prec(PREC.DOT, seq(
      field('expression', choice($.expression, $.predefined_type, $._name)),
      choice('.', '->'),
      field('name', $._simple_name),
    )),

    member_binding_expression: $ => seq(
      '.',
      field('name', $._simple_name),
    ),

    object_creation_expression: $ => prec.right(seq(
      'new',
      field('type', $.type),
      field('arguments', optional($.argument_list)),
      field('initializer', optional($.initializer_expression)),
    )),

    // inline
    _object_creation_type: $ => choice(
      $._name,
      $.nullable_type,
      $.predefined_type,
    ),

    parenthesized_expression: $ => seq(
      '(',
      $.non_lvalue_expression,
      ')',
    ),

    _parenthesized_lvalue_expression: $ => seq('(', $.lvalue_expression, ')'),

    lambda_expression: $ => prec(-1, seq(
      $._lambda_expression_init,
      '=>',
      field('body', choice($.block, $.expression)),
    )),

    _lambda_expression_init: $ => prec(-1, seq(
      repeat($.attribute_list),
      repeat(prec(-1, alias(choice('static', 'async'), $.modifier))),
      optional(field('type', $.type)),
      field('parameters', $._lambda_parameters),
    ),
    ),

    _lambda_parameters: $ => prec(-1, choice(
      $.parameter_list,
      alias($.identifier, $.implicit_parameter),
      // C# 14: `(ref x) => x`, `(out y) => ...`, `(text, out result) => ...`
      // The opening '(' is recognized via the external _lambda_paren_open
      // token, which the scanner only emits when it can confirm a closing
      // ')=>' follows a parameter list containing at least one modifier.
      $._implicit_parameter_list_with_modifiers,
    )),

    // C# 14 simple-lambda parameter list with modifiers. Each element is
    // either a bare identifier or one or more modifiers (scoped/ref/out/in/
    // readonly) followed by an identifier. The opening token is the
    // external _lambda_paren_open; the closing ')' is the regular literal.
    _implicit_parameter_list_with_modifiers: $ => seq(
      $._lambda_paren_open,
      commaSep1(choice(
        seq(
          repeat1(alias(
            choice('scoped', 'ref', 'out', 'in', 'readonly'),
            $.modifier,
          )),
          alias($.identifier, $.implicit_parameter),
        ),
        alias($.identifier, $.implicit_parameter),
      )),
      ')',
    ),

    array_creation_expression: $ => prec.dynamic(PREC.UNARY, seq(
      'new',
      field('type', $.array_type),
      optional($.initializer_expression),
    )),

    anonymous_method_expression: $ => seq(
      repeat(prec(-1, alias(choice('static', 'async'), $.modifier))),
      'delegate',
      optional(field('parameters', $.parameter_list)),
      $.block,
    ),

    anonymous_object_creation_expression: $ => seq(
      'new',
      '{',
      commaSep($._anonymous_object_member_declarator),
      optional(','),
      '}',
    ),

    _anonymous_object_member_declarator: $ => choice(
      seq($.identifier, '=', $.expression),
      $.expression,
    ),

    implicit_array_creation_expression: $ => seq(
      'new',
      '[',
      repeat(','),
      ']',
      $.initializer_expression,
    ),

    implicit_object_creation_expression: $ => prec.right(seq(
      'new',
      $.argument_list,
      optional($.initializer_expression),
    )),

    implicit_stackalloc_expression: $ => seq(
      'stackalloc',
      '[',
      ']',
      $.initializer_expression,
    ),

    collection_expression: $ => seq(
      '[',
      optional($._collection_items),
      ']',
    ),

    _collection_items: $ => choice(
      seq(
        repeat1(seq($.collection_element, ',')),
        optional($.collection_element),
      ),
      $.collection_element,
    ),

    collection_element: $ => choice(
      $.expression_element,
      $.spread_element,
    ),

    expression_element: $ => prec(1, $.expression),

    spread_element: $ => prec.dynamic(1, prec(PREC.RANGE, seq('..', $.expression))),

    initializer_expression: $ => seq(
      '{',
      optional($._initializer_items),
      '}',
    ),

    _initializer_items: $ => choice(
      seq(
        repeat1(seq($.expression, ',')),
        optional($.expression),
      ),
      $.expression,
    ),

    declaration_expression: $ => prec.dynamic(1, seq(
      field('type', $.type),
      field('name', $.identifier),
    )),

    // Roslyn reads `var (a, b)` as a declaration expression whose designation
    // lists the new variables.
    // `var (a, b) = t` declares new variables. It is only read this way as a
    // whole statement, a `for` initializer or a `foreach` target, so in any
    // other expression `var(a, b)` stays a call to a method named `var`.
    _var_deconstruction_assignment: $ => prec.dynamic(3, seq(
      field('left', alias($._var_deconstruction, $.declaration_expression)),
      field('operator', '='),
      field('right', $.expression),
    )),

    _var_deconstruction: $ => seq(
      field('type', $.implicit_type),
      $.parenthesized_variable_designation,
    ),

    default_expression: $ => prec.right(seq(
      'default',
      optional(seq(
        '(',
        field('type', $.type),
        ')',
      )),
    )),

    with_expression: $ => prec.left(PREC.WITH, seq(
      $.expression,
      'with',
      $._with_body,
    )),
    _with_body: $ => seq(
      '{',
      commaSep($.with_initializer),
      optional(','),
      '}',
    ),

    with_initializer: $ => seq($.identifier, $._variable_initializer),

    sizeof_expression: $ => seq(
      'sizeof',
      '(',
      field('type', $.type),
      ')',
    ),

    typeof_expression: $ => seq(
      'typeof',
      '(',
      field('type', $.type),
      ')',
    ),

    makeref_expression: $ => seq(
      '__makeref',
      '(',
      $.expression,
      ')',
    ),

    ref_expression: $ => seq('ref', $.expression),

    reftype_expression: $ => seq(
      '__reftype',
      '(',
      $.expression,
      ')',
    ),

    refvalue_expression: $ => seq(
      '__refvalue',
      '(',
      field('value', $.expression),
      ',',
      field('type', $.type),
      ')',
    ),

    stackalloc_expression: $ => prec.left(seq(
      'stackalloc',
      field('type', $.array_type),
      optional($.initializer_expression),
    )),

    range_expression: $ => prec.right(PREC.RANGE, seq(
      optional($.expression),
      '..',
      optional($.expression),
    )),

    tuple_expression: $ => seq(
      '(',
      commaSep2(alias($._tuple_argument, $.argument)),
      ')',
    ),

    literal: $ => choice(
      $.null_literal,
      $.character_literal,
      $.integer_literal,
      $.real_literal,
      $.boolean_literal,
      $.string_literal,
      $.verbatim_string_literal,
      $.raw_string_literal,
    ),

    null_literal: _ => 'null',

    character_literal: $ => seq(
      '\'',
      choice($.character_literal_content, $.escape_sequence),
      '\'',
    ),

    character_literal_content: $ => token.immediate(/[^'\\]/),

    integer_literal: _ => token(seq(
      choice(
        decimalDigitSequence, // Decimal
        (/0[xX][0-9a-fA-F_]*[0-9a-fA-F]+/), // Hex
        (/0[bB][01_]*[01]+/), // Binary
      ),
      optional(/([uU][lL]?|[lL][uU]?)/),
    )),

    real_literal: _ => {
      const suffix = /[fFdDmM]/;
      const exponent = /[eE][+-]?[0-9][0-9_]*/;
      return token(choice(
        seq(
          decimalDigitSequence,
          '.',
          decimalDigitSequence,
          optional(exponent),
          optional(suffix),
        ),
        seq(
          '.',
          decimalDigitSequence,
          optional(exponent),
          optional(suffix),
        ),
        seq(
          decimalDigitSequence,
          exponent,
          optional(suffix),
        ),
        seq(
          decimalDigitSequence,
          suffix,
        ),
      ));
    },

    string_literal: $ => seq(
      '"',
      repeat(choice(
        $.string_literal_content,
        $.escape_sequence,
        // Never returned. Valid only inside a string (and after `_skipped_text_hazard`), so
        // the scanner knows that a `/*` here is string content, not a comment to check.
        $._skipped_text_never,
      )),
      '"',
      optional($.string_literal_encoding),
    ),

    string_literal_content: _ => token.immediate(prec(1, /[^"\\\n]+/)),

    escape_sequence: _ => token(choice(
      /\\x[0-9a-fA-F]{1,4}/,
      /\\u[0-9a-fA-F]{4}/,
      /\\U[0-9a-fA-F]{8}/,
      /\\[abefnrtv'\"\\\?0]/,
    )),

    string_literal_encoding: _ => token.immediate(stringEncoding),

    verbatim_string_literal: _ => token(seq(
      '@"',
      repeat(choice(
        /[^"]/,
        '""',
      )),
      '"',
      optional(stringEncoding),
    )),

    raw_string_literal: $ => seq(
      $.raw_string_start,
      $.raw_string_content,
      $.raw_string_end,
      optional(stringEncoding),
    ),

    boolean_literal: _ => choice('true', 'false'),

    _identifier_token: _ => token(seq(optional('@'), /(\p{XID_Start}|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/)),
    identifier: $ => choice(
      $._identifier_token,
      $._reserved_identifier,
    ),

    _reserved_identifier: _ => choice(
      'alias',
      'ascending',
      'by',
      'descending',
      'equals',
      // attribute_target_specifier keywords — contextual only when followed
      // by `:` in `[target: Attr]` position. Anywhere else they're
      // identifiers. Without listing them here the LR table preferred the
      // literal-keyword interpretation, breaking `[type]`, `[field]`, etc.
      // as collection_expression elements. Excludes `'event'` and `'return'`
      // from the attribute_target_specifier choice — those are real C#
      // keywords and must not be accepted as identifiers anywhere else.
      'field',
      'file',
      'from',
      'global',
      'group',
      'into',
      'join',
      'let',
      'method',
      'notnull',
      'on',
      'orderby',
      'param',
      // Contextual keywords that are ordinary names outside their construct:
      // `var with = ...` (with-expressions), `var partial = ...` (partial types),
      // `required = 0;` (required members) and `record r = new record();`
      // (records). Where both readings parse, as in `public partial C(int x);`,
      // the modifier or declaration reading wins.
      prec.dynamic(-1, 'partial'),
      'property',
      prec.dynamic(-1, 'record'),
      prec.dynamic(-1, 'required'),
      'scoped',
      'select',
      'type',
      'typevar',
      'unmanaged',
      'var',
      'when',
      'where',
      'with',
      'yield',
    ),

    // Preprocessor
    //
    // Every directive line is an extra. tree-sitter gives each extra symbol an entry
    // in every parse state, so all directive rules sit under this one hidden extra,
    // which starts with a shared `#`. Its low precedence lets character and string
    // content such as `'#'` win. The external scanner ends each directive line
    // (`_preproc_newline`) and emits everything from an `#elif` or `#else` up to
    // the matching `#endif` as one `preproc_else` token, so only the first branch
    // of a conditional is parsed as code.

    _preproc_directive: $ => choice(
      seq(alias(token(prec(-1, '#')), '#'), choice(
        $.preproc_region,
        $.preproc_endregion,
        $.preproc_line,
        $.preproc_pragma,
        $.preproc_nullable,
        $.preproc_error,
        $.preproc_warning,
        $.preproc_define,
        $.preproc_undef,
        $.ignored_directive,
        $.preproc_if,
        $.preproc_endif,
      )),
      // Text that hides a branch-ending directive line: see `_skipped_text_hazard`.
      // Under this extra rather than an extra of its own, which would add an entry to
      // every parse state; it can never complete, so it is always an ERROR.
      seq($._skipped_text_hazard, $._skipped_text_never),
    ),

    // The `#if` line. The code after it is parsed as ordinary code.
    preproc_if: $ => seq(
      'if',
      field('condition', $._preproc_expression),
      $._preproc_if_newline,
    ),

    preproc_endif: $ => seq(
      'endif',
      $._preproc_endif_newline,
    ),


    _preproc_expression: $ => choice(
      $.identifier,
      $.boolean_literal,
      $.integer_literal,
      $.character_literal,
      alias($.preproc_unary_expression, $.unary_expression),
      alias($.preproc_binary_expression, $.binary_expression),
      alias($.preproc_parenthesized_expression, $.parenthesized_expression),
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      $._preproc_expression,
      ')',
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', '!'),
      field('argument', $._preproc_expression),
    )),

    preproc_binary_expression: $ => {
      const table = [
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._preproc_expression),
        ));
      }));
    },

    preproc_region: $ => seq(
      'region',
      optional(field('content', $.preproc_arg)),
      $._preproc_newline,
    ),

    preproc_endregion: $ => seq(
      'endregion',
      optional(field('content', $.preproc_arg)),
      $._preproc_newline,
    ),

    // A file name has no escape sequences: `"C:\dir\"` is complete.
    _preproc_file_name: $ => seq(
      '"',
      // `_skipped_text_never` tells the scanner it is inside a string: see `string_literal`.
      optional(choice(alias(token.immediate(prec(1, /[^"\r\n]+/)), $.string_literal_content), $._skipped_text_never)),
      token.immediate('"'),
    ),

    preproc_line: $ => seq(
      'line',
      choice(
        'default',
        'hidden',
        seq($.integer_literal, optional(alias($._preproc_file_name, $.string_literal))),
        seq(
          '(', $.integer_literal, ',', $.integer_literal, ')',
          '-',
          '(', $.integer_literal, ',', $.integer_literal, ')',
          optional($.integer_literal),
          alias($._preproc_file_name, $.string_literal),
        ),
      ),
      $._preproc_newline,
    ),

    // The compiler warns about, and skips, a pragma it does not know (CS1633),
    // a `warning` without `disable` or `restore` (CS1634) and trailing text
    // (CS1696). That text is kept as `preproc_arg`.
    preproc_pragma: $ => seq(
      'pragma',
      optional(choice(
        seq('warning', optional(choice(
          seq(
            choice('disable', 'restore'),
            commaSep(
              choice(
                $.identifier,
                $.integer_literal,
              )),
            optional(alias($._preproc_trailing_text, $.preproc_arg)),
          ),
          alias($._preproc_pragma_warning_text, $.preproc_arg),
        ))),
        seq(
          'checksum', $.string_literal, $.string_literal, $.string_literal,
          optional(alias($._preproc_trailing_text, $.preproc_arg)),
        ),
        alias($._preproc_pragma_text, $.preproc_arg),
      )),
      $._preproc_newline,
    ),

    preproc_nullable: $ => seq(
      'nullable',
      choice('enable', 'disable', 'restore'),
      optional(choice('annotations', 'warnings')),
      $._preproc_newline,
    ),

    preproc_error: $ => seq(
      'error',
      optional($.preproc_arg),
      $._preproc_newline,
    ),

    preproc_warning: $ => seq(
      'warning',
      optional($.preproc_arg),
      $._preproc_newline,
    ),

    preproc_define: $ => seq(
      'define',
      $.preproc_arg,
      $._preproc_newline,
    ),

    preproc_undef: $ => seq(
      'undef',
      $.preproc_arg,
      $._preproc_newline,
    ),

    shebang_directive: _ => token(seq('#!', /.*/)),

    // C# 14 / .NET 10 file-based apps directives. The compiler ignores them;
    // the .NET SDK reads them. Structure follows the SDK spec:
    // https://github.com/dotnet/sdk/blob/main/documentation/general/dotnet-run-file.md
    //
    //   #:package Name@Version     #:sdk Name@Version     #:property Name=Value
    //   #:project path             #:ref path             #:include glob    ...
    //
    // `package`, `sdk` and `property` split into name, separator and value.
    // Any other kind (including unknown ones) takes the rest of the line as
    // its value. Kinds are immediate tokens only valid right after `#:`, so
    // they never reserve these words elsewhere.
    ignored_directive: $ => seq(
      ':',
      optional(choice(
        seq(
          field('kind', choice(
            alias(token.immediate('package'), $.directive_kind),
            alias(token.immediate('sdk'), $.directive_kind),
            alias(token.immediate('property'), $.directive_kind),
          )),
          optional(seq(
            field('name', $.directive_name),
            optional(field('separator', $.directive_separator)),
            optional(field('value', $.directive_value)),
          )),
        ),
        seq(
          field('kind', alias(token.immediate(/[A-Za-z_][A-Za-z0-9_-]*/), $.directive_kind)),
          optional(field('value', $.directive_value)),
        ),
        // Not a well-formed directive (e.g. `#: package X`): still ignored by
        // the compiler, so keep the rest of the line as an unstructured value.
        field('value', alias(token.immediate(/[ \t]+[^\s\u0085\u2028\u2029]([^\r\n\u0085\u2028\u2029]*[^\s\u0085\u2028\u2029])?/), $.directive_value)),
      )),
      // Like every directive line, it ends at any C# line break, not only `\n`.
      $._preproc_newline,
    ),

    directive_name: _ => token(choice(
      /[^\s@="\u0085\u2028\u2029]+/,
      /"([^"\\\n\u0085\u2028\u2029]|\\.)*"/,
    )),

    // `@` for package/sdk versions, `=` for property values. A dedicated
    // token (rather than reusing the C# `@`/`=` literals) keeps these
    // directives from perturbing GLR tie-breaks elsewhere in the grammar.
    directive_separator: _ => token(/[@=]/),

    directive_value: _ => token(/[^\s@=\u0085\u2028\u2029]([^\r\n\u0085\u2028\u2029]*[^\s\u0085\u2028\u2029])?/),

    comment: _ => token(choice(
      seq('//', /[^\n\r\u0085\u2028\u2029]*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
  },
});

/**
 * Creates an argument, which may declare a variable after `out`
 *
 * @param {GrammarSymbols<string>} $
 *
 * @param {number} declarationPrecedence dynamic precedence of a declaration
 * that does not follow `out`
 *
 * @returns {PrecRule}
 */
function argumentRule($, declarationPrecedence) {
  return prec(1, seq(
    optional(seq(field('name', $.identifier), ':')),
    choice(
      $._out_argument,
      seq(
        optional(choice('ref', 'in')),
        choice($.expression, prec.dynamic(declarationPrecedence, $.declaration_expression)),
      ),
    ),
  ));
}

/**
 * Creates a conditional access on `condition`
 *
 * @param {GrammarSymbols<string>} $
 *
 * @param {Rule} condition
 *
 * @param {number} memberQuestionPrecedence precedence of a `?` that can only
 * start a member binding
 *
 * @param {number} questionPrecedence precedence of a `?` that could also start
 * the branches of a conditional expression
 *
 * @returns {ChoiceRule}
 */
function conditionalAccessRule($, condition, memberQuestionPrecedence, questionPrecedence) {
  return choice(
    seq(
      prec(memberQuestionPrecedence, seq(
        field('condition', condition),
        alias($._conditional_member_question, '?'),
      )),
      prec(PREC.DOT, $._conditional_binding),
    ),
    seq(
      prec(questionPrecedence, seq(field('condition', condition), '?')),
      prec(PREC.DOT, $._conditional_binding),
    ),
  );
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * Creates a rule to match two or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep2(rule) {
  return seq(rule, repeat1(seq(',', rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by `separator`
 *
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @returns {SeqRule}
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by `separator`
 *
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @returns {ChoiceRule}
 */
function sep(rule, separator) {
  return optional(sep1(rule, separator));
}
