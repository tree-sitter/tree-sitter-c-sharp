#!/usr/bin/env bash
# Generates and builds the grammar in the given directory, then prints its
# size metrics as JSON. Used by the grammar size workflow.
set -euo pipefail

cd "${1:-.}"

tree-sitter generate >&2

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) extension=dll ;;
  Darwin) extension=dylib ;;
  *) extension=so ;;
esac
library_dir=$(mktemp -d)
library="$library_dir/parser.$extension"
tree-sitter build -o "$library" . >&2

define() {
  sed -n "s/^#define $1 \([0-9][0-9]*\)\r\{0,1\}$/\1/p" src/parser.c
}

jq -n \
  --arg cli "$(tree-sitter --version)" \
  --argjson parser_c_bytes "$(wc -c < src/parser.c)" \
  --argjson library_bytes "$(wc -c < "$library")" \
  --argjson states "$(define STATE_COUNT)" \
  --argjson large_states "$(define LARGE_STATE_COUNT)" \
  --argjson symbols "$(define SYMBOL_COUNT)" \
  --argjson tokens "$(define TOKEN_COUNT)" \
  --argjson external_tokens "$(define EXTERNAL_TOKEN_COUNT)" \
  --argjson fields "$(define FIELD_COUNT)" \
  --argjson production_ids "$(define PRODUCTION_ID_COUNT)" \
  '$ARGS.named'

rm -rf "$library_dir"
