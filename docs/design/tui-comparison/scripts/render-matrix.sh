#!/usr/bin/env bash
# Batch-render the (agent × prompt) matrix as VHS tapes + run them.
# Bash 3 compatible (macOS default).
#
# Usage:
#   render-matrix.sh                                # all agents × all prompts
#   render-matrix.sh -a qwen -p P1                  # one cell
#   render-matrix.sh -a qwen,claude -p P0,P1        # subset
#   render-matrix.sh --dry-run                      # generate tapes only
#   render-matrix.sh --parallel 3                   # run up to 3 cells concurrently
#
# Output:
#   inventory/<agent>/matrix/<prompt-id>/session.{tape,gif,txt}
#   inventory/<agent>/matrix/<prompt-id>/response.png

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SANDBOX="$ROOT/fixtures/sandbox"
PROMPTS_DIR="$ROOT/prompts"

# All agents (gemini excluded per user direction — tool-use blocked in this env)
ALL_AGENTS="qwen claude codex opencode"
ALL_PROMPTS="P0 P1 P2 P3 P4 P5 P6"

# Per-agent launch command. gemini blocked due to env-specific tool-use reasoning_content error.
launch_for() {
  case "$1" in
    qwen)     echo "qwen" ;;
    claude)   echo "claude" ;;
    codex)    echo "codex" ;;
    gemini)   echo "gemini -m gemini-2.5-flash" ;;
    opencode) echo "/Users/gawain/.opencode/bin/opencode -m idealab/qwen3.6-max-preview" ;;
    *) echo "" ;;
  esac
}

# Map agent id → inventory dir name (some agents have product-name dirs).
inventory_dir_for() {
  case "$1" in
    claude) echo "claude-code" ;;
    gemini) echo "gemini-cli" ;;
    *)      echo "$1" ;;
  esac
}

splash_for() {
  case "$1" in
    qwen)     echo 6 ;;
    claude)   echo 7 ;;
    codex)    echo 6 ;;
    gemini)   echo 7 ;;
    opencode) echo 8 ;;
    *) echo 6 ;;
  esac
}

# Per-prompt response wait (seconds). Tool-using and long-output prompts need more.
wait_for_prompt() {
  case "$1" in
    P0) echo 30 ;;
    P1) echo 75 ;;
    P2) echo 90 ;;
    P3) echo 60 ;;
    P4) echo 75 ;;
    P5) echo 120 ;;
    P6) echo 60 ;;
    *) echo 60 ;;
  esac
}

prompt_path() {
  ls "$PROMPTS_DIR/${1}-"*.md 2>/dev/null | head -1
}

agents="$ALL_AGENTS"
prompts="$ALL_PROMPTS"
dry_run=0
parallel=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a) agents="${2//,/ }"; shift 2 ;;
    -p) prompts="${2//,/ }"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    --parallel) parallel="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

run_cell() {
  local agent="$1"
  local pid="$2"
  local pfile
  pfile=$(prompt_path "$pid")
  if [[ -z "$pfile" ]]; then
    echo "[skip] no prompt file for $pid" >&2
    return
  fi
  local launch
  launch=$(launch_for "$agent")
  if [[ -z "$launch" ]]; then
    echo "[skip] no launch for $agent" >&2
    return
  fi
  local splash pwait
  splash=$(splash_for "$agent")
  pwait=$(wait_for_prompt "$pid")
  local prompt_text
  prompt_text=$(cat "$pfile" | tr -d '\n' | sed 's/"/\\"/g')
  local inv_dir
  inv_dir=$(inventory_dir_for "$agent")
  local cell_dir="$ROOT/inventory/$inv_dir/matrix/$pid"
  mkdir -p "$cell_dir"
  local tape_path="$cell_dir/session.tape"

  cat > "$tape_path" <<EOF
Output "session.gif"
Output "session.txt"

Set Shell "zsh"
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20

Hide
Type "cd $SANDBOX && clear"
Enter
Show

Type "$launch"
Enter
Sleep ${splash}s

Type "$prompt_text"
Enter
Sleep ${pwait}s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
EOF

  echo "[gen] $cell_dir/session.tape"
  if [[ $dry_run -eq 0 ]]; then
    echo "[run] $agent / $pid (splash ${splash}s + response ${pwait}s)"
    (cd "$cell_dir" && vhs session.tape >/dev/null 2>&1) && echo "[ok] $agent/$pid" || echo "[fail] $agent/$pid" >&2
  fi
}

# Build cell list
cells=""
for a in $agents; do
  for p in $prompts; do
    cells="$cells $a:$p"
  done
done

# Run with bounded parallelism
running=0
for cell in $cells; do
  agent="${cell%:*}"
  pid="${cell#*:}"
  if [[ $parallel -gt 1 && $dry_run -eq 0 ]]; then
    run_cell "$agent" "$pid" &
    running=$((running+1))
    if [[ $running -ge $parallel ]]; then
      wait -n 2>/dev/null || wait
      running=$((running-1))
    fi
  else
    run_cell "$agent" "$pid"
  fi
done
wait
echo "done."
