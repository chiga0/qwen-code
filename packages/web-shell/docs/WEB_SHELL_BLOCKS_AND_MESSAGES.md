# Web Shell Blocks And Messages

本文档整理 daemon transcript `blocks` 的原始数据结构，以及
web-shell chat 将 `blocks` 转成 UI 消息后的数据结构。

## 数据流

```text
Daemon SSE events
  -> SDK reducer: DaemonTranscriptState.blocks: DaemonTranscriptBlock[]
  -> web-shell adapter: transcriptBlocksToDaemonMessages(blocks): DaemonMessage[]
  -> MessageList display stage: DisplayItem[]
```

相关源码：

- `packages/sdk-typescript/src/daemon/ui/types.ts`
- `packages/sdk-typescript/src/daemon/ui/transcript.ts`
- `packages/web-shell/client/adapters/transcriptToMessages.ts`
- `packages/web-shell/client/adapters/messageTypes.ts`
- `packages/web-shell/client/components/MessageList.tsx`

## 原始 Blocks

### 公共字段

所有 block 都继承 `DaemonTranscriptBlockBase`。

```ts
interface DaemonTranscriptBlockBase {
  id: string;
  kind: DaemonTranscriptBlockKind;
  eventId?: number;
  serverTimestamp?: number;
  clientReceivedAt: number;
  createdAt: number;
  updatedAt: number;
}
```

字段说明：

| 字段               | 含义                                          |
| ------------------ | --------------------------------------------- |
| `id`               | block id，通常也是 UI 消息或工具组的来源 id。 |
| `kind`             | block 类型。                                  |
| `eventId`          | daemon 单调递增 SSE cursor，排序优先使用它。  |
| `serverTimestamp`  | daemon 侧事件时间，刷新/重连后更稳定。        |
| `clientReceivedAt` | 当前客户端收到事件的本地时间。                |
| `createdAt`        | 兼容字段，等于 `clientReceivedAt`。           |
| `updatedAt`        | block 最近一次被 reducer 更新的本地时间。     |

`kind` 当前包括：

```ts
type DaemonTranscriptBlockKind =
  | 'user'
  | 'assistant'
  | 'thought'
  | 'tool'
  | 'shell'
  | 'user_shell'
  | 'permission'
  | 'status'
  | 'error'
  | 'debug'
  | 'prompt_cancelled';
```

### user / assistant / thought

```ts
interface DaemonTextTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'user' | 'assistant' | 'thought';
  text: string;
  images?: Array<{ data: string; mimeType: string }>;
  streaming?: boolean;
  collapsed?: boolean;
  parentToolCallId?: string;
  usage?: DaemonTurnUsage;
}
```

说明：

| 字段               | 含义                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `text`             | 文本内容。                                                        |
| `images`           | 用户消息携带的图片。                                              |
| `streaming`        | 当前文本 block 是否还在流式输出。                                 |
| `collapsed`        | reducer 保留字段，当前 chat 主要使用 MessageList 自己的折叠状态。 |
| `parentToolCallId` | 子智能体内的 assistant/thought 输出会挂到父 agent tool 下。       |
| `usage`            | assistant block 上的 token 用量。                                 |

`usage` 结构：

```ts
interface DaemonTurnUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}
```

### tool

```ts
interface DaemonToolTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'tool';
  toolCallId: string;
  title: string;
  status: string;
  toolName?: string;
  toolKind?: string;
  preview: DaemonToolPreview;
  content?: unknown;
  locations?: unknown;
  details?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
  parentToolCallId?: string;
  subagentType?: string;
  parentBlockId?: string;
}
```

说明：

| 字段               | 含义                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `toolCallId`       | 工具调用 id，用于多次更新合并。                                           |
| `title`            | daemon 给 UI 的展示标题。                                                 |
| `status`           | 原始状态，例如 `running`、`pending`、`completed`、`failed`、`cancelled`。 |
| `toolName`         | 工具名，例如 `Bash`、`ReadFile`、`Grep`、`web_fetch`、`Agent`。           |
| `toolKind`         | 工具类型提示，用于图标/分类。                                             |
| `preview`          | 工具预览数据。                                                            |
| `content`          | 工具结构化内容，adapter 会尝试转成 `content` / `diff` / `terminal`。      |
| `locations`        | 位置数据，目前 web-shell 转换只保留规范后的 `{ file, line? }`。           |
| `details`          | 补充详情，取消/失败时可能作为输出。                                       |
| `rawInput`         | 原始入参。                                                                |
| `rawOutput`        | 原始输出。                                                                |
| `parentToolCallId` | 子工具挂到父 agent tool 下。                                              |
| `subagentType`     | 子智能体类型。                                                            |
| `parentBlockId`    | reducer 解析出的父 block id。                                             |

