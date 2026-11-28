(identifier) @variable

;; Methods

(method_declaration name: (identifier) @function)
(local_function_statement name: (identifier) @function)

;; Types

(interface_declaration name: (identifier) @type)
(class_declaration name: (identifier) @type)
(enum_declaration name: (identifier) @type)
(struct_declaration (identifier) @type)
(record_declaration (identifier) @type)
(union_declaration name: (identifier) @type)
(union_case_list (identifier) @type)
(namespace_declaration name: (identifier) @module)
(file_scoped_namespace_declaration name: (identifier) @module)

;; Fields and properties

(field_declaration (variable_declaration (variable_declarator name: (identifier) @property)))
(property_declaration name: (identifier) @property)

(generic_name (identifier) @type)
(type_parameter name: (identifier) @type)
(parameter type: (identifier) @type)
(type_argument_list (identifier) @type)
(as_expression right: (identifier) @type)
(is_expression right: (identifier) @type)

(constructor_declaration name: (identifier) @constructor)
(destructor_declaration name: (identifier) @constructor)

(_ type: (identifier) @type)
(_ returns: (identifier) @type)

(base_list (identifier) @type)

(predefined_type) @type.builtin

;; Enum
(enum_member_declaration (identifier) @property.definition)

;; Literals

[
  (real_literal)
  (integer_literal)
] @number

[
  (character_literal)
  (string_literal)
  (raw_string_literal)
  (verbatim_string_literal)
  (interpolated_string_expression)
  (interpolation_start)
  (interpolation_quote)
 ] @string

(escape_sequence) @string.escape

[
  (boolean_literal)
  (null_literal)
] @constant.builtin

;; Comments

(comment) @comment

(documentation_comment) @comment.documentation

;; Tokens

[
  ";"
  "."
  ","
] @punctuation.delimiter

[
  "--"
  "-"
  "-="
  "&"
  "&="
  "&&"
  "+"
  "++"
  "+="
  "<"
  "<="
  "<<"
  "<<="
  "="
  "=="
  "!"
  "!="
  "=>"
  ">"
  ">="
  ">>"
  ">>="
  ">>>"
  ">>>="
  "|"
  "|="
  "||"
  "?"
  "??"
  "??="
  "^"
  "^="
  "~"
  "*"
  "*="
  "/"
  "/="
  "%"
  "%="
  ":"
  ".."
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
  (interpolation_brace)
]  @punctuation.bracket

;; Keywords

[
  (modifier)
  "this"
  (implicit_type)
] @keyword

[
  "add"
  "alias"
  "as"
  "base"
  "break"
  "case"
  "catch"
  "checked"
  "class"
  "continue"
  "default"
  "delegate"
  "do"
  "else"
  "enum"
  "event"
  "explicit"
  "extern"
  "finally"
  "for"
  "foreach"
  "global"
  "goto"
  "if"
  "implicit"
  "interface"
  "is"
  "lock"
  "namespace"
  "notnull"
  "operator"
  "params"
  "return"
  "remove"
  "sizeof"
  "stackalloc"
  "static"
  "struct"
  "switch"
  "throw"
  "try"
  "typeof"
  "unchecked"
  "using"
  "while"
  "new"
  "await"
  "in"
  "yield"
  "get"
  "set"
  "when"
  "out"
  "ref"
  "record"
  "union"
  "init"
  "with"
  "unsafe"
] @keyword

;; Query expressions (LINQ). Each keyword is matched only inside its own clause:
;; these words are ordinary identifiers elsewhere (`var from = 1;`), and an
;; identifier named `from` holds a "from" token too.

(from_clause "from" @keyword)
(let_clause "let" @keyword)
(where_clause "where" @keyword)
(join_clause ["join" "on" "equals"] @keyword)
(join_into_clause "into" @keyword)
(order_by_clause ["orderby" "ascending" "descending"] @keyword)
(group_clause ["group" "by"] @keyword)
(select_clause "select" @keyword)
(query_expression "into" @keyword)

(type_parameter_constraints_clause "where" @keyword)

;; Preprocessor directives. The `#` is its own token, matched below with the
;; file-based app directives; each directive's name and options are matched here.

(preproc_if "if" @keyword)
(preproc_endif "endif" @keyword)
(preproc_region "region" @keyword)
(preproc_endregion "endregion" @keyword)
(preproc_define "define" @keyword)
(preproc_undef "undef" @keyword)
(preproc_error "error" @keyword)
(preproc_warning "warning" @keyword)
(preproc_line ["line" "hidden"] @keyword)
(preproc_pragma ["pragma" "warning" "disable" "restore" "checksum"] @keyword)
(preproc_nullable ["nullable" "enable" "disable" "restore" "annotations" "warnings"] @keyword)

; Everything from `#elif` or `#else` up to the matching `#endif` is one token
; that is not parsed, so it reads as inactive code.
(preproc_else) @comment

; Conditional compilation symbols, as defined and as tested in `#if`.
; Queries can't match a descendant at any depth, so conditions are covered
; down to five levels of operators and parentheses.
(preproc_define (preproc_arg) @constant)
(preproc_undef (preproc_arg) @constant)
(preproc_if condition: (identifier) @constant)
(preproc_if condition: (_ (identifier) @constant))
(preproc_if condition: (_ (_ (identifier) @constant)))
(preproc_if condition: (_ (_ (_ (identifier) @constant))))
(preproc_if condition: (_ (_ (_ (_ (identifier) @constant)))))
(preproc_if condition: (_ (_ (_ (_ (_ (identifier) @constant))))))

; Warning IDs in `#pragma warning disable CS0168, 414`
(preproc_pragma (identifier) @constant)

; Free text: messages, region names, and text a pragma ignores.
(preproc_error (preproc_arg) @string)
(preproc_warning (preproc_arg) @string)
(preproc_region content: (preproc_arg) @comment)
(preproc_endregion content: (preproc_arg) @comment)
(preproc_pragma (preproc_arg) @comment)

;; File-based app directives (#!, #:package Name@Version, #:property Name=Value, ...)

(shebang_directive) @keyword
"#" @keyword
(ignored_directive ":" @keyword)
(directive_kind) @keyword
(directive_name) @variable
(directive_separator) @punctuation.delimiter
(directive_value) @string

;; Attribute

(attribute name: (identifier) @attribute)

;; Parameters

(parameter
  name: (identifier) @variable.parameter)

; `x => ...` and C# 14 `(ref x, out y) => ...`
(implicit_parameter) @variable.parameter

;; Type constraints

(type_parameter_constraints_clause (identifier) @type)

;; Method calls

(invocation_expression function: (identifier) @function)
(invocation_expression (member_access_expression name: (identifier) @function))
(invocation_expression (member_binding_expression name: (identifier) @function))
