# Inventory: opencode CLI v1.14.48

> **状态**：🟢 源码分析完成（`packages/opencode/src/cli/cmd/tui/`） | A/D/E/F 完整；B/C 待运行实测整合
> **二进制**：`~/.opencode/bin/opencode` v1.14.48
> **源码**：`/Users/gawain/Documents/codebase/github/opencode/packages/opencode/`
> **TUI 库**：`@opentui/core` + `@opentui/solid`（自研 JSX-flex TUI 框架，本调研不深入其内部）
> **范围说明**：只记录用户可见 UI 行为。

> **注意**：opencode 还有一个 `packages/app/`（SolidJS 桌面 Web GUI），与本调研无关。本文件只针对 CLI TUI 变体。

---

## A. 静态布局（**与其他 4 家完全不同范式**）

| 区域 | 看到什么 | 证据 |
|---|---|---|
| Splash | 大字 "opencode" wordmark **居中**，上下大量留白；下方输入框 + Tip "Ask anything..." | `src/cli/cmd/tui/component/logo.tsx:555-890`、布局在 home.tsx:63-88 |
| 居中机制 | Flex `flexGrow={1}` 上下撑开，logo + 输入框夹中间 | `home.tsx:63-88` |
| 输入框 max-width | **75 字符**（防止宽屏拉横）| `home.tsx:72` |
| 底部状态栏 | 全宽，左 cwd（多行换行）右 version | `routes/session/footer.tsx:9-91`、`feature-plugins/home/footer.tsx:58-76` |
| 对话区 | session 模式下进入 SessionTimeline | `routes/session/index.tsx` |
| **侧边栏** | **session 模式右侧有 Context/LSP/总结面板**（实测验证）| `routes/session/index.tsx`、键 `<leader>b` 控制 |
| Splash 测量行数 | ~12 行（splash 占满全屏，大部分是空白）| `out/_smoke/06-opencode-splash.png` |

**核心范式差异**：唯一一个用**居中布局**和**侧边栏**的 TUI。其他 4 家都是左对齐 + 顶到底铺。

## D. 模式切换 / 快捷键（**Leader-key 模式，区别于 Ctrl+X**）

来源：`src/cli/cmd/tui/config/keybind.ts`

### 命令调色板（Cmd Palette）

| Key | 作用 |
|---|---|
| **Ctrl+P** | 打开命令调色板（所有 toggle 命令的入口）| `keybind.ts:53` |

### Leader-key 快捷键（与渲染相关）

| Key | 命令 | 视觉效果 | 源码 |
|---|---|---|---|
| `<leader>c` | session.compact | 在接近上下文限制时摘要长 session | `keybind.ts:76` |
| `<leader>h` | session.toggle.conceal | **切代码块隐藏** | `keybind.ts:115` |
| `<leader>t` | theme_list | 打开主题选择对话框 | `keybind.ts:58` |
| `<leader>b` | sidebar_toggle | **切侧边栏显隐**（这是它独有的能力）| `keybind.ts:61` |

### 只在调色板中可用（无键位）

| 命令 | 视觉效果 | 源码 |
|---|---|---|
| session.toggle.thinking | **切 thinking 块显隐** | `keybind.ts:117` |
| session.toggle.actions | **切工具详情显隐** | `keybind.ts:116` |
| session.toggle.timestamps | 切消息时间戳显隐 | `keybind.ts:77` |
| session.toggle.generic_tool_output | 切通用工具输出显隐 | `keybind.ts:78` |
| theme_switch_mode | 切 light/dark 模式 | `keybind.ts:59` |
| theme_mode_lock | 锁定/解锁主题模式 | `keybind.ts:60` |
| scrollbar_toggle | 切会话滚动条 | `keybind.ts:62` |

### 关键差异（vs qwen Ctrl+X 风格）

- **opencode 没有 Ctrl+X 单键 toggle**，全部走 **leader key + 二次按键** 或 **Ctrl+P 命令调色板**
- **没有"compact mode"全局开关** —— 改成**多个独立可见性 toggle**（conceal / thinking / actions / timestamps / generic_tool_output）
- 这是**两种不同的密度控制哲学**：qwen "一键全收"，opencode "按维度分别收"

