# Inventory: Gemini CLI

> **状态**：🟢 D 类源码核验完整 | A/E/F 完整；B/C 组件定位
> **源码**：`/Users/gawain/Documents/codebase/opensource/gemini-cli/packages/cli/src/`
> **关键**：qwen-code 是从 gemini-cli **fork** 而来，本文档着重记录**两边的展示行为差异**（这是 qwen 最高价值的对照样本）
> **范围说明**：只记录用户可见 UI 行为，Ink/React 内部机制跳过。

---

## A. 静态布局（用户可见）

| 区域 | 看到什么 | 证据 |
|---|---|---|
| Splash | ASCII logo + 版本 + 用户身份 + Tips；窄于 60 字符切列布局 | `AppHeader.tsx:30-173` |
| 对话区 | 滚动消息列表（Box）| 根组件 |
| 输入框（Composer）| 多行文本输入 | `Composer.tsx` |
| Footer | CWD / Model / Context % / Sandbox / Memory 一行多段，**配置驱动** | `Footer.tsx:1-200+` |
| Status display | 横向 pill 指示器（spinner / approval mode / hook 执行）| `StatusDisplay.tsx` |

空间分配（实测可估）：~5-10% header / ~75-85% 对话 / ~5-10% footer / ~5% 输入。

## D. 模式切换快捷键（**完整核验，与 qwen 强对照**）

来源：`packages/cli/src/config/keyBindings.ts`

### 影响渲染的键

| Key | 命令 | 视觉效果 | 源码 | qwen 同键吗？|
|---|---|---|---|---|
| **F12** | SHOW_ERROR_DETAILS | 切 debug 控制台 | `packages/cli/src/ui/key/keyBindings.ts:388` | ❌ qwen 删了 |
| **Ctrl+T** | SHOW_FULL_TODOS | 切完整 TODO 列表 | `packages/cli/src/ui/key/keyBindings.ts:389` | ⚠️ qwen 改成 TOGGLE_TOOL_DESCRIPTIONS |
| **F4** | SHOW_IDE_CONTEXT_DETAIL | IDE 上下文详略（侧栏）| `packages/cli/src/ui/key/keyBindings.ts:390` | ⚠️ qwen 改用 Ctrl+G |
| **Alt+M** | TOGGLE_MARKDOWN | **切 Markdown 渲染开关** | `packages/cli/src/ui/key/keyBindings.ts:391` | ✅ qwen 同键名 TOGGLE_RENDER_MODE |
| **Ctrl+O** | SHOW_MORE_LINES | **展开/折叠内容块** | `packages/cli/src/ui/key/keyBindings.ts:396` | ❌ qwen 把 Ctrl+O 改成 TOGGLE_COMPACT_MODE，**完全不同语义** |
| **Ctrl+S** | TOGGLE_MOUSE_MODE | 切鼠标模式（滚动/点击）| `packages/cli/src/ui/key/keyBindings.ts:393` | ⚠️ qwen 改成 SHOW_MORE_LINES |
| **Ctrl+Y** | TOGGLE_YOLO | YOLO 模式（自动批准）| `packages/cli/src/ui/key/keyBindings.ts:394` | ❌ qwen 删了，改成 RETRY_LAST |
| **Shift+Tab** | CYCLE_APPROVAL_MODE | 循环：default → auto_edit → plan | `packages/cli/src/ui/key/keyBindings.ts:395` | ❌ qwen 未绑定 |
| **F9** | TOGGLE_COPY_MODE | 切复制模式（alt buffer 内）| `packages/cli/src/ui/key/keyBindings.ts:392` | ❌ qwen 删了 |

### 关键差异速览

**qwen 改了语义的键**（最危险，用户预期会被打乱）：
- **Ctrl+O**：gemini = 展开长内容；qwen = 紧凑模式 —— 同键完全不同含义
- **Ctrl+T**：gemini = 显示完整 TODO；qwen = 切工具描述详略
- **Ctrl+S**：gemini = 鼠标模式；qwen = 展开更多行

**qwen 删掉的能力**：F12 / F4 / F9 / Ctrl+Y / Shift+Tab approval cycle / Copy mode / IDE detail / YOLO

**qwen 加上的**：TOGGLE_COMPACT_MODE（这是 qwen 独有的"密度开关"）

## E. Footer / 状态栏（**granular toggle，gemini 最强项**）

每一项都可独立显隐，全部在 `settingsSchema.ts` 里：

| 项 | 设置键 | 默认 | 源码行 |
|---|---|---|---|
| CWD | `ui.footer.hideCWD` | 显示 | `settingsSchema.ts:669-676` |
| Model + 上下文 token | `ui.footer.hideModelInfo` | 显示 | `settingsSchema.ts:687-694` |
| 上下文百分比 | `ui.footer.hideContextPercentage` | **隐藏（true）** | `settingsSchema.ts:696-703` |
| Sandbox 状态 | `ui.footer.hideSandboxStatus` | 显示 | `settingsSchema.ts:678-685` |
| Memory 使用 | `ui.showMemoryUsage` | 隐藏 | `settingsSchema.ts:726-733` |
| Tips | `ui.hideTips` | 显示 | `settingsSchema.ts:582-589` |
| Context summary | `ui.hideContextSummary` | 显示 | `settingsSchema.ts:629-637` |
| Banner | `ui.hideBanner` | 显示 | `settingsSchema.ts:620-627` |
| Footer 整条 | `ui.hideFooter` | 显示 | `settingsSchema.ts:707-714` |
| Footer 标签行 | `ui.footer.showLabels` | **显示（true）** | `settingsSchema.ts:659-667` |
| 行号 | `ui.showLineNumbers` | **显示（true）** | `settingsSchema.ts:735-742` |
| 引用 | `ui.showCitations` | 隐藏 | `settingsSchema.ts:744-751` |

