# TUI Comparison — 调研规范

> **执行细节见 [RUNBOOK.md](./RUNBOOK.md)**：agent 驱动 agent 运行 + 录屏 + 度量的可执行 Runbook（一键复现命令、新增 agent/prompt 的 checklist、已知坑与处理）。

本调研的**真实出发点**是：qwen-code 的 TUI 当前存在三个具体痛点 ——
1. **信息密度太低**（同一屏幕承载的有效信息少）
2. **纵向空间使用率低**（大量空行、留白、空面板占用了 vertical real estate）
3. **输出无用信息多**（chrome、footer、提示语挤占内容空间）

调研目的不是泛泛比较 UI，而是**从竞品里抠出可借鉴的具体规范**来改进上述三点。所以必须先**穷尽**每个 agent 的展示/输出特性，再据此派生维度。

## 三阶段流程

```
┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ Phase 1: Inventory  │ ─► │ Phase 2: Synthesis   │ ─► │ Phase 3: Recording   │
│                     │    │                      │    │                      │
│ 每个 agent 一份     │    │ 跨 agent 特性矩阵    │    │ 按派生维度录制对比  │
│ 完整特性清单 + 证据 │    │ + 派生对比维度       │    │ + 出 report.md       │
└─────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

跳过 Phase 1 直接挑维度是错误的（我们犯过，被打回），必须按顺序走。

---

## Agent 池

| ID | CLI | 本地状态 | 认证 | 入口验证截图 |
|---|---|---|---|---|
| `qwen` | `qwen` v0.15.10 | ✅ | Idealab API Key | `out/_smoke/02-qwen-splash.png` |
| `claude` | `claude` v2.1.138 | ✅ | Claude Max | `out/_smoke/04-claude-splash.png` |
| `codex` | `codex` v0.130.0 | ✅ | 已配置 | `out/_smoke/03-codex-splash.png` |
| `gemini` | `gemini` | ❌ 未装 | Google AI Studio | — |
| `opencode` | `opencode` | ❌ 未装 | OpenRouter/Anthropic | — |

`qwen` 不是普通参赛选手，**它是被改进对象**。其他四个是参照系。

---

## Phase 1 — 特性枚举（per-agent inventory）

### 目标

每个 agent 产出一份 `inventory/<agent>.md`，**穷尽**该 agent 所有"会影响屏幕内容/布局的能力"。任何"竞品有但 qwen 没有"或反之的特性，都可能成为派生维度的输入。

### 信息来源（按推荐顺序）

1. **源码**（如果是开源）—— 最权威，能直接看键盘绑定、render 分支、设置项
2. **官方文档** —— /help、settings.json schema、官网指南
3. **应用内** —— 启动后 `/help`、`/settings`、`/keys`
4. **`--help`** —— 命令行参数
5. **运行时观察** —— 跑各种 prompt 看实际渲染

### 必填类别（A–F）

每个 inventory 文件必须有以下 6 个小节，没有的特性也要写"无"：

#### A. 静态布局（Static Layout）
- 启动 splash（有/无、几行、是否可关闭）
- 顶部 / 底部状态栏（位置、内容、固定还是流动）
- 对话区与输入区的边界与高度策略
- 输入框样式（边框、占用行数、placeholder）
- Footer 提示（如 qwen 的 "按 ? 查看快捷键"、claude 的 "? for shortcuts"）
- 左右 margin / padding 政策
- 主题/配色系统（是否支持 light/dark、可否切换）

#### B. 内容渲染（Content Rendering by type）
- 用户消息（缩进、前缀符号、是否高亮）
- 助手文本流式（token-by-token、有无打字机光标）
- Markdown：标题 / 列表 / 引用 / 分割线
- 表格
- 代码块：行内 / 围栏 / 语言高亮 / 是否带语言标签
- 文件 diff（增删行配色）
- 长输出截断策略（多少行后截断、提示语、能否展开）
- 边框 / 面板 / 圆角字符的使用密度
- Spinner / 进度指示器（样式 + 占多少行）
- 文件路径引用（是否高亮、点击跳转）

#### C. Agent 活动展示（Tool / SubAgent / Thinking）
- 工具调用 preamble（名称 + 参数怎么显示）
- 工具状态（queued / running / done / failed 的视觉区分）
- 工具结果（默认折叠还是展开、展开后多少行）
- 多工具并行（如何视觉分组）
- 子 agent 调用（缩进？嵌套？面板？）
- Thinking / 推理（是否展示、配色、是否折叠）
- "Continue?" 一类的中断决策点

#### D. 模式切换 / 快捷键（**这是核心，对应 qwen 的 Ctrl+O 类需求**）
列出所有**会改变屏幕渲染**的键盘快捷键和命令。表格形式：

| Key / Cmd | 作用 | 视觉影响 |
|---|---|---|
| Ctrl+O | toggle compact mode | 缩短行间距、隐藏次要 chrome |
| Alt+M | toggle render mode | 切换 plain/markdown 渲染 |
| /compact | 折叠历史 | 隐藏旧对话保留摘要 |

#### E. Footer / 元数据（Metadata strip）
- Token 数 / cost 显示位置和格式
- Model 名 / context size
- 处理时间 / 延迟
- 状态指示器（idle / typing / streaming / waiting tool）
- 工作目录显示

#### F. 信息密度指标（**针对 qwen 痛点的专项观测**）
- 启动 splash 占多少行（measured against 900px / typical terminal）
- 每轮对话的纯 chrome 行数（边框 + 空行 + footer）vs 内容行数
- 空行政策（turn 之间、消息内、面板上下是否插空行）
- 是否有"plain" / "minimal" / "compact" 模式可以彻底关闭装饰
- 默认渲染下，1080p 终端能看到几个完整对话轮次

### 证据要求

- 每个特性条目后必须挂证据：源码行号链接（如 `packages/cli/src/.../foo.tsx:42`）或截图路径（`inventory/<agent>/<feature-id>.png`）
- **没有证据的条目视为臆测**，PR review 时会被打回
- 截图统一通过 VHS 录，命名 `<agent>-<feature-id>.png`，存 `inventory/<agent>/` 子目录

---

## Phase 2 — 跨 agent 综合（cross-agent synthesis）

只在 Phase 1 至少完成 3 个 agent 后才开始。产出两份文件：

### 2.1 `analysis/matrix.md` — 特性矩阵

行 = Phase 1 出现过的所有特性的并集；列 = 各 agent；单元格 = 有/无 + 一行风格描述 + 证据链接。

矩阵让我们一眼看出"qwen 缺什么 / 多什么 / 做法跟谁更接近"。

### 2.2 `analysis/dimensions.md` — 派生的对比维度

从矩阵里提炼**值得深入对比**的维度，每个维度必须满足：
1. 与 qwen 的三大痛点之一相关（密度 / 纵向空间 / 输出噪声）
2. 跨 agent 有明显差异（同质的不值得对比）
3. 可被一组录制清楚展示

每个维度的格式：

```markdown
### Dim-X: <名字>
- 痛点对齐: 信息密度 / 纵向空间 / 输出噪声
- 跨 agent 差异点: <一句话>
- 触发场景: <用什么 prompt / 操作能展示这个维度>
- 录制要求: 哪些 agent 必须录、需要哪些 step 截图
```

维度由 Phase 1 数据驱动，不要预先框死个数。

---

## Phase 3 — 录制（recording）

只录 Phase 2 里被列入 `dimensions.md` 的维度。

### 产物目录（每个 cell）

```
out/<agent>/<dim-id>/
├── session.gif       # 整段交互（必有；VHS 也会同时产 .mp4，本仓库不收纳）
├── session.txt       # 终端文本快照（必有）
├── session.tape      # 当次实际执行的 tape（必有）
└── steps/            # 关键帧（每个对应一个观测点）
    ├── S0-baseline.png    # 触发前的基线状态
    ├── S1-trigger.png     # 触发动作（输入 prompt / 按快捷键）
    ├── S2-during.png      # 过程中（流式 / spinner / tool 调用）
    ├── S3-settled.png     # 稳定后
    └── S4-mode-toggled.png  # 如果有模式切换，切换后状态
