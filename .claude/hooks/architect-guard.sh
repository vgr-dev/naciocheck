#!/usr/bin/env bash
# PreToolUse guard for the architect agent: Write/Edit only inside .ai/, AGENTS.md or README.md.
set -euo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
[[ -z "$path" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
abs=$(realpath -m -- "$path")
rel=${abs#"$root"/}

case "$rel" in
  .ai/*|AGENTS.md|README.md) exit 0 ;;
esac

echo "Architect may only write inside .ai/ (or AGENTS.md / README.md). Blocked: $rel. Put this change in a plan for the builder." >&2
exit 2
