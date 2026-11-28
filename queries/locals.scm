;; Scopes
;; ------

[
  (method_declaration)
  (constructor_declaration)
  (destructor_declaration)
  (operator_declaration)
  (conversion_operator_declaration)
  (indexer_declaration)
  (accessor_declaration)
  (local_function_statement)
  (arrow_expression_clause)
  (lambda_expression)
  (anonymous_method_expression)
  (block)
  (for_statement)
  (while_statement)
  (foreach_statement)
  (using_statement)
  (fixed_statement)
  (catch_clause)
  (switch_section)
  (switch_expression_arm)
  (query_expression)
] @local.scope

; Type declarations scope their type parameters and primary constructor
; parameters.
[
  (class_declaration)
  (struct_declaration)
  (record_declaration)
  (interface_declaration)
  (delegate_declaration)
  (extension_declaration)
] @local.scope

;; Definitions
;; -----------

; Parameters, including primary constructor, lambda and anonymous method
; parameters. A `params` array is not wrapped in a `parameter` node, so its
; name sits on the list itself.
(parameter
  name: (identifier) @local.definition)

(parameter_list
  name: (identifier) @local.definition)

(bracketed_parameter_list
  name: (identifier) @local.definition)

; `x => ...` and C# 14 `(ref x, out y) => ...`
(implicit_parameter) @local.definition

; C# 14 `extension(string s) { ... }`
(receiver_parameter
  name: (identifier) @local.definition)

; Type parameters, referenced from type positions (see the references below).
(type_parameter
  name: (identifier) @local.definition)

; Local variables. Field and event declarations also use
; `variable_declaration`, so match only the statement forms.
(local_declaration_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

(for_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

(using_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

(fixed_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @local.definition)))

; `foreach (var item in items)`
(foreach_statement
  left: (identifier) @local.definition)

; `out var x`, `(int a, var b) = t`, `foreach (var (k, v) in d)`
(declaration_expression
  name: (identifier) @local.definition)

; `var (a, b)`, `is (int a, int b)`, nested designations
(parenthesized_variable_designation
  name: (identifier) @local.definition)

; Pattern designations: `is Foo f`, `case var v`, `{ Length: > 0 } s`,
; `Point(var x, var y) p`, `[_, .. var rest] all`
(declaration_pattern
  name: (identifier) @local.definition)

(var_pattern
  name: (identifier) @local.definition)

(recursive_pattern
  name: (identifier) @local.definition)

(list_pattern
  name: (identifier) @local.definition)

; `catch (Exception e)`
(catch_declaration
  name: (identifier) @local.definition)

; LINQ range variables
(from_clause
  name: (identifier) @local.definition)

; `join o in orders`
(join_clause
  name: (identifier) @local.definition)

; `let total = ...`
(let_clause
  name: (identifier) @local.definition)

; `join ... into placed`
(join_into_clause
  name: (identifier) @local.definition)

; `select ... into g` / `group ... into g` query continuation
(query_expression
  name: (identifier) @local.definition)

;; References
;; ----------

; Identifiers in expression position. Member names (`a.b`), named arguments
; (`f(x: 1)`) and declarations are not matched. Property names in a property
; pattern (`{ X: 1 }`) and on the left of an object initializer
; (`new P { X = 1 }`) are parsed as expressions, so they are matched and would
; resolve to a local of the same name.
(lvalue_expression/identifier) @local.reference

; Identifiers in type position, so uses of a type parameter resolve to its
; definition. A type name with no matching type parameter in scope is left
; alone. `where T :` targets are bare identifiers in the constraints clause.
(type/identifier) @local.reference

(type_parameter_constraints_clause
  (identifier) @local.reference)
