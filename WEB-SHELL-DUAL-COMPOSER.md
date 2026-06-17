# Web-Shell 双交互模式设计文档

## 目标

在 web-shell 中支持两套输入框交互样式，通过 `composerVariant` 入参控制切换：

- **terminal**（默认）：保留现有终端行样式（`> prefix`、border 分隔线、hints 行）
- **chat**：聊天框样式（圆角输入框、发送按钮、sans-serif 字体、无 prefix）

两套样式共享 CodeMirror 核心逻辑（autocomplete、history、keymap、tags、followup），仅 UI 壳不同。外部通过 `composerRef` / `WebShellComposerApi` 调用时完全无感。

## 现状分析

### 输入框当前架构

- `App.tsx` 渲染 `<div className={styles.composer}>` 包裹 `<Editor>` 组件
- `Editor.tsx`（~2072 行）承担全部职责：CodeMirror 状态/扩展 + UI 壳 + 事件处理
- 定制机制：`WebShellCustomization` Context 已支持 `renderFooter`、`renderWelcomeHeader`、`renderToolHeaderExtra`，但**无输入框变体机制**

### Editor 内部职责拆分

| 职责            | 说明                                                                   | 约占代码量 |
| --------------- | ---------------------------------------------------------------------- | ---------- |
| CodeMirror 核心 | extensions 组装、state 创建、keymap、completion source、highlight      | ~40%       |
| 交互逻辑        | history、followup、tags、图片粘贴、composerInput 同步、imperative API  | ~20%       |
| UI 壳           | prefix `›`、borderTop/borderBottom、hints 行、search overlay、tag 渲染 | ~40%       |

terminal 与 chat 的差异在 **UI 壳**层，核心和交互逻辑完全共享。

## 设计方案

### 整体结构

```
现有 Editor (2072行)
    ├── CodeMirror 核心
    ├── 交互逻辑
    └── UI 壳（terminal 风格）

↓ 拆成 ↓

useComposerCore() hook    ← 共享逻辑
    ├── CodeMirror state/extensions 创建
    ├── keymap 绑定（Enter 提交、Shift-Enter 换行等）
    ├── autocomplete source 注册
    ├── inputHighlight / inputHighlightTheme
    ├── useInputHistory 集成
    ├── followup suggestion 接受/清除
    ├── WebShellComposerTag Decoration 逻辑
    ├── 图片粘贴处理
    ├── composerInput / composerInputVersion 同步
    └── WebShellComposerApi 实现

TerminalEditor.tsx        ← 现有 UI 壳（从 Editor.tsx 瘦身）
ChatEditor.tsx            ← 新 UI 壳（聊天框风格）
```

### 新增类型

```typescript
// customization.tsx
export type WebShellComposerVariant = 'terminal' | 'chat';

export interface WebShellCustomization {
  // ...existing
  /** Switch the built-in composer layout. Defaults to 'terminal'. */
  composerVariant?: WebShellComposerVariant;
}
```

### App.tsx 切换逻辑

```tsx
const composerVariant = customization.composerVariant ?? 'terminal';

{!shouldHideComposer && (
  <div className={styles.composer}>
    <QueuedPromptDisplay ... />
    {composerVariant === 'chat' ? (
      <ChatEditor ref={setEditorHandle} ... sharedProps />
    ) : (
      <TerminalEditor ref={setEditorHandle} ... sharedProps />
    )}
  </div>
)}
```

### useComposerCore hook

```typescript
// hooks/useComposerCore.ts
interface UseComposerCoreOptions {
  onSubmit: (text: string, images?: PromptImage[]) => boolean | void;
  disabled?: boolean;
  commands: CommandInfo[];
  skills?: SkillInfo[];
  slashCommandCategoryOrder?: CommandDisplayCategoryOrder;
  currentMode?: string;
  sessionName?: string;
  composerInput?: WebShellComposerInput;
  composerInputVersion?: number;
  followupState: UseDaemonFollowupSuggestionReturn;
  onAcceptFollowup: (text: string) => void;
  onDismissFollowup: () => void;
  onCycleMode?: () => void;
  onToggleShortcuts?: () => void;
  placeholderText?: string;
  dialogOpen?: boolean;
  onPopQueuedMessages?: () => string | null;
  onClearQueuedMessages?: () => boolean;
  onImagePaste?: (images: PromptImage[]) => void;
}

interface UseComposerCoreReturn {
  /** Ref to attach to the CodeMirror container div. */
  containerRef: React.RefObject<HTMLDivElement>;
  /** The current EditorView instance. */
  view: EditorView | null;
  /** Submit the current input text. */
  submitText: () => void;
  /** Clear the editor text. */
  clearText: () => void;
  /** Get current text. */
  getText: () => string;
  /** Check if there is non-whitespace input. */
  hasInput: () => boolean;
  /** Imperative handle for composerRef. */
  handle: EditorHandle;
  /** Current images from paste. */
  images: PromptImage[];
  /** Remove an image by index. */
  removeImage: (index: number) => void;
  /** Top-placed tags (rendered outside editor). */
  topTags: WebShellComposerTag[];
  /** Remove a top tag by id. */
  removeTopTag: (id: string) => void;
  /** Current mode string for UI styling. */
  currentMode?: string;
  /** Session display name. */
  sessionName?: string;
  /** Search overlay state and controls. */
  searchState: SearchState;
}
```

