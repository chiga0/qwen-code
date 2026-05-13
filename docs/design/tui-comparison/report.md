# TUI 信息密度调研报告（图文版）

> **范围**：纯调研，只描述 4 个 agent（claude-code / codex / qwen / opencode）TUI 的现状。不含建议、不含执行计划。
> **数据**：4 agent × 7 标准 prompt = **28 cell 真 PTY 录制**（VHS 1400×900 / FontSize 14 / zsh，固定 fixture）+ 像素测量（`scripts/measure-density.py`）+ 源码核验（D 类快捷键）。
> **gemini-cli** 因本环境 reasoning_content 路由问题在 tool-use 场景报错，**不参与像素矩阵**，仅 splash 与源码维度收录。
> **opencode P2** 因 VHS race 黑屏数据无效，已隔离（详 `analysis/data-quality-quarantine.md`）。

---

## 一、一图先看结论：同 prompt 同 fixture 同 VHS，4 agent 的纵向占用差异

**Prompt P1**：「列出当前目录文件，然后用一句话总结这个项目」（最常见的"单工具调用 + 简短回答"场景）

| qwen | claude-code | codex | opencode |
|---|---|---|---|
| ![qwen P1](inventory/qwen/matrix/P1/response.png) | ![claude P1](inventory/claude-code/matrix/P1/response.png) | ![codex P1](inventory/codex/matrix/P1/response.png) | ![opencode P1](inventory/opencode/matrix/P1/response.png) |
| span **827px** | span **268px** | span **378px** | span **900px**（含右栏）|
| 大 ASCII splash + Tips + 1 段 meta-reasoning + 4 个独立 ReadFile 面板 + 2 段过渡解释 + Markdown 表格 + 总结 | 3 行 splash + 1 行折叠提示 `Read 1 file, listed 1 directory (ctrl+o to expand)` + 1 行内联文件列表 + 1 行 timing | 圆角 splash + Tip + 折叠的 Explored 面板 + 文件列表 + 1 句总结 | 主列：3 段 Thinking + 3 个 Read + Files + Summary；右栏：Project / Context tokens / LSP；底栏：build · model · token |

> qwen 的 span 是 claude 的 **3.09×**。差距来自两块：splash 尺寸（10 行 vs 3 行）+ tool 调用渲染（多面板 + 行间空行 + 外露的 meta-reasoning）。

像素测量来源：`analysis/pixel-sweep-output.md`。

---

## 二、跨 prompt 平均（28 cell）

| Agent | 平均 span (px) | 平均 %used | 平均 %mid_empty | 各 prompt span 范围 |
|---|---|---|---|---|
| **claude-code** | **363** ⭐ | 21.1% | 19.3% | 220 – 625 |
| codex | 487 | 30.8% | 23.4% | 320 – 758 |
| **qwen** | **669** | 40.8% | 33.5% | 481 – 827 |
| opencode | 771¹ | 85.7% | -14.3%¹ | 几乎恒为 900 |

¹ opencode 右侧栏顶天立地 → top/bottom margin ≈ 0 → mid_empty 计算异常；看 span 列即可：~900 = 几乎满屏。

**指标定义**（详 `analysis/matrix.md §1`）：
- `%used` = (text + solid_bar) / height —— 屏幕被填充比例
- `content_span` = 首/尾非空行的像素跨度 —— 内容实际"长度"
- `%mid_empty` = 跨度内空行占比 —— 内部留白

---

## 三、按 prompt 横向对比（图文）

每行同一 prompt 同一 fixture 的响应截图并排。

### P0 — chat（"用 1 句话介绍你自己，不用工具"）

| qwen — 497px | claude — 220px |
|---|---|
| ![qwen P0](inventory/qwen/matrix/P0/response.png) | ![claude P0](inventory/claude-code/matrix/P0/response.png) |
| splash 10 行 + 1 段 9 行的 meta-reasoning（"The user has set up context… There's a conflict…"）+ 1 行最终回答 | splash 3 行 + 1 行回答（本帧抓到"Ionizing… 29s"加载中样式，最终回答见 `session.gif`）|

> qwen 在**显式说"不用工具，1 句话"**的 prompt 上仍然外露 ~9 行模型 reasoning。claude / codex 默认不外露。

### P1 — single tool（见第一节图）

| qwen — 827px | claude — 268px |
|---|---|
| ![qwen P1](inventory/qwen/matrix/P1/response.png) | ![claude P1](inventory/claude-code/matrix/P1/response.png) |

### P2 — long shell（"`ls -laR /usr/share | head -200` 然后告诉我目录数"）

