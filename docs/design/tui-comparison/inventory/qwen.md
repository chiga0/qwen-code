# Inventory: qwen-code v0.15.10

> **关键身份**：本仓库即 qwen-code，是本调研的"被改进对象"。本 inventory 比其他 agent 要更深入，因为我们能直接读源码。

> **状态**：🟡 部分。D 类（快捷键）已基于源码核验；A/E/F 基于 splash 截图初步观察；B/C 待运行实测。

---

## A. 静态布局（Static Layout）

| 特性 | 现状 | 证据 |
|---|---|---|
| Splash | QWEN ASCII 大字 (~5 行) + 信息面板（标题/版本/模型/cwd）+ Tips 一行 | `out/_smoke/02-qwen-splash.png` |
| Splash 行数（chrome 占用）| **约 10 行**（ASCII 字 5 + 面板 3 + Tips 1 + 间距 1）| 同上 |
| 顶部状态栏 | 无固定栏，splash 占据顶部 | 同上 |
| 输入框 | 单行框（`>` 前缀），下方一行 footer 提示 | 同上 |
| 输入框 placeholder | "▍ 输入您的消息或 @ 文件路径" | 同上 |
| Footer 提示 | "按 ? 查看快捷键" | 同上 |
| 左右 margin | 较宽（~20px padding） | 同上 |
| 主题系统 | TODO: 确认是否支持主题切换、配色变量 | TODO |

## B. 内容渲染（运行时实测）

实测产物：`inventory/qwen/files-prompt-response.png`、`files-prompt.gif`

- **用户消息**：未明显高亮，与对话上下文混排
- **助手文本**：直接输出，**默认露出模型自身的 meta-reasoning**（如 "The user asked me to... I should follow the explicit MUST..." 等关于语言选择的内省段落，占了 ~10 行）—— **这是 qwen 一个明显的密度问题**
- **Markdown 表格**：能渲染，中文标题正确（"文件" / "说明"）
- **加粗 / 列表**：渲染正常
- 输出语言混乱：实测出现"中文表格 + 英文文本 + 中文表头"混合，因为模型在权衡用户消息/系统提示的语言偏好

## C. Agent 活动展示（运行时实测）

- **工具调用面板**：左侧带圆角框 ASCII，每个工具一行：`✓ ToolName <arg>` 紧凑表示
- 实测看到：
  ```
  ╭────────────────────────────────╮
  │ ✓ ListFiles .                  │
  │   Listed 3 item(s)             │
  │ ✓ ReadFile package.json        │
  │ ✓ ReadFile README.md           │
  │ ✓ ReadFile index.js            │
  ╰────────────────────────────────╯
  ```
- **每个工具默认折叠到 1 行**，参数简写 —— 这部分密度做得不错
- **未观察到 thinking 块显示**（DeepSeek 类模型可能有，未测）
- **未观察到 SubAgent**（本 prompt 未触发）

## D. 模式切换 / 快捷键（**已核验完整**）

来源：[`packages/cli/src/config/keyBindings.ts`](../../../../packages/cli/src/config/keyBindings.ts)

### 影响渲染的快捷键

| Key | Command | 文件位置 | 视觉影响 | 证据 |
|---|---|---|---|---|
| **Ctrl+O** | TOGGLE_COMPACT_MODE | `keyBindings.ts:54` | 切换紧凑模式（**用户提到的核心键**） | TODO: 录 before/after |
| **Alt+M** | TOGGLE_RENDER_MODE | `keyBindings.ts:~165` | 切换 plain / markdown 渲染 | TODO: 录 before/after |
| **Ctrl+T** | TOGGLE_TOOL_DESCRIPTIONS | `keyBindings.ts:48` | 工具描述详略 | TODO |
| **Ctrl+G** | TOGGLE_IDE_CONTEXT_DETAIL | `keyBindings.ts:49` | IDE 上下文详略 | TODO |
| **Ctrl+S** | SHOW_MORE_LINES | `keyBindings.ts:52` | 展开被截断的长输出 | TODO |
| **Ctrl+F** | TOGGLE_SHELL_INPUT_FOCUS | `keyBindings.ts` | 切到 shell 输入焦点 | TODO |
| **Ctrl+R** | REVERSE_SEARCH | `keyBindings.ts` | 进入反向历史搜索模式 | TODO |
| **Ctrl+L** | CLEAR_SCREEN | `keyBindings.ts:26` | 清屏 | TODO |
| **Ctrl+Y** | RETRY_LAST | `keyBindings.ts:53` | 重试上一条 | TODO |
| **Ctrl+B** | PROMOTE_SHELL_TO_BACKGROUND | `keyBindings.ts:57-60` | 把前台 shell 推到后台任务 | TODO |

