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

Type "claude"
Enter
Sleep 7s

Type "List the files in this directory using a tool, then summarize this project in one short sentence."
Enter
Sleep 120s
Screenshot "before.png"

Ctrl+O
Sleep 2s
Screenshot "after.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
