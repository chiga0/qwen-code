Output "ctrl-o-toggle-v3.gif"
Output "ctrl-o-toggle-v3.mp4"
Output "ctrl-o-toggle-v3.txt"

Set Shell "zsh"
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20

Hide
Type "cd /Users/gawain/Documents/codebase/opensource/qwen-code/.claude/worktrees/tui-comparison/docs/design/tui-comparison/fixtures/sandbox && clear"
Enter
Show

Type "qwen"
Enter
Sleep 6s

Type "List the files in this directory and summarize this project in one short sentence"
Enter
Sleep 90s
Screenshot "ctrl-o-v3-before-tools.png"

Ctrl+O
Sleep 2s
Screenshot "ctrl-o-v3-after-tools.png"

Ctrl+O
Sleep 2s
Screenshot "ctrl-o-v3-toggled-back.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