### TerminalEditor（现有 Editor 瘦身）

保留现有 UI 不变：

- prefix `›` + mode 颜色（shellMode 黄色、yolo 红色等）
- borderTop / borderBottom 分隔线 + session label
- hints 行（↵ send、⇧↵ newline 等快捷键提示）
- search overlay（Ctrl+R 历史搜索）

仅将 CodeMirror 核心 + 交互逻辑替换为 `useComposerCore()` 调用。

### ChatEditor（新组件）

布局：

```
┌──────────────────────────────────┐
│ [tag1 ×] [tag2 ×]               │  ← top tags（如有）
├──────────────────────────────────┤
│ 输入文字...              [发送] │  ← 圆角输入框 + 发送按钮
│                                  │
├──────────────────────────────────┤
│ [📷 thumb] [📷 thumb]            │  ← 粘贴图片（如有）
└──────────────────────────────────┘
```

与 TerminalEditor 的差异：

| 元素     | TerminalEditor                | ChatEditor                            |
| -------- | ----------------------------- | ------------------------------------- |
| 整体     | 无圆角，紧贴内容区            | 圆角 12px，`var(--bg-secondary)` 背景 |
| prefix   | `›` + mode 颜色               | 无                                    |
| 边框     | borderTop/borderBottom 分隔线 | 1px solid `var(--border-color)` 包裹  |
| 发送方式 | Enter 发送，hints 提示        | Enter 发送 + 右侧圆形发送按钮         |
| 字体     | `var(--font-mono)`            | `var(--font-sans)`                    |
| 字号     | 13px mono                     | 14px sans                             |
| hints    | 显示快捷键行                  | 不显示                                |
| search   | Ctrl+R 历史搜索               | 同样支持（ChatEditor 内部渲染）       |
| 图片     | 编辑器下方 inline             | 输入框底部                            |

### WebShellProps 透传

```typescript
// App.tsx — WebShellProps 新增
export interface WebShellProps {
  // ...existing
  /** Composer layout variant. Defaults to 'terminal'. */
  composerVariant?: 'terminal' | 'chat';
}
```

App 将 `composerVariant` 注入 `WebShellCustomizationProvider`。

## 实现步骤

### Phase 1：抽取 useComposerCore ✅ DONE

1. **新建 `hooks/useComposerCore.ts`** ✅
   - 从 `Editor.tsx` 迁出以下逻辑：
     - `createEditorState` / extensions 组装
     - `slashCompletionSource` / `createAtCompletionSource` 注册
     - `inputHighlight` / `inputHighlightTheme`
     - keymap 绑定
     - `useInputHistory` 集成
     - followup suggestion 处理
     - `WebShellComposerTag` Decoration 逻辑（`TagWidget`、`tagDecorationField`、`tagPlugin`）— 改用内联样式替代 CSS module，确保两个变体共享
     - 图片粘贴处理（`pasteExtension`、`imageState`）
     - `composerInput` / `composerInputVersion` 同步 effect
     - `WebShellComposerApi` / `EditorHandle` 的实现方法
   - 暴露 `UseComposerCoreReturn` 接口
   - 每个 variant 通过 `editorTheme` 选项传入自己的 CodeMirror 主题

2. **改造 `Editor.tsx` → `TerminalEditor.tsx`** ✅
   - 新建 `TerminalEditor.tsx`，调用 `useComposerCore()`
   - 保留纯 UI 渲染：prefix、borders、hints、search overlay、tag/images 展示
   - 旧 `Editor.tsx` 暂时保留（test 文件引用），后续清理
   - `App.tsx` 改为导入 `TerminalEditor`