| qwen — 820px | claude — 350px |
|---|---|
| ![qwen P2](inventory/qwen/matrix/P2/response.png) | ![claude P2](inventory/claude-code/matrix/P2/response.png) |
| 直接执行；`shellOutputMaxLines: 5` 默认生效，输出截断至 5 行 + `+200 lines hidden` 指示 | 弹出 "Do you want to proceed?" 工具确认面板（默认拒绝不在白名单的 shell 命令）|

> 注意 qwen / claude 的安全策略不同：qwen 默认放行长 shell（截断显示），claude 默认拦截需用户授权。**这是行为差异，不是密度差异**。

### P3 — code-gen（"实现带 memo 的 Fibonacci，再写 2 行解释"）

| qwen — 675px | claude — 398px | codex — 563px |
|---|---|---|
| ![qwen P3](inventory/qwen/matrix/P3/response.png) | ![claude P3](inventory/claude-code/matrix/P3/response.png) | ![codex P3](inventory/codex/matrix/P3/response.png) |

### P4 — markdown 压力（h2 + 有序列表 + 围栏代码 + 4 行表格）

| qwen — 822px | claude — 625px |
|---|---|
| ![qwen P4](inventory/qwen/matrix/P4/response.png) | ![claude P4](inventory/claude-code/matrix/P4/response.png) |

> **本题是 qwen / claude span 差距最小的一题（1.32×）**：markdown 内容本身就需要 ≥10 行结构，meta 占比相对降低。

### P5 — SubAgent（并行计 .md / .ts 文件数）

| qwen — 562px | codex — 758px ⚠️ 本题最大 | claude — 349px |
|---|---|---|
| ![qwen P5](inventory/qwen/matrix/P5/response.png) | ![codex P5](inventory/codex/matrix/P5/response.png) | ![claude P5](inventory/claude-code/matrix/P5/response.png) |
| 用 2 个 Glob 工具直接出结果，每个工具卡片紧凑 | 多段 reasoning + 多个 Bash + 阻塞列表 + 子 agent 编排展开 | "Searched 2 patterns… ran 2 background tasks" 一行折叠 |

> P5 是**唯一 codex span > qwen** 的题目。codex 在 SubAgent 编排上的 reasoning 展开比 qwen 还多。

### P6 — error（读不存在的文件）

| qwen — 481px | claude — 333px |
|---|---|
| ![qwen P6](inventory/qwen/matrix/P6/response.png) | ![claude P6](inventory/claude-code/matrix/P6/response.png) |
| 弹出 "是否继续？1.是, 允许一次  2.总是允许… 3.对该用户总是允许… 4.否，建议更改"，等待用户确认后才会失败 | 弹出 "Do you want to proceed? 1. Yes  2. Yes, allow reading from tmp/  3. No" |

> 4 agent 都正确降级了"读不存在文件"的错误（**没有 dump JSON**）。v1/v2 报告里看到的 JSON dump 是 thinking-mode bug 副作用，不是常规行为。

---

## 四、Splash（启动画面）静态对比

| Agent | 截图 | 占用 | 装饰 |
|---|---|---|---|
| **qwen** | ![qwen splash](out/_smoke/02-qwen-splash.png) | ~ 280px / 34.8% | 5 行 ASCII 大字 `QWEN` + 信息面板 + Tips 1 行 + footer hint |
| **claude-code** | ![claude splash](out/_smoke/04-claude-splash.png) | ~ 130px / 12.2% | 像素 logo + Claude Code 名 + model + cwd + 1 行 footer hint，右下 `xhigh · /effort` |
| **codex** | ![codex splash](out/_smoke/03-codex-splash.png) | ~ 200px / 22.1% | 圆角信息面板（model / directory）+ Tip + 输入框 + 底部 status |
| **gemini-cli** | ![gemini splash](out/_smoke/05-gemini-splash.png) | ~ 245px / 27.4% | 小 pixel logo + 4 行编号 Tips + 4 列 status row（workspace / branch / sandbox / model）|
| **opencode** | ![opencode splash](out/_smoke/06-opencode-splash.png) | 全屏 / 100% | 居中大字 wordmark + 居中输入框 + 极少装饰 + 底部 1 行 cwd |

---

## 五、Ctrl+O 同键不同义：3 家行为完全相反

`Ctrl+O` 在 qwen / claude / gemini 三家的语义完全不同。下面用截图直接看。

### qwen Ctrl+O —— 紧凑模式（**收**：隐藏 chrome）

