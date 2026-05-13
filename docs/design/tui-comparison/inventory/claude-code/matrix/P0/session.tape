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

Type "Reply in English with exactly one sentence introducing yourself. Do not use any tools."
Enter
Sleep 30s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
