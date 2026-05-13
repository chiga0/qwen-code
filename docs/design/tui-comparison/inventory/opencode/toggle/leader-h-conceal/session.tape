Output "session.gif"
Output "session.txt"

Set Shell "zsh"
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20

Hide
Type "cd /Users/gawain/Documents/codebase/opensource/qwen-code/.claude/worktrees/tui-comparison/docs/design/tui-comparison/fixtures/sandbox && clear"
Enter
Show

Type "/Users/gawain/.opencode/bin/opencode -m idealab/qwen3.6-max-preview"
Enter
Sleep 8s

Type "List the files in this directory using a tool, then summarize this project in one short sentence."
Enter
Sleep 120s
Screenshot "before.png"

Ctrl+X
Sleep 300ms
Type "h"
Sleep 2s
Screenshot "after.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