```

未触发的 S* 不强求；触发了的必须截。文件名严格统一，便于 `analyze.ts` 按位置对齐。

### Tape 写法约定（VHS 0.11.0 已知坑）

详见 `out/_smoke/` 实测结论：

1. 文件名含 `-` 或数字开头**必须加引号**：`Output "01-foo.gif"`
2. `Wait+Screen /pattern/` 匹配整屏，会被 Type 的命令文本误触发 —— 标记选只在响应中出现的字符
3. `Output xxx.txt` 对一次性命令会丢滚出去的内容，对全屏 TUI 没问题
4. `Set` 块必须在 `Type` 之前
5. 避免超过 60s 的 Sleep
6. 所有 tape 必须 `Source "_common.tape"` 共享字体/尺寸

---

## 新 Agent 接入清单（onboarding checklist）

每一步必须有证据 —— **没有截图等于没做**。

| 步骤 | 动作 | 证据要求 |
|---|---|---|
| 1 | 全局安装 + 认证 | `which <cli>` + `<cli> --version` 输出文本 + 一次成功问答的截图 |
| 2 | SPEC §Agent 池增加一行 | git diff |
| 3 | 跑 splash 烟囱 tape | `out/_smoke/NN-<agent>-splash.png` |
| 4 | 完成 Phase 1：`inventory/<agent>.md` | 文件 + 所有特性的源码链接或截图 |
| 5 | 更新 `analysis/matrix.md` 增加该 agent 列 | git diff |
| 6 | 跑 Phase 2 派生维度涉及的录制 | `out/<agent>/<dim-id>/` 完整产物 |
| 7 | 更新 `report.md` 增加该 agent 对比 | git diff |

---

## 不在范围内（明确剔除）

- 性能基准（响应延迟、token 速率） — 看各 CLI 自带 metrics
- 答案准确性 / 质量评测
- MCP / 插件生态
- 鼠标交互
- 完全可重复性工程化（接受 ±1 帧差异）
- 终端模拟器差异（统一用 VHS 内置环境）

---

## 修订记录

| 日期 | 改动 |
|---|---|
| 2026-05-11 | 初版（6 个预设维度，方向错） |
| 2026-05-11 | **v2**：重写为三阶段（Inventory → Synthesis → Recording），围绕 qwen-code 的密度/纵向空间/噪声三大痛点，加入"模式切换快捷键"为强制类别 D |