3. **验证** ✅
   - TypeScript 类型检查通过（非 test 文件无错误）
   - Build 成功

### Phase 2：新增 ChatEditor ✅ DONE

4. **更新导出和类型** ✅
   - `customization.tsx`：新增 `WebShellComposerVariant = 'terminal' | 'chat'`，扩展 `WebShellCustomization`
   - `index.ts`：导出 `WebShellComposerVariant`

5. **新建 `components/ChatEditor.tsx` + `ChatEditor.module.css`** ✅
   - 调用 `useComposerCore()` 获取共享逻辑
   - 布局：大圆角容器 + 输入区域 + 底部工具栏
   - 底部工具栏分左右两组：
     - 左侧：`+` 按钮（触发 shortcuts）+ `默认权限 ∨`（审批模式切换）
     - 右侧：`/` + `@` 快捷入口 + 语音图标（占位）+ 圆形发送按钮
   - CodeMirror 主题使用 `var(--font-sans)` + 14px + 1.6 行高
   - 所有快捷键通过 `useComposerCore` 共享，行为与 TerminalEditor 一致

6. **更新 `App.tsx` 渲染逻辑** ✅
   - `WebShellProps` 新增 `composerVariant`（默认 `'terminal'`）
   - 透传 `composerVariant` 到 `WebShellCustomizationProvider`
   - 渲染区按 `composerVariant` 分支：`'chat'` → `ChatEditor`，`'terminal'` → `TerminalEditor`

7. **验证** ✅
   - TypeScript 类型检查通过
   - Build 成功

## 约束与不变项

- **`EditorHandle` / `WebShellComposerApi` 接口不变** — 两个组件共享同一个接口
- **CodeMirror extensions 不重复** — 全部在 `useComposerCore` 中创建
- **autocomplete tooltip 仍走 `data-web-shell-tooltip-portal`** — 两个变体复用
- **不动 theme 系统的 CSS 变量** — chat 变体通过 CSS Module 自定义样式
- **不动 `Editor.module.css`** — 重命名为 `TerminalEditor.module.css`，内容不变

## Phase 3：默认 chat 模式 + 消息左右布局 ✅ DONE

### 目标

1. **默认 `composerVariant` 改为 `'chat'`** ✅
2. **chat 模式下消息采用左右布局** ✅：
   - 用户消息：右侧对齐，圆角背景（类似聊天气泡）
   - 模型消息：左侧对齐，保持现有样式（无圆角气泡）

### 实现方式

- **直接在消息组件使用 `useWebShellCustomization()`**，无需层层传递 prop
- UserMessage 读取 `composerVariant`，chat 模式下渲染右侧气泡

### 实际改动

1. **修改 `App.tsx` 默认值** ✅
   - `composerVariant = 'terminal'` → `composerVariant = 'chat'`

2. **修改 `UserMessage.tsx`** ✅
   - 导入 `useWebShellCustomization`
   - 根据 `composerVariant === 'chat'` 切换布局：
     - chat 模式：右侧对齐气泡（无 prefix）
     - terminal 模式：原有布局（prefix + body）

3. **新增 `UserMessage.module.css` 样式** ✅
   - `.chatMessageRow`：flex 容器，justify-content: flex-end
   - `.chatBubble`：max-width 70%、圆角 16px、accent-color 背景、sans-serif 字体
   - 浅色主题：`.themeLight .chatBubble` 使用 `var(--bg-tertiary)` 背景

### 文件改动清单（Phase 3）

| 文件                                         | 操作     | 说明                                              |
| -------------------------------------------- | -------- | ------------------------------------------------- |
| `App.tsx`                                    | 修改     | `composerVariant` 默认值改为 `'chat'`             |
| `components/messages/UserMessage.tsx`        | 修改     | 导入 customization context，chat 模式渲染右侧气泡 |
| `components/messages/UserMessage.module.css` | 新增样式 | `.chatMessageRow`、`.chatBubble` 等               |

## Phase 4：chat 模式细节调整 ✅ DONE

### 目标

1. **chat 模式下隐藏底部 footer（StatusBar）**，除非用户显式传入 `renderFooter` ✅
2. **ChatEditor 边距调整**：输入框与上面内容对齐 ✅
3. **用户消息气泡颜色**：改为简单灰色 ✅
4. **collapse 结构调整**：折叠功能移到模型回复消息上面（两种模式统一） ✅