| 默认（compactMode 关）| Ctrl+O 后（compactMode 开）|
|---|---|
| ![qwen 默认](inventory/qwen/ctrl-o-v3-toggled-back.png) | ![qwen 紧凑](inventory/qwen/ctrl-o-v3-after-tools.png) |
| 显示完整 splash + 1 段 meta-reasoning + 3 个独立 ReadFile 面板 | 3 个 ReadFile 聚合成 1 行 `ReadFile × 3 index.js` + meta-reasoning 段消失 |

> 源码：`packages/cli/src/config/keyBindings.ts:54,177` (`TOGGLE_COMPACT_MODE`) + `mergeCompactToolGroups.ts`。**默认 false**（`packages/cli/src/config/settingsSchema.ts:794`）。

### claude Ctrl+O —— 详细 transcript（**展**：增加 chrome）

| 默认 | Ctrl+O 后 |
|---|---|
| ![claude 默认](inventory/claude-code/toggle/ctrl-o-transcript/before.png) | ![claude 展开](inventory/claude-code/toggle/ctrl-o-transcript/after.png) |
| 工具调用聚合到一行：`Read 1 file, listed 1 directory (ctrl+o to expand)` | 展开成完整 `Bash(ls -la)` 输出 + Read 摘要 + 底栏 `Showing detailed transcript · ctrl+o to toggle · ctrl+e to show all` + `verbose` 标记 |

实测 span：268 → **399**，**+131px**。

### gemini Ctrl+O —— SHOW_MORE_LINES（**展**：扩展被截断的内容）

源码：`gemini-cli` 中 Ctrl+O 绑定 `SHOW_MORE_LINES`（`inventory/gemini-cli.md` D 类）。本环境未实测（详 §七）。

### codex Ctrl+T —— 全屏 transcript viewer（不同键，相似目的）

| 默认 | Ctrl+T 后 |
|---|---|
| ![codex 默认](inventory/codex/toggle/ctrl-t-probe/before.png) | ![codex viewer](inventory/codex/toggle/ctrl-t-probe/after.png) |
| 普通响应视图 | 进入全屏 transcript：顶栏 `/ T R A N S C R I P T / / / /` + 完整 `$ ls` 命令 + 输出 + `✓ · 389ms` + 底栏 `↑/↓ to scroll · pgup/pgdn · home/end · q to quit · esc to edit prev` + `100%` 滚动位置 |

实测 span：466 → **839**，**+373px**（接管全屏）。

---

## 六、qwen 已实装但默认关闭的密度相关设置（源码核验）

来源：`packages/cli/src/config/`

| 能力 | 默认值 | 设置 / 快捷键 | 实测 |
|---|---|---|---|
| 紧凑模式（隐藏 tool 输出 + meta-reasoning）| **false** | `ui.compactMode` / **Ctrl+O** | ✅ 见第五节"qwen Ctrl+O" |
| 隐藏 banner | **false** | `ui.hideBanner`（`settingsSchema.ts:814`，对应渲染 `AppHeader.tsx:58`）| 未单独实测 |
| 隐藏 Tips | **false** | `ui.hideTips` | 未单独实测 |
| Shell 输出截断 | **5 行** | `ui.shellOutputMaxLines`（`settingsSchema.ts:803`）| ✅ P2 已生效（输出被截断 + 显示 `+N lines hidden`）|
| 工具调用 N → 1 聚合 | 仅 `compactMode=true` 时启用 | `mergeCompactToolGroups.ts` | ✅ 见第五节"qwen Ctrl+O"前后对比 |
| 工具描述详略切换 | — | **Ctrl+T** `TOGGLE_TOOL_DESCRIPTIONS` | 未量化 |
| 渲染模式（plain / markdown）| — | **Alt+M** `TOGGLE_RENDER_MODE` | 实测 VHS 时序失败，未拿到 PNG |

---

## 七、模式切换 / 快捷键源码核验（D 类）

| 操作 | qwen | claude-code | codex | opencode | gemini-cli |
|---|---|---|---|---|---|
| 紧凑模式 | **Ctrl+O** TOGGLE_COMPACT_MODE | ❌（密度走 API 端 `outputStyle`）| 未核验（codex 源码本地缺）| `<leader>c` session.compact（仅折叠历史，非常驻渲染开关）| ❌ |
| 展开 transcript / 详细工具结果 | Ctrl+S `SHOW_MORE_LINES` | **Ctrl+O** transcript（**同键不同义**）| **Ctrl+T** transcript viewer | `<leader>h` conceal toggle | **Ctrl+O** SHOW_MORE_LINES（**同键又不同义**）|
| Markdown / plain 切换 | **Alt+M** TOGGLE_RENDER_MODE | ❌ | — | ❌ | ❌ |
| Thinking 显隐 | ❌ | **Meta+T** thinkingToggle（`src/keybindings/defaultBindings.ts:72`）| — | command palette `session.toggle.thinking` | ❌ |
| 工具描述详略 | **Ctrl+T** TOGGLE_TOOL_DESCRIPTIONS | Ctrl+T → todo 面板（**同键不同义**）| — | command palette `session.toggle.actions` | — |
| 命令调色板 | ❌ | ❌ | ❌ | **Ctrl+P** ⭐ | ❌ |
| 模式循环 | ❌ | **Shift+Tab** chat:cycleMode | — | — | ❌ |
| 主题切换 | ❌ | ❌ | — | **`<leader>t`** 33 主题 | ❌ |