**Footer 顺序可配**：`ui.footer.items` 数组（`settingsSchema.ts:648-657`）—— 用户可决定先后顺序。

**关键洞察**：gemini 用**设置驱动 + 默认稍微保守**的模型，**没有键盘快捷键来开关每一项**。qwen 简化了这套，只剩 `compactMode` 一个总开关。

## F. 密度 / 冗余设置

| 设置 | 默认 | 效果 | 源码 |
|---|---|---|---|
| `compactToolOutput` | **true** | 工具输出压缩展示（目录列表、文件读取等）| `settingsSchema.ts:610-619`；运行时 `useGeminiStream.ts:80` 检查 |
| `hideWindowTitle` | false | 隐藏窗口标题栏 | `settingsSchema.ts:521-529` |
| `inlineThinkingMode` | `'off'` 或 `'full'` | **内联展示模型 thinking** | `settingsSchema.ts:530-541` |
| `hideTips` | false | 启动 Tips | `settingsSchema.ts:582-589` |
| `hideContextSummary` | false | GEMINI.md + MCP server 摘要（输入框上方）| `settingsSchema.ts:629-637` |
| `hideBanner` | false | 启动 banner | `settingsSchema.ts:620-627` |
| `hideFooter` | false | 整条 footer | `settingsSchema.ts:707-714` |
| `showLineNumbers` | true | 聊天中行号 | `settingsSchema.ts:735-742` |
| `showCitations` | false | 文本引用 | `settingsSchema.ts:744-751` |

**核心**：gemini 走"**多个独立显隐开关 + 默认 compactToolOutput=true**"的路线。qwen 把 `compactToolOutput` 推广成全局 `compactMode`，把其余 hide* 设置基本删了。

## Slash 命令影响展示

**Gemini 几乎没有**。搜索 `packages/cli/src/commands/` 找 `/compact /verbose /clear /output-style` —— **全无**。展示控制 = 键盘 + 设置，**不走 slash 命令**。

## B. 内容渲染（运行时实测）

实测产物：`inventory/gemini-cli/files-prompt-response.png`、`files-prompt.gif`

- **用户消息**：灰色全宽 bar 高亮，`>` 前缀
- **助手文本**：本次实测中**因 API 错误未产出完整响应**（错误："The reasoning_content in the thinking mode must be passed back to the API"，由模型 thinking mode + endpoint 配置不匹配引起，与渲染无关）
- 错误以**原始 JSON dump** 形式直接打印：`{"error":{"message":"...","type":"invalid_request_error",...}}` —— **错误渲染降级缺失**
- **Splash banner 在交互过程中保留**（不像 claude 会清掉/压缩）—— **持续占用顶部 ~5 行**

## C. Agent 活动展示（运行时实测）

- **工具调用以"✓ ReadFile <path>" 单行形式**，无外框，紧凑：
  ```
  ✓ ReadFile README.md
  ✓ ReadFile package.json
  ✓ ReadFile index.js
  ```
- 比 qwen 没有外框，比 claude 没有合并 —— **居中密度**
- 实测因 API 错误，没看到 thinking 块（虽然源码里有 `inlineThinkingMode` 设置）
- **没有 SubAgent 行为**（同 qwen）

## 组件位置（参考）

- Markdown：`MarkdownDisplay.tsx`
- 工具输出：`ToolGroupDisplay.tsx`（受 `compactToolOutput` 控制）
- 消息组件：`*Message*.tsx`（AssistantMessage、ToolResultMessage 等）
- 滚动：`useBatchedScroll.ts`、`useAnimatedScrollbar.tsx`

---

## 关键提炼（**给 qwen 优化的参考重点**）

1. **Footer 颗粒化显隐**：gemini 把状态栏拆成 ~10 个独立开关 + 顺序可配，**qwen 在 fork 时把这套阉割了**。如果 qwen 想做"信息密度优化"，应该恢复或重设计这层
2. **Ctrl+O 语义冲突**：gemini = 展开内容（增加可见信息），qwen = 紧凑模式（减少 chrome）—— **完全相反**。这个分歧值得在 Phase 2 单独讨论
3. **inlineThinkingMode** ('off'/'full'): gemini 有独立 thinking 内联开关 —— qwen 是否保留？需查
4. **hideBanner / hideTips / hideContextSummary**：gemini 提供启动 chrome 的细粒度控制，qwen 似乎没保留
5. **没有 slash 命令做展示控制**：gemini 与 qwen 都走"键盘 + 设置"路线，与 claude 的"/compact 命令"不同
