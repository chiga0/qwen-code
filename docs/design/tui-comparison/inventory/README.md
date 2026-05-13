# Inventory — Phase 1 产物

每个 agent 一份 `<agent>.md`，按 SPEC §Phase 1 的 A–F 六个类别穷尽展示/输出特性。

**填写规则**：
- 每个条目必须挂证据：源码行号（`pkg/foo.tsx:42`）或截图路径（`<agent>/<feature-id>.png`）
- 找不到的特性写"无"或"未发现"，不要留空
- 未确认的写 `TODO: <什么没确认>`，PR 不卡，但出 Phase 2 矩阵前必须清掉

## 进度

| Agent | 文件 | 进度 |
|---|---|---|
| qwen | [qwen.md](./qwen.md) | 🟡 部分 — D 类（快捷键）已确认；A/E/F 部分；B/C 待填 |
| claude | [claude-code.md](./claude-code.md) | ⬜ 未开始（文件名加 `-code` 后缀避开根 `.gitignore` 的 `CLAUDE.md` 规则） |
| codex | [codex.md](./codex.md) | ⬜ 未开始 |
| gemini | — | ⬜ CLI 未装 |
| opencode | — | ⬜ CLI 未装 |

## 截图规范

- 通过 VHS tape 录，不要肉眼截图（保证字体/尺寸/主题一致）
- 命名 `<feature-id>.png`，存到对应 agent 子目录：`inventory/qwen/D-ctrl-o-before.png`
- 同一特性需要 before/after 对比时，分别 `-before.png` / `-after.png`
