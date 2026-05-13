# Inventory: Claude Code v2.1.138

> **状态**：🟢 D 类源码核验完整 | A/E/F 部分；B/C 待运行实测
> **源码**：`/Users/gawain/Documents/codebase/opensource/claude-code/src/`
> **范围说明**：本文件只记录**用户可见的 UI 行为**。Ink/React 组件内部机制不进入本调研。

---

## A. 静态布局（用户可见）

| 区域 | 看到什么 | 证据 |
|---|---|---|
| Splash | 简版 logo + 活动 feed + 项目 onboarding（首次）+ 版本/模型行 | `src/components/LogoV2/LogoV2.tsx:47-80+` |
| 底部状态栏 | 单行，**默认即开**，可由用户用 hook 命令完全自定义 | `src/components/StatusLine.tsx:30-35, 65-80` |
| 输入框 | 单行 prompt，下挂 footer（快捷键提示） | `src/components/PromptInput/PromptInput.tsx` |
| Footer 提示 | "? for shortcuts"、Shift+Tab 模式循环提示等 | `src/components/PromptInput/PromptInputFooterLeftSide.tsx:251` |
| 对话区 | 虚拟列表（VirtualMessageList），工具调用内联在消息流里 | `src/screens/REPL.tsx:100+` |
| Splash 测量行数 | ~5 行（实测 `out/_smoke/04-claude-splash.png`） | 烟囱截图 |

## D. 模式切换快捷键（**完整核验**）

来源：`src/keybindings/defaultBindings.ts`

### 影响渲染的键

| Key | 命令 | 视觉效果 | 源码 |
|---|---|---|---|
| **Shift+Tab** | chat:cycleMode | 循环切换权限模式（manual / auto / restricted）—— 模式名出现在状态栏 | `defaultBindings.ts:69` |
| **Ctrl+T** | app:toggleTodos | 切换 todo 面板（none / tasks / teammates 三态） | `defaultBindings.ts:43` |
| **Ctrl+O** | app:toggleTranscript | 切换**只读 transcript 模式**（看完整历史，禁用输入）| `defaultBindings.ts:44` |
| **Ctrl+L** | app:redraw | 终端重绘（清屏） | `defaultBindings.ts:42` |
| **Ctrl+Shift+B** | app:toggleBrief | 切换 brief 过滤（feature flag 内部）| `defaultBindings.ts:46` |
| **Meta+P** (Cmd+P) | chat:modelPicker | 打开模型选择器（弹层） | `defaultBindings.ts:70` |
| **Meta+O** (Cmd+O) | chat:fastMode | 切换 fast mode | `defaultBindings.ts:71` |
| **Meta+T** (Cmd+T) | chat:thinkingToggle | **切换 thinking 显示** | `defaultBindings.ts:72` |
| **Meta+M** (Cmd+M) | chat:cycleMode | Windows Terminal 无 VT 模式下的 Shift+Tab 回退 | `defaultBindings.ts:30` |
| **Ctrl+X Ctrl+K** | chat:killAgents | chord 组合键，终止后台 agent | `defaultBindings.ts:68` |

### 关键差异（vs qwen 的同键位）

| Key | qwen | claude |
|---|---|---|
| **Ctrl+O** | toggle **compact mode**（缩短行间距）| toggle **transcript mode**（只读历史）—— 完全不同语义 |
| **Ctrl+T** | toggle tool descriptions | toggle todo panel |
| **Shift+Tab** | （qwen 未绑定模式切换）| 循环权限模式 |
| **Alt/Meta+M** | TOGGLE_RENDER_MODE | cycleMode 回退键 |
| **Meta+T** | 无 | **toggle thinking 显示** |

**观察**：claude 把"模式切换"集中在 Shift+Tab（权限模式）和 Meta 系列（model/fast/thinking），思路是"功能开关"而非 qwen 的"密度开关"。**claude 没有一个直接对应 qwen Ctrl+O 紧凑模式的快捷键** —— 它根本不暴露密度调节给键盘。

## E. 底部状态栏（**默认即开 + 完全可自定义**）

| 默认显示 | 来源 |
|---|---|
| Model name | `src/components/StatusLine.tsx:65-80` |
| Permission mode | 同上 |
| CWD | 同上 |
| Session name | 同上 |
| Rate limits（5h / 7-day utilization %） | 同上 |
| Context % | 同上 |
| Output style | 同上 |
| Version、effort suffix | 同上 |

