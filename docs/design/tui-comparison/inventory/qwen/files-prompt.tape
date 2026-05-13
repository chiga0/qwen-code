Output "files-prompt.gif"
Output "files-prompt.mp4"
Output "files-prompt.txt"

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
Screenshot "files-prompt-splash.png"

Type "List the files in this directory and summarize this project in one short sentence"
Enter
Sleep 60s
Screenshot "files-prompt-response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
