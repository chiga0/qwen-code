#!/usr/bin/env bash
# Run pixel measurement on every (agent × prompt) response.png in the matrix
# and emit a markdown comparison table grouped by prompt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AGENTS="qwen claude-code codex opencode"
PROMPTS="P0 P1 P2 P3 P4 P5 P6"

echo "# 像素测量结果（所有 cell）"
echo
echo "生成时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo
echo "测量脚本：\`scripts/measure-density.py\`"
echo "字段说明：text% = 文本行占比；bar% = 实色 chrome 行占比；used% = text+bar；mid_empty% = 内容之间留白；span = 首行到末行像素跨度。"
echo

for p in $PROMPTS; do
  pfile=$(ls "$ROOT/prompts/${p}-"*.md 2>/dev/null | head -1)
  pname=$(basename "$pfile" .md)
  pcontent=$(cat "$pfile" 2>/dev/null | tr -d '\n' | head -c 100)
  echo "## $pname"
  echo
  echo "Prompt: \`$pcontent\`"
  echo

  pngs=""
  for a in $AGENTS; do
    png="$ROOT/inventory/$a/matrix/$p/response.png"
    if [[ -f "$png" ]]; then
      pngs="$pngs $png"
    fi
  done
  if [[ -z "$pngs" ]]; then
    echo "_no cells captured for $p_"
    echo
    continue
  fi
  python3 "$SCRIPT_DIR/measure-density.py" --table $pngs 2>&1
  echo
done

# Cross-cutting summary: for each agent, average their used% and content span
echo "## 跨 prompt agent 平均"
echo
echo "| Agent | 平均 %used | 平均 span | 平均 %mid_empty |"
echo "|---|---|---|---|"
for a in $AGENTS; do
  pngs=""
  for p in $PROMPTS; do
    png="$ROOT/inventory/$a/matrix/$p/response.png"
    [[ -f "$png" ]] && pngs="$pngs $png"
  done
  if [[ -z "$pngs" ]]; then
    echo "| $a | - | - | - |"
    continue
  fi
  python3 "$SCRIPT_DIR/measure-density.py" $pngs 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('| $a | - | - | - |')
else:
    used = sum(d['pct_used'] for d in data) / len(data)
    span = sum(d['content_span_rows'] for d in data) / len(data)
    mid = sum(d['pct_middle_empty'] for d in data) / len(data)
    print(f'| $a | {used:.1f}% | {span:.0f}px | {mid:.1f}% |')
"
done