## E. 底部状态栏

**Home 屏幕** (`feature-plugins/home/footer.tsx:58-76`):
- 左：cwd + git branch（可选）
- 中右：权限计数 △ / LSP 计数 · / MCP 状态 ⊙ / status link 提示
- 最右：app version

**Session 屏幕** (`routes/session/footer.tsx:9-91`):
- 左：cwd
- 右：权限计数 / LSP 指示 / MCP 计数 + 状态 / 帮助提示 (/status)
- **不显示版本号**（与 Home 不同）

实测（`inventory/opencode/files-prompt-response.png`）还看到：
- "Build · DeepSeek v4 Pro IdeaLab" agent + model 行
- "12.2K ctrl+p commands"（token 计数 + 调色板提示）
- 右侧**独立侧边栏**显示 "Context: 12,189 tokens, 0% used, $0.00 spent" + "LSP" 信息

## F. 密度 / 冗余设置

来源：`src/cli/cmd/tui/config/tui-schema.ts:8-22`

| 设置 | 默认 | 效果 |
|---|---|---|
| `leader_timeout` | 2000ms | leader 键超时 |
| `scroll_speed` | 配置 float | 滚动速度 |
| `scroll_acceleration` | bool | 滚动加速 |
| `diff_style` | "auto" | "auto"/"stacked" —— 自动按终端宽度调整 diff 渲染 |
| `mouse` | true | 鼠标支持 |

**关键发现：opencode 没有显式的 `compact` / `verbose` / `dense` / `quiet` 配置**。

密度控制的方式：
1. **侧边栏 toggle**（`<leader>b`）—— 整列收起
2. **多个 toggle 命令**（conceal / thinking / actions / timestamps / generic_tool_output）—— 各维度独立
3. **session.compact 命令** —— 摘要历史
4. **响应式宽度**（`diff_style: auto`）—— 自动适应

## Slash 命令影响展示

**opencode 没有 slash 命令**。所有操作走 **Ctrl+P 调色板** + **leader key**。这是与其他 4 家最大的交互差异之一。

## B / C 类（运行时实测）

实测产物：`inventory/opencode/files-prompt-response.png`、`files-prompt.gif`

观察到的渲染元素：
- 用户消息：左侧**蓝色竖线 + 高亮块**包围（`>` 前缀 + 反相文本）
- Thinking 块：**斜体灰色** `Thinking: ...`（与正文有视觉区分）
- 工具调用：`→ Read <path>`（箭头前缀 + 路径）
- 工具结果：紧贴工具调用下方
- Agent + model 标记：当前 turn 末尾显示 `□ Build · DeepSeek v4 Pro · 8.6s`（agent + model + 耗时）
- 错误：JSON 错误直接以原始 JSON 形式渲染（无视觉降级，**这是个槽点**）

**侧边栏**（实测唯一一家有的）：
- 自动总结当前 prompt 主题（"Directory listing and project summary"）
- 实时显示 Context / token / cost
- LSP 状态行

组件位置：
- 工具调用：`routes/session/index.tsx`（消息渲染主循环）
- 主题：`context/theme.tsx`（**33 个内置主题** + 插件主题 + 自定义主题，最丰富）

---

## 关键提炼（给 qwen 借鉴）

1. **侧边栏 / 多列布局** —— 解决"上下文/元数据想看但不想占主流" 的问题，**值得 qwen 借鉴**
2. **细粒度 visibility toggle**（conceal / thinking / actions / timestamps / generic_tool_output）—— qwen 的 `compact mode` 是粗粒度，opencode 是细粒度，**两种思路可对比**
3. **命令调色板取代单键 toggle** —— 不需要记 10 个 Ctrl+X，按一个 Ctrl+P 搜功能 —— **可能更利于发现性**
4. **33 个内置主题** + 插件机制 —— 主题生态远超其他家
5. **响应式 diff_style** —— 终端宽度自适应 —— qwen 没有这能力
6. **居中布局 + 大量空白** —— 视觉冲击但**反密度**（与 qwen 优化目标相反，**不应借鉴**）
7. **错误渲染就是原始 JSON** —— 反例，qwen 也有类似问题
