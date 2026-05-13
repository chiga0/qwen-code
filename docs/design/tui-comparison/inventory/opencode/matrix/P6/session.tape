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

Type "Try to read the file at /tmp/file-that-does-not-exist-xyz-12345.txt using a tool, then explain what went wrong in one sentence."
Enter
Sleep 60s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