`preview` 类型：

```ts
type DaemonToolPreview =
  | { kind: 'ask_user_question'; questions: DaemonTranscriptQuestion[] }
  | { kind: 'command'; command: string; cwd?: string }
  | {
      kind: 'file_diff';
      path: string;
      oldText?: string;
      newText?: string;
      patch?: string;
    }
  | { kind: 'file_read'; path: string; range?: readonly [number, number] }
  | { kind: 'web_fetch'; url: string; method?: string }
  | {
      kind: 'mcp_invocation';
      serverId: string;
      toolName: string;
      argsSummary?: string;
    }
  | { kind: 'code_block'; language?: string; code: string; origin?: string }
  | {
      kind: 'search';
      query: string;
      resultCount?: number;
      top?: readonly string[];
    }
  | {
      kind: 'tabular';
      columns: readonly string[];
      rows: ReadonlyArray<readonly string[]>;
      totalRows?: number;
    }
  | {
      kind: 'image_generation';
      prompt: string;
      thumbnailUrl?: string;
      model?: string;
    }
  | {
      kind: 'subagent_delegation';
      agentName: string;
      task: string;
      parentDelegationId?: string;
    }
  | { kind: 'key_value'; rows: Array<{ label: string; value: string }> }
  | { kind: 'generic'; summary?: string };
```

### shell

```ts
interface DaemonShellTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'shell';
  text: string;
  stream?: 'stdout' | 'stderr';
}
```

说明：

- 这是工具产生的 shell 输出流。
- block 自己没有 `toolCallId`，web-shell 会用启发式把它追加到最近的
  execute 工具 `rawOutput` 上。
- 如果找不到工具组，会生成一个 synthetic `tool_group`。

### user_shell

```ts
interface DaemonUserShellTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'user_shell';
  text: string;
  command: string;
  cwd?: string;
  stream?: 'stdout' | 'stderr';
}
```

说明：

- 表示用户手动执行 shell 命令及输出。
- 转换后是独立的 `user_shell` 消息。

### permission

```ts
interface DaemonPermissionTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'permission';
  requestId: string;
  sessionId?: string;
  title: string;
  options: DaemonUiPermissionOption[];
  toolCall?: unknown;
  preview: DaemonToolPreview;
  resolved?: string;
}
```

`options`：

```ts
interface DaemonUiPermissionOption {
  optionId: string;
  label: string;
  description?: string;
  raw: unknown;
}
```

说明：

- 未 resolved 的 permission 不进入普通 message 列表，而是由 pending
  permission UI 单独展示。
- resolved 后，如果能还原出工具调用，会生成或合并一个工具卡片。
- `ask_user_question` 这类权限不会生成 synthetic tool，避免和问答表单重复。

### status / error / debug

```ts
interface DaemonStatusTranscriptBlock extends DaemonTranscriptBlockBase {
  kind: 'status' | 'error' | 'debug';
  text: string;
  code?: string;
  promptId?: string;
  source?: string;
  data?: unknown;
}
```

说明：

- `status` / `debug` 默认转成 `system` info。
- `error` 转成 `system` error。
- `source === 'turn_error'` 的 error 会被标记为 `retryable: true`。
- `status.text` 如果是 `plan: {...}` 格式，会转成 `plan` 消息。
- assistant 文本中如果混入 insight JSON，会转成 insight 消息；status 本身不走 insight 拆分逻辑。

### prompt_cancelled

```ts
interface DaemonPromptCancelledTranscriptBlock
  extends DaemonTranscriptBlockBase {
  kind: 'prompt_cancelled';
  reason?: string;
}
```

说明：

- 转换成 `system` info。
- 文案来自 `transcriptBlocksToDaemonMessages` 的 `labels.promptCancelled`，
  默认是 `Request cancelled.`。

## 转换后的 DaemonMessage

### 公共字段

所有 message 都带可选 `timestamp`：

```ts
interface DaemonMessageMeta {
  timestamp?: number;
}
```

来源：

```ts
const blockTime = block.serverTimestamp ?? block.clientReceivedAt;
```

### user

```ts
interface DaemonUserMessage extends DaemonMessageMeta {
  id: string;
  role: 'user';
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
}
```

来源：

- `user` block 直接转换。
- `images` 从 user block 透传。

### assistant