### 设计细节

#### 1. 隐藏 footer

- chat 模式 + 未传入 `renderFooter` → 不渲染 StatusBar
- terminal 模式 → 保持原有 StatusBar

**实现**：`App.tsx` 中 `composerVariant === 'terminal' ? StatusBar : null`

#### 2. ChatEditor 边距

- 调整：与消息区域对齐，margin: 0 24px

#### 3. 气泡颜色

```css
/* 改为灰色背景 */
.chatBubble {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

#### 4. collapse 结构变化（最终方案：两种模式统一）

**决策**：用户要求不论是 chat 还是 terminal，collapse toggle 都放在模型回复上方。

**最终实现**：

- UserMessage：移除 collapse 相关逻辑和 prop
- AssistantMessage：两种模式都在上方渲染 collapse toggle
- MessageList：移除 `collapse` 字段，统一使用 `turnCollapse` 传给 assistant messages
- MessageItem：移除 `collapse` prop，只保留 `turnCollapse`

```
用户消息

┌────────────────────────────────────────────┐
│ ▾ 执行步骤 (N) · 12.4s · ↑3.1k ↓5.1k      │ ← 折叠 toggle（两种模式统一）
└────────────────────────────────────────────┘

模型回复内容...
```

### 实际改动文件

| 文件                          | 操作 | 说明                                                                       |
| ----------------------------- | ---- | -------------------------------------------------------------------------- |
| `App.tsx`                     | 修改 | chat 模式下 footer 条件渲染                                                |
| `ChatEditor.module.css`       | 修改 | 调整 margin 对齐内容区                                                     |
| `UserMessage.module.css`      | 修改 | 气泡颜色改为 var(--bg-tertiary)，移除 collapse 相关样式                    |
| `UserMessage.tsx`             | 修改 | 移除 collapse/onToggleCollapse props，移除 useNowTicker/metricsText 等函数 |
| `AssistantMessage.tsx`        | 修改 | 移除 isChatMode 条件，两种模式都渲染 collapse toggle                       |
| `AssistantMessage.module.css` | 新增 | `.collapseRow`、`.collapseToggle`、`.collapseMeta` 样式                    |
| `MessageItem.tsx`             | 修改 | 移除 `collapse` prop，保留 `turnCollapse`                                  |
| `MessageList.tsx`             | 修改 | DisplayItem 移除 `collapse` 字段，applyTurnCollapse 移除 collapse 赋值     |

## 文件改动清单

| 文件                                      | 操作 | 说明                                                                       |
| ----------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `client/hooks/useComposerCore.ts`         | 新建 | 共享逻辑 hook（从 Editor.tsx 迁出所有 CodeMirror/交互逻辑）                |
| `client/components/TerminalEditor.tsx`    | 新建 | 终端风格 UI 壳，调用 useComposerCore                                       |
| `client/components/ChatEditor.tsx`        | 新建 | 聊天框风格 UI 壳，调用 useComposerCore                                     |
| `client/components/ChatEditor.module.css` | 新建 | 聊天框样式                                                                 |
| `client/components/Editor.tsx`            | 保留 | 旧文件暂保留（test 文件引用），后续可清理                                  |
| `client/components/Editor.module.css`     | 保留 | TerminalEditor 仍在使用                                                    |
| `client/customization.tsx`                | 修改 | 新增 `WebShellComposerVariant`，扩展 `WebShellCustomization`               |
| `client/App.tsx`                          | 修改 | 新增 `composerVariant` prop，按 variant 分支渲染 ChatEditor/TerminalEditor |
| `client/index.ts`                         | 修改 | 导出 `WebShellComposerVariant`                                             |

## 风险与注意事项

1. **Editor.tsx 体量大（2072 行）**：拆 `useComposerCore` 时需仔细识别逻辑边界，避免遗漏状态依赖。建议按功能块逐步迁出，每迁一块跑一次验证。
2. **CodeMirror View 的生命周期**：`useComposerCore` 中 `EditorView` 的创建/销毁需要与 React 生命周期对齐，注意 cleanup 函数。
3. **Tag Decoration 机制**：inline tags 是通过 CodeMirror Decoration 实现的，拆出后两个 Editor 变体都必须正确挂载 tag 相关的 extension。
4. **search overlay 状态**：TerminalEditor 和 ChatEditor 都需要渲染 search overlay，但 UI 布局不同，需要在各自组件中处理。