### 非渲染向（输入编辑）

Ctrl+A/E（行首/末）、Ctrl+K/U（删行右/左）、Ctrl+C（清输入/退出）、Ctrl+D（退出）、Ctrl+P/N（历史上/下）、Tab（接受补全）—— **不计入本调研对比**，编辑器层面差异不影响输出规范。

### Slash 命令影响渲染

TODO: 跑 `/help` 列出所有命令，标出影响展示的。已知会影响渲染的：
- `/compact` — 折叠历史（猜测，待确认）
- `/insight` — splash 里 Tips 提到
- 其他待补

## E. Footer / 元数据

| 项 | 现状 | 证据 |
|---|---|---|
| Token / cost | TODO: 是否显示？在哪？格式？ | 待实测 |
| Model 名 | splash 里显示一次（`qwen3.6-max-preview`），运行中是否常驻？ | TODO |
| Context size | TODO | TODO |
| 处理时间 | 退出面板显示总耗时、API 时间、工具时间 | `out/_smoke/02-qwen-tui.txt` 末尾 |
| 工作目录 | splash 里显示一次（短径形式）| `out/_smoke/02-qwen-splash.png` |
| Idle 状态指示 | 输入框右下角 footer 提示，无独立 idle 指示 | 同上 |

## Ctrl+O 紧凑模式实测发现

证据：`inventory/qwen/ctrl-o-v3-{after-tools,toggled-back}.png`（v3 实测；v1/v2 实验均含 VHS race 黑屏，已废弃）

实测 prompt：「列文件 + 一句总结」（含工具调用，能体现 N→1 聚合）

| 状态 | 表现 |
|---|---|
| **toggled-back（按 Ctrl+O × 2，等价默认态）** | splash 完整 + 1 段 meta-reasoning + 3 个独立 ReadFile 面板 |
| **after-tools（按 Ctrl+O × 1，紧凑态）** | splash 仍在 + meta-reasoning 段消失 + 3 个 ReadFile 聚合成 1 行 `ReadFile × 3 index.js` |

**实测结论**：`TOGGLE_COMPACT_MODE` (Ctrl+O) 在带工具调用的场景下确实生效——通过 `mergeCompactToolGroups.ts` 把 N 个工具卡片折叠成 1 行，并隐藏 `+ assistant content` meta-reasoning 段。**未触及** splash/banner（这些另由 `ui.hideBanner` / `ui.hideTips` 单独控制，且默认全 false）。

数据局限：v3 toggle 是「按 1 次 vs 按 2 次」的对照，不是严格的「默认 vs ON」对照（详 `analysis/data-quality-quarantine.md §D2`）。

---

## F. 信息密度指标（**针对 qwen 痛点的专项观测**）

| 指标 | 测量值 | 证据 |
|---|---|---|
| Splash 占用屏幕行数 | **~10 行**（在 1400×900 / FontSize 14 下） | `out/_smoke/02-qwen-splash.png` |
| Splash 中纯装饰行数（ASCII 字）| 5 行 | 同上 |
| Splash 中信息密度（信息行 / 总行）| ~50% | 估算 |
| 退出面板装饰行数 | TODO: 数 box-drawing 行 | `out/_smoke/02-qwen-tui.txt` |
| 默认是否有"plain/minimal"模式 | **有，Ctrl+O 切换紧凑** | `keyBindings.ts:54` |
| 紧凑模式实际能省多少行 | TODO: 录 before/after 量化 | TODO |
| Turn 之间空行政策 | TODO | 待实测 |
| 工具调用面板是否有边框 | TODO | 待实测 |

---

## 已发现的可能优化点（先记下，Phase 2 再决定要不要做）

1. **Splash 10 行 vs claude 5 行** — qwen 启动 splash 占用接近 claude 两倍纵向空间，主要是 ASCII 大字
2. **Tips 行**（"试试 /insight..."）随启动 splash 出现 —— 可能是新手价值高、老手噪声
3. **退出面板 box-drawing** —— 装饰字符占满 100 字符宽，纵向也占 ~15 行
4. 紧凑模式存在但默认关闭 —— 默认就让信息密度低，**是否应该改默认？**

> 这些是直觉，不是结论。等 Phase 2 矩阵出来跟竞品对齐后再下判断。

---

## 待办（按优先级）

- [ ] 录 Ctrl+O before/after（最核心，用户直接提到的痛点）
- [ ] 录 Alt+M before/after（render mode 切换）
- [ ] 完成 B/C 类 —— 跑标准 prompt 看渲染
- [ ] 跑 `/help` 完整列出 slash 命令并分类
- [ ] 量化 splash / footer / 工具面板的 chrome:content 行数比
- [ ] F 类所有 TODO 实测填值
