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

Type "Write a brief markdown tutorial about the JavaScript event loop. Use one ## heading, one ordered list of 3 steps, one fenced code block with exactly 4 lines, and one markdown table with 3 rows. Keep total response under 30 lines."
Enter
Sleep 75s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