> **现状描述**：qwen 作为 gemini fork 改了 `Ctrl+O` / `Ctrl+T` / `Ctrl+S` 的语义。来自 gemini 的用户在 qwen 按 Ctrl+O 不会"展开被截断的内容"，而是触发"紧凑模式"。

---

## 八、opencode 的多列布局（特例）

opencode 是本轮唯一带右侧栏的 TUI。

![opencode P1](inventory/opencode/matrix/P1/response.png)

实测 P1 布局：

- **左主列**：用户消息 + 多段 Thinking + 工具调用 + Files / Summary
- **右侧栏**：`Project file listing and summary` + `Context 13,160 tokens / 0% used / $0.00 spent` + LSP 状态
- **底栏**：build agent · model · 累计 token · `ctrl+p commands` 入口 · `OpenCode 1.14.48`

它把信息**横向**铺开。这种布局让纵向 span 量化指标失真（恒为 900），但它本身不是"纵向 TUI"。

---

## 九、本调研未覆盖 / 数据局限

仅描述事实，不引申结论。

1. **gemini-cli 排除**：本环境下 gemini-2.5-pro / flash 在 tool-use 场景报错 `The reasoning_content in the thinking mode must be passed back to the API.`（OpenAI 兼容代理格式，非 Google 原生），疑跨进程 API 拦截。源码核验仍可用，**像素矩阵无 gemini 数据**。详 `analysis/matrix.md §7`。
2. **opencode P2 数据无效**：VHS 抓到 clear-redraw 瞬间黑屏。详 `analysis/data-quality-quarantine.md`。
3. **每 cell 单次录制**：非 P50/P90 统计，模型选择 / token 速率有随机性。
4. **模型变量混淆**：4 agent 用不同 LLM（claude=Opus 4.7 / codex=gpt-5.5 xhigh / qwen=auto/glm-5.1 / opencode=Qwen3.6 Max Preview）。"qwen 啰嗦"包含**模型本身**话痨倾向 + **TUI 渲染**外露策略两个来源。跨模型对照（让 qwen 用同 model 跑同 prompt）未做。
5. **VHS 与真终端的差异**：本调研用 VHS（chromium-headless 渲染），与真实 iTerm 字体引擎有差异。用户提供的 iTerm 真终端截图仅作定性参照，**不参与定量像素矩阵**。
6. **未量化的快捷键效果**：qwen Ctrl+T / Alt+M、opencode `<leader>h` 实测在 VHS 下时序失败（详 `analysis/matrix.md §6`），仅源码层确认存在，未量化前后差异。
7. **codex 源码 D 类**：codex 源码未在本地池中，部分键位（紧凑、Thinking）未源码核验。

---

## 附录：证据索引

| 类别 | 路径 |
|---|---|
| 28 cell 响应 PNG | `inventory/<agent>/matrix/<P>/response.png` |
| 28 cell 完整 GIF | `inventory/<agent>/matrix/<P>/session.gif` |
| 28 cell tape（可复现）| `inventory/<agent>/matrix/<P>/session.tape` |
| Splash 烟囱 | `out/_smoke/0[1-6]-*-splash.png` |
| Ctrl+O / Ctrl+T 模式切换 before/after | `inventory/<agent>/toggle/<key>/{before,after,session.gif}` |
| qwen Ctrl+O v3 实测（主证据）| `inventory/qwen/ctrl-o-v3-{after-tools,toggled-back}.png` |
| 像素 sweep 完整数据 | `analysis/pixel-sweep-output.md` |
| 跨 agent 矩阵 v3 | `analysis/matrix.md` |
| 派生维度 v3 | `analysis/dimensions.md` |
| 数据质量隔离 | `analysis/data-quality-quarantine.md` |
| 5 agent 源码 inventory（D 类）| `inventory/{qwen,claude-code,codex,gemini-cli,opencode}.md` |
| Self-review 日志 | `analysis/review.md` |
