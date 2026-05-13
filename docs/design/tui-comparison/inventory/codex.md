# Inventory: Codex CLI v0.130.0

> **状态**：⬜ 未开始。本文件是 stub。

> **来源策略**：开源（OpenAI codex-cli）。先看源码 + 应用内 `/help` + 运行实测。

---

## A. 静态布局

| 特性 | 现状 | 证据 |
|---|---|---|
| Splash | 带边框面板（`OpenAI Codex (v0.130.0)` + model + cwd）+ Tip 一行 + 输入框 + 底部状态栏 | `out/_smoke/03-codex-splash.png` |
| Splash 行数 | **~8 行** | 同上 |
| 面板边框 | 圆角，左右贯通 | 同上 |
| Tip | "Try the Codex App. Run 'codex app' or visit ..." | 同上 |
| 输入框 | 单行 + placeholder "Write tests for @filename" | 同上 |
| 底部状态栏 | `gpt-5.5 xhigh · <cwd-full-path>` | 同上 |
| 左右 margin | 较窄 | 同上 |

## B. 内容渲染（运行时实测，**最啰嗦**）

实测产物：`inventory/codex/files-prompt-response.png`、`files-prompt.gif`

- **用户消息**：灰色全宽 bar 高亮，`>` 前缀
- **助手文本**：默认**完整显示模型推理过程**（multiple paragraphs：先解释要做什么、再分析观察、再下结论）
- **列表 / 分割线 / 引用**：均正常渲染（看到 horizontal rule 用 `---`）
- **代码块**：等宽字体 + 浅色背景（猜测，本 prompt 未触发）

## C. Agent 活动展示（运行时实测）

- **工具调用以"Explored" 折叠面板分组**：
  ```
  ▼ Explored
  └ List rg --files -g 'README*' -g package.json -g '*.md'
    List ls -1A
  ```
  和
  ```
  ▼ Explored
  └ Read README.md, index.js, package.json
  ```
- **工具准备 + 工具结果之间还有 "Waited for background terminal" 字样**（每个 hook 等待都打印一行）—— 实测同一个 prompt 出现了 **4 次** "Waited for background terminal"，**这是明显的噪声**
- **Reasoning 段落不折叠**，跟正文混排
- **总占用：~22 行**（vs claude ~7 行）
- 末尾无统一 footer/计时

## D. 模式切换 / 快捷键

TODO: 进入 codex 跑 `/help`，查源码 keybinding 处。

## E. Footer / 元数据

| 项 | 现状 | 证据 |
|---|---|---|
| 模型 + effort | 底部 `gpt-5.5 xhigh` 常驻 | `out/_smoke/03-codex-splash.png` |
| 完整 cwd | 底部全径显示 | 同上 |

## F. 信息密度指标

| 指标 | 测量值 | 证据 |
|---|---|---|
| Splash 行数 | ~8 行 | `out/_smoke/03-codex-splash.png` |
| Splash 是否带 ASCII 装饰 | 无 ASCII 字，但有面板边框 | 同上 |
| 启动后默认显示 placeholder | "Write tests for @filename" | 同上 |

---

## 待办

- [ ] 看 codex-cli 源码找快捷键
- [ ] 跑 `/help`
- [ ] 跑标准 prompt 看 B/C
