; Injections for C#.
;
; String content is only injected where the source text is exactly what the
; embedded language sees:
;
; - `"..."` strings are injected only when they hold no escape sequence, i.e.
;   their only child is a single `string_literal_content`. In `"\\d+"` the
;   regex would otherwise read `\\d` (an escaped backslash) instead of `\d`.
; - `"""..."""` raw strings inject their `raw_string_content`.
; - `@"..."` verbatim strings are a single token with no content node, so they
;   use `#offset!` to drop the `@"` and `"`. Editors that ignore `#offset!`
;   include the quotes in the injected range.
; - Interpolated strings are never injected.

; Comments
; --------

((comment) @injection.content
  (#set! injection.language "comment"))

; XML documentation comments. A `documentation_comment` holds consecutive `///`
; lines and only its `///` markers are child nodes, so without
; `injection.include-children` the XML sees the text between them, line breaks
; included. The comment usually holds several elements (`<summary>`, `<param>`,
; ...) where an XML document has one root, so expect the XML parser to recover
; rather than parse it cleanly.
((documentation_comment) @injection.content
  (#set! injection.language "xml"))

; Regular expressions
; -------------------

; Regex.IsMatch(input, "pattern"), Regex.Replace(input, "pattern", ...), ...
(invocation_expression
  function: (member_access_expression
    expression: [
      (identifier) @_class
      (member_access_expression name: (identifier) @_class)
    ]
    name: (identifier) @_method)
  arguments: (argument_list
    .
    (argument !name)
    .
    (argument
      !name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#eq? @_class "Regex")
  (#any-of? @_method "Count" "EnumerateMatches" "EnumerateSplits" "IsMatch" "Match" "Matches" "Replace" "Split")
  (#set! injection.language "regex"))

(invocation_expression
  function: (member_access_expression
    expression: [
      (identifier) @_class
      (member_access_expression name: (identifier) @_class)
    ]
    name: (identifier) @_method)
  arguments: (argument_list
    .
    (argument !name)
    .
    (argument
      !name
      (verbatim_string_literal) @injection.content))
  (#eq? @_class "Regex")
  (#any-of? @_method "Count" "EnumerateMatches" "EnumerateSplits" "IsMatch" "Match" "Matches" "Replace" "Split")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; Regex.IsMatch(input, pattern: "pattern")
(invocation_expression
  function: (member_access_expression
    expression: [
      (identifier) @_class
      (member_access_expression name: (identifier) @_class)
    ]
    name: (identifier) @_method)
  arguments: (argument_list
    (argument
      name: (identifier) @_name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#eq? @_class "Regex")
  (#any-of? @_method "Count" "EnumerateMatches" "EnumerateSplits" "IsMatch" "Match" "Matches" "Replace" "Split")
  (#eq? @_name "pattern")
  (#set! injection.language "regex"))

(invocation_expression
  function: (member_access_expression
    expression: [
      (identifier) @_class
      (member_access_expression name: (identifier) @_class)
    ]
    name: (identifier) @_method)
  arguments: (argument_list
    (argument
      name: (identifier) @_name
      (verbatim_string_literal) @injection.content))
  (#eq? @_class "Regex")
  (#any-of? @_method "Count" "EnumerateMatches" "EnumerateSplits" "IsMatch" "Match" "Matches" "Replace" "Split")
  (#eq? @_name "pattern")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; new Regex("pattern", ...)
(object_creation_expression
  type: [
    (identifier) @_class
    (qualified_name name: (identifier) @_class)
  ]
  arguments: (argument_list
    .
    (argument
      !name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#eq? @_class "Regex")
  (#set! injection.language "regex"))

(object_creation_expression
  type: [
    (identifier) @_class
    (qualified_name name: (identifier) @_class)
  ]
  arguments: (argument_list
    .
    (argument
      !name
      (verbatim_string_literal) @injection.content))
  (#eq? @_class "Regex")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; new Regex(pattern: "pattern")
(object_creation_expression
  type: [
    (identifier) @_class
    (qualified_name name: (identifier) @_class)
  ]
  arguments: (argument_list
    (argument
      name: (identifier) @_name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#eq? @_class "Regex")
  (#eq? @_name "pattern")
  (#set! injection.language "regex"))

(object_creation_expression
  type: [
    (identifier) @_class
    (qualified_name name: (identifier) @_class)
  ]
  arguments: (argument_list
    (argument
      name: (identifier) @_name
      (verbatim_string_literal) @injection.content))
  (#eq? @_class "Regex")
  (#eq? @_name "pattern")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; [GeneratedRegex("pattern", ...)]
(attribute
  name: [
    (identifier) @_attribute
    (qualified_name name: (identifier) @_attribute)
  ]
  (attribute_argument_list
    .
    (attribute_argument
      !name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#any-of? @_attribute "GeneratedRegex" "GeneratedRegexAttribute")
  (#set! injection.language "regex"))

(attribute
  name: [
    (identifier) @_attribute
    (qualified_name name: (identifier) @_attribute)
  ]
  (attribute_argument_list
    .
    (attribute_argument
      !name
      (verbatim_string_literal) @injection.content))
  (#any-of? @_attribute "GeneratedRegex" "GeneratedRegexAttribute")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; [GeneratedRegex(pattern: "pattern")]
(attribute
  name: [
    (identifier) @_attribute
    (qualified_name name: (identifier) @_attribute)
  ]
  (attribute_argument_list
    (attribute_argument
      name: (identifier) @_name
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ]))
  (#any-of? @_attribute "GeneratedRegex" "GeneratedRegexAttribute")
  (#eq? @_name "pattern")
  (#set! injection.language "regex"))

(attribute
  name: [
    (identifier) @_attribute
    (qualified_name name: (identifier) @_attribute)
  ]
  (attribute_argument_list
    (attribute_argument
      name: (identifier) @_name
      (verbatim_string_literal) @injection.content))
  (#any-of? @_attribute "GeneratedRegex" "GeneratedRegexAttribute")
  (#eq? @_name "pattern")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

; Language comments
; -----------------
;
; A `// lang=json` or `/* language=json */` comment (the Roslyn and JetBrains
; convention) names the language of the string that follows it, either inline
; or on the line before a declaration, assignment or return. Verbatim strings
; are only injected for regex and SQL: their `""` escape breaks JSON, XML and
; the like.

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*(regex|regexp)\\b")
  (#set! injection.language "regex"))

((_
  (comment) @_comment
  .
  [
    (verbatim_string_literal) @injection.content
    (argument (verbatim_string_literal) @injection.content)
    (_
      (variable_declaration
        (variable_declarator (verbatim_string_literal) @injection.content)))
    (property_declaration value: (verbatim_string_literal) @injection.content)
    (expression_statement
      (assignment_expression right: (verbatim_string_literal) @injection.content))
    (return_statement (verbatim_string_literal) @injection.content)
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*(regex|regexp)\\b")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "regex"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*sql\\b")
  (#set! injection.language "sql"))

((_
  (comment) @_comment
  .
  [
    (verbatim_string_literal) @injection.content
    (argument (verbatim_string_literal) @injection.content)
    (_
      (variable_declaration
        (variable_declarator (verbatim_string_literal) @injection.content)))
    (property_declaration value: (verbatim_string_literal) @injection.content)
    (expression_statement
      (assignment_expression right: (verbatim_string_literal) @injection.content))
    (return_statement (verbatim_string_literal) @injection.content)
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*sql\\b")
  (#offset! @injection.content 0 2 0 -1)
  (#set! injection.language "sql"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*json\\b")
  (#set! injection.language "json"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*xml\\b")
  (#set! injection.language "xml"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*html\\b")
  (#set! injection.language "html"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*css\\b")
  (#set! injection.language "css"))

((_
  (comment) @_comment
  .
  [
    (string_literal . (string_literal_content) @injection.content .)
    (raw_string_literal (raw_string_content) @injection.content)
    (argument
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (_
      (variable_declaration
        (variable_declarator
          [
            (string_literal . (string_literal_content) @injection.content .)
            (raw_string_literal (raw_string_content) @injection.content)
          ])))
    (property_declaration
      value: [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
    (expression_statement
      (assignment_expression
        right: [
          (string_literal . (string_literal_content) @injection.content .)
          (raw_string_literal (raw_string_content) @injection.content)
        ]))
    (return_statement
      [
        (string_literal . (string_literal_content) @injection.content .)
        (raw_string_literal (raw_string_content) @injection.content)
      ])
  ])
  (#match? @_comment "^(//|/\\*)\\s*lang(uage)?\\s*=\\s*(javascript|js)\\b")
  (#set! injection.language "javascript"))