**核心机制**：用户可在 `settings.statusLine.command` 配置**任意 shell 命令**，其 stdout 渲染为状态栏。Padding 可配。这是 claude 独有的"用户完全控制状态栏"模型。

**Cost 不在默认显示**，cost 跟踪在 `src/cost-tracker.ts` 但未渲染到状态栏。

## F. 信息密度 / 冗余设置

| 设置 | 默认 | 效果 | 来源 |
|---|---|---|---|
| `verbose` | false | 显示详细 debug 输出，运行时可通过 AppState 同步切换 | `src/utils/config.ts:592`、`src/tools/ConfigTool/supportedSettings.ts:42-46` |
| `autoCompactEnabled` | **true** | 上下文满时自动 /compact 折叠 | `config.ts:594`、`supportedSettings.ts:54-58` |
| `outputStyle` | 'default' | Explanatory / Learning / 自定义 —— **影响系统提示词层面的啰嗦度**，非渲染层 | `src/constants/outputStyles.ts:39-135` |

**重要发现**：claude **没有内置的"紧凑/精简/quiet 终端渲染模式"**。密度控制走两条路：
1. **API 端**：通过 `outputStyle` 让模型本身少说话
2. **上下文管理**：autoCompact 把老消息折叠

**这与 qwen 思路完全不同**：qwen 有显式的"渲染模式开关"（Ctrl+O 紧凑），claude 选择"让模型本身简洁"+"上下文自动管理"。

## 影响展示的 Slash 命令

| 命令 | 作用 | 来源 |
|---|---|---|
| `/compact` | 清历史保留摘要 | `src/commands/compact/index.ts:4-16` |
| `/output-style` | 已废弃，改用 /config | `src/commands/output-style/index.ts:4-12`（`isHidden: true`） |

**没有** `/dense`、`/quiet`、`/minimal` 这类纯展示开关命令。

## B. 内容渲染（运行时实测）

实测产物：`inventory/claude-code/files-prompt-response.png`、`files-prompt.gif`

- **用户消息**：白色高亮全宽 bar，`›` 前缀明显
- **助手文本**：浅色，紧贴用户消息下方
- **列表**：用 `●` bullet，**单行内联多文件**（"Files: index.js, package.json, README.md."）—— 极致紧凑
- **没有展示 thinking**（默认隐藏，Meta+T 可切）

## C. Agent 活动展示（运行时实测，**密度冠军**）

- **工具调用结果折叠成单行摘要**：`Read 1 file, listed 1 directory (ctrl+o to expand)` —— **整个工具流程压成 1 行**
- 默认不展示工具参数、不展示工具结果，只给一个聚合计数 + 展开提示
- 末尾标记：`✱ Baked for 33s` —— 单行时间标记
- **建议续写**：响应完后输入框自动填好 `Show me what's in index.js` 作为下一步提示
- **整个 turn 占用：~7 行**（vs qwen ~25 行，vs codex ~22 行）

> Ctrl+O 在 claude 里是"展开工具结果"，在 qwen 里是"压缩全局密度"，**完全相反的语义**

## 组件位置（参考）

- 工具调用渲染：`src/components/messages/AssistantToolUseMessage.tsx`
- 消息流：`src/screens/REPL.tsx` 用 VirtualMessageList
- 内联 diff：`src/components/StructuredDiff/`（代码感知 diff）
- 输入交互：`src/components/PromptInput/PromptInput.tsx`（支持 vim 模式、补全、历史）

---

## 关键提炼（给 Phase 2 矩阵备用）

1. **状态栏完全用户可编程**（`settings.statusLine.command`）—— qwen 没有这能力
2. **密度控制走 API 层和上下文管理**，不是渲染开关 —— 设计哲学差异
3. **快捷键集合更精简**（10 个左右 vs qwen 10+ 个），且更聚焦"功能模式"而非"展示开关"
4. **没有 Alt+M 这类"plain/markdown 切换"**
5. **Splash 极简**（~5 行 vs qwen ~10 行）—— 启动 chrome 占用近半
6. **Thinking 有独立切换键**（Meta+T） —— qwen 无
