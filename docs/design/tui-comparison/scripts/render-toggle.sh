#!/usr/bin/env bash
# Mode-toggle before/after capture for each agent.
# Uses P1 (tool-using prompt) so there's content to compact.
# Output: inventory/<inv_dir>/toggle/<toggle_id>/{before,after}.png + session.tape

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SANDBOX="$ROOT/fixtures/sandbox"
PROMPTS_DIR="$ROOT/prompts"

PROMPT_TEXT=$(cat "$PROMPTS_DIR/P1-tool-single.md" | tr -d '\n' | sed 's/"/\\"/g')

inventory_dir_for() {
  case "$1" in
    claude) echo "claude-code" ;;
    *)      echo "$1" ;;
  esac
}

# Per-toggle: (agent, toggle_id, launch_cmd, splash_wait, response_wait, key_sequence)
# key_sequence is multiline VHS commands sandwiched between BEFORE and AFTER screenshots.

run_toggle() {
  local agent="$1"; shift
  local toggle_id="$1"; shift
  local launch="$1"; shift
  local splash="$1"; shift
  local pwait="$1"; shift
  local key_actions="$1"; shift  # VHS commands separated by ||

  local inv_dir
  inv_dir=$(inventory_dir_for "$agent")
  local cell_dir="$ROOT/inventory/$inv_dir/toggle/$toggle_id"
  mkdir -p "$cell_dir"
  local tape="$cell_dir/session.tape"

  # Convert || into newlines for the key actions
  local key_block
  key_block=$(echo "$key_actions" | tr '|' '\n' | sed 's/^$//' | sed '/^$/d')

  cat > "$tape" <<EOF
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

Type "$PROMPT_TEXT"
Enter
Sleep ${pwait}s
Screenshot "before.png"

$key_block
Sleep 2s
Screenshot "after.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
EOF
  echo "[gen] $cell_dir/session.tape"
  (cd "$cell_dir" && vhs session.tape >/dev/null 2>&1) && echo "[ok] $agent/$toggle_id" || echo "[fail] $agent/$toggle_id" >&2
}

# Bumped wait to 180s — qwen's dynamic model selection can pick slow models (pai/glm-5.1)
# that take 1+ min for tool-using prompt.

# qwen: Ctrl+O = TOGGLE_COMPACT_MODE
# Pin to DeepSeek/deepseek-v4-pro (matrix-proven fast) to avoid auto-pick slow models
run_toggle "qwen" "ctrl-o-compact" \
  "qwen -m qwen3.6-max-preview" 6 90 \
  "Ctrl+O"

# claude: Ctrl+O = transcript mode (distinct semantic from qwen)
run_toggle "claude" "ctrl-o-transcript" \
  "claude" 7 120 \
  "Ctrl+O"

# codex: Ctrl+T probe (codex source not analyzed; try common density key)
run_toggle "codex" "ctrl-t-probe" \
  "codex" 6 120 \
  "Ctrl+T"

# opencode: <leader>h = session.toggle.conceal (leader = Ctrl+X)
run_toggle "opencode" "leader-h-conceal" \
  "/Users/gawain/.opencode/bin/opencode -m idealab/qwen3.6-max-preview" 8 120 \
  "Ctrl+X|Sleep 300ms|Type \"h\""

# opencode: <leader>b = sidebar_toggle (already-on side panel)
run_toggle "opencode" "leader-b-sidebar" \
  "/Users/gawain/.opencode/bin/opencode -m idealab/qwen3.6-max-preview" 8 120 \
  "Ctrl+X|Sleep 300ms|Type \"b\""

# qwen Alt+M = TOGGLE_RENDER_MODE (plain/markdown)
run_toggle "qwen" "alt-m-render" \
  "qwen -m qwen3.6-max-preview" 6 90 \
  "Alt+M"

echo "done."