```ts
interface DaemonAssistantMessage extends DaemonMessageMeta {
  id: string;
  role: 'assistant';
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
}
```

来源：

- `assistant` block 转成 `content`。
- 相邻 assistant block 会合并。
- `thought` block 转成同一个 assistant message 的 `thinking`。
- thought-only 场景会生成 `content: ''` 的 assistant message。
- `usage` 会在合并 assistant block 时求和。
- 带 `parentToolCallId` 的 assistant/thought 不进入主消息列表，而是拼到父 tool 的 `subContent`。

### tool_group

```ts
interface DaemonToolGroupMessage extends DaemonMessageMeta {
  id: string;
  role: 'tool_group';
  tools: DaemonMessageToolCall[];
}
```

来源：

- `tool` block 转成 tool call 后放入 `tool_group`。
- 相邻的普通工具会合并到同一个 `tool_group`。
- sub-agent tool 和 todo write tool 保持独立 tool group。
- 同一个 `toolCallId` 的后续 tool block 会合并到已有 tool call。
- 带 `parentToolCallId` 的 tool 会作为父 tool 的 `subTools`。

工具调用结构：

```ts
type DaemonMessageToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

type DaemonMessageToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';

interface DaemonMessageToolCall {
  callId: string;
  toolName: string;
  args?: Record<string, unknown>;
  status: DaemonMessageToolCallStatus;
  parentToolCallId?: string;
  title?: string;
  content?: DaemonMessageToolCallContent[];
  rawOutput?: unknown;
  locations?: DaemonMessageToolCallLocation[];
  kind?: DaemonMessageToolKind;
  startTime?: number;
  endTime?: number;
  subContent?: string;
  subTools?: DaemonMessageToolCall[];
}
```

工具内容结构：

```ts
interface DaemonMessageToolCallContent {
  type: 'content' | 'diff' | 'terminal';
  content?: { type: string; text?: string; [key: string]: unknown };
  path?: string;
  oldText?: string;
  newText?: string;
  terminalId?: string;
}

interface DaemonMessageToolCallLocation {
  file: string;
  line?: number;
}
```

状态映射：

| 原始 `tool.status`       | 转换后        |
| ------------------------ | ------------- |
| `running`                | `in_progress` |
| `in_progress`            | `in_progress` |
| `pending`                | `pending`     |
| `confirming`             | `pending`     |
| `background`             | `pending`     |
| `completed`              | `completed`   |
| `failed`                 | `failed`      |
| `cancelled` / `canceled` | `completed`   |

工具类型推断：

| 来源                                  | 转换后 `kind`       |
| ------------------------------------- | ------------------- |
| `toolKind` 存在                       | 直接使用 `toolKind` |
| `Bash` / `execute`                    | `execute`           |
| `Read`                                | `read`              |
| `Edit` / `Write`                      | `edit`              |
| 名称包含 `search`，或 `Grep` / `Glob` | `search`            |
| `Agent` / `Task`                      | `other`             |
| 其他                                  | `undefined`         |

### plan

```ts
interface DaemonPlanMessage extends DaemonMessageMeta {
  id: string;
  role: 'plan';
  todos: DaemonMessageTodoItem[];
}

interface DaemonMessageTodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'high' | 'medium' | 'low';
}
```

来源：

- `status.text` 以 `plan: ` 开头。
- JSON 满足 `{ sessionUpdate: 'plan', entries: [...] }`。

### system

```ts
interface DaemonSystemMessage extends DaemonMessageMeta {
  id: string;
  role: 'system';
  content: string;
  variant: 'info' | 'error' | 'warning';
  retryable?: boolean;
  source?: string;
  data?: unknown;
}
```

来源：

- `status` / `debug` -> `variant: 'info'`。
- `error` -> `variant: 'error'`。
- `prompt_cancelled` -> `variant: 'info'`。

### user_shell

```ts
interface DaemonUserShellMessage extends DaemonMessageMeta {
  id: string;
  role: 'user_shell';
  command: string;
  output: string;
  cwd?: string;
}
```

来源：

- `user_shell` block 直接转换。

### btw

```ts
interface DaemonBtwMessage extends DaemonMessageMeta {
  id: string;
  role: 'btw';
  question: string;
  answer: string;
  isPending: boolean;
}
```

说明：

- 这是 web-shell 消息模型支持的 UI 消息类型。
- 当前不由 `transcriptBlocksToDaemonMessages` 的普通 block switch 直接生成。

### insight_progress / insight_ready / insight_error

