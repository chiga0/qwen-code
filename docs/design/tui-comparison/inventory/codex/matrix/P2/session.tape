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

Type "codex"
Enter
Sleep 6s

Type "Run `ls -laR /usr/share | head -200` using a shell tool, then in one sentence tell me roughly how many directories appear in that output."
Enter
Sleep 90s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