```ts
interface DaemonInsightProgressMessage extends DaemonMessageMeta {
  id: string;
  role: 'insight_progress';
  stage: string;
  progress: number;
  detail?: string;
}

interface DaemonInsightReadyMessage extends DaemonMessageMeta {
  id: string;
  role: 'insight_ready';
  path: string;
}

interface DaemonInsightErrorMessage extends DaemonMessageMeta {
  id: string;
  role: 'insight_error';
  error: string;
}
```

来源：

- assistant 文本里包含以下 JSON 片段时会被拆出来：
  - `{ "insight_progress": { "stage": string, "progress": number, "detail"?: string } }`
  - `{ "insight_ready": { "path": string } }`
  - `{ "insight_error": { "error": string } }`
- 同一个 assistant block 可被拆成普通 assistant 文本和 insight 消息。

## MessageList 展示层结构

`DaemonMessage[]` 进入 MessageList 后，还会派生成 `DisplayItem[]`。

```ts
type DisplayItem =
  | {
      type: 'message';
      key: string;
      message: Message;
      turnCollapse?: TurnCollapseHead;
    }
  | {
      type: 'turn_collapse';
      key: string;
      turnCollapse: TurnCollapseHead;
    }
  | {
      type: 'parallel_agents';
      key: string;
      agents: ACPToolCall[];
      timestamp?: number;
    };
```

### turn_collapse

```ts
interface TurnCollapseHead {
  turnId: string;
  collapsed: boolean;
  hiddenCount: number;
  elapsedMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  toolCallCount?: number;
  thinkingCount?: number;
  liveStartedAt?: number;
}
```

说明：

- 一个 turn 从 user message 开始，到下一个 user message 之前结束。
- 完成后的 turn 默认折叠；正在响应的最后一个 turn 默认展开。
- 折叠时隐藏中间步骤，保留用户问题、最终回答，以及 system/shell/insight 等非步骤消息。
- `elapsedMs` 优先用 block timestamp 推导。
- 正在运行时用 `liveStartedAt` 在前端计时。
- `toolCallCount` 统计 tool calls。
- `thinkingCount` 统计带 `thinking` 的 assistant messages。

### parallel_agents

说明：

- 连续多个 agent-only `tool_group` 会合并为一个 `parallel_agents` 展示项。
- background agent-only group 也会合并。
- 中间只有 thought-only 的启动叙述时，会被视为并行 agent 的内部叙述，不打断合并。

## 转换规则总表

| 原始 block kind    | 转换后结构                                   | 备注                                                                               |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `user`             | `DaemonUserMessage`                          | 图片会透传。                                                                       |
| `assistant`        | `DaemonAssistantMessage`                     | 相邻 assistant 合并；insight JSON 会拆成 insight 消息。                            |
| `thought`          | `DaemonAssistantMessage.thinking`            | thought-only 会产生空 content assistant；子智能体 thought 进父 tool `subContent`。 |
| `tool`             | `DaemonToolGroupMessage.tools[]`             | 相邻普通工具合并；同 callId 更新合并；子工具进入父 tool `subTools`。               |
| `shell`            | 追加到 execute tool `rawOutput`              | 找不到目标时生成 synthetic shell tool group。                                      |
| `user_shell`       | `DaemonUserShellMessage`                     | 用户手动 shell 输出。                                                              |
| `permission`       | pending UI 或 synthetic tool                 | 未 resolved 不进普通消息；resolved 后可能合并/生成工具。                           |
| `status`           | `DaemonPlanMessage` 或 `DaemonSystemMessage` | `plan: {...}` 转 plan，否则 info system。                                          |
| `debug`            | `DaemonSystemMessage`                        | info system。                                                                      |
| `error`            | `DaemonSystemMessage`                        | error system；`source: turn_error` 可重试。                                        |
| `prompt_cancelled` | `DaemonSystemMessage`                        | info system。                                                                      |

## 需要注意的点

- UI 展示的工具折叠、思考折叠、turn metrics、并行智能体，并不是原始
  block 字段，而是 MessageList 阶段基于 `DaemonMessage[]` 派生出来的。
- `permission` 有两条展示链路：pending 状态走独立权限 UI，resolved 状态才可能进入工具消息。
- `shell` block 没有 `toolCallId`，所以只能用最近 execute 工具进行启发式归属。
- `serverTimestamp` 更适合跨刷新/跨客户端展示时间；本地实时计时可以使用
  `clientReceivedAt` 或 MessageList 里的 `liveStartedAt`。
- 子智能体相关内容主要靠 `parentToolCallId` 归到父 tool，转换后体现在
  `subContent` 和 `subTools`。
