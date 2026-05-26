/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

// ── Session axis (per-conversation) ────────────────────────────────
export {
  DaemonSessionProvider,
  useDaemonActions,
  useDaemonActiveTodoList,
  useDaemonConnection,
  useDaemonLatestTodoList,
  useDaemonPendingPermissionRequest,
  useDaemonPendingPermissions,
  useDaemonPromptStatus,
  useDaemonStreamingState,
  useDaemonSession,
  useDaemonTodoLists,
  useDaemonTranscriptBlocks,
  useDaemonTranscriptState,
  useDaemonTranscriptStore,
  extractDaemonTodosFromToolBlock,
  hasDaemonActiveTodos,
  isDaemonSubAgentToolBlock,
  parseDaemonTodoItemsFromEntries,
  selectDaemonActiveTodoList,
  selectDaemonLatestTodoList,
  selectDaemonPendingPermissions,
  selectDaemonPendingPermissionRequest,
  selectDaemonSubAgentToolBlocks,
  selectDaemonStreamingState,
  selectDaemonTodoLists,
  selectDaemonTranscriptStreamingState,
  toDaemonPromptContent,
} from './session/index.js';
export type {
  DaemonCommandInfo,
  DaemonConnectionState,
  DaemonConnectionStatus,
  DaemonModelInfo,
  DaemonPendingPermissionRequest,
  DaemonPermissionOptionKind,
  DaemonPermissionRequestOption,
  DaemonPromptImage,
  DaemonPromptStatus,
  DaemonSessionActions,
  DaemonSessionContextValue,
  DaemonSessionProviderProps,
  DaemonTodoItem,
  DaemonTodoList,
  DaemonTodoPriority,
  DaemonTodoStatus,
  DaemonStreamingState,
  SendPromptOptions,
} from './session/index.js';

// ── Workspace axis (per-workspace, outlives sessions) ──────────────
export {
  DaemonWorkspaceProvider,
  useDaemonWorkspace,
  useDaemonWorkspaceActions,
  useOptionalDaemonWorkspace,
  useDaemonAgents,
  useDaemonGlob,
  useDaemonMcp,
  useDaemonMemory,
  useDaemonResource,
  useDaemonSessions,
  useDaemonSkills,
  useDaemonTools,
} from './workspace/index.js';
export type {
  DaemonGlobOptions,
  DaemonGlobResult,
  DaemonResourceOptions,
  DaemonWorkspaceActions,
  DaemonWorkspaceContextValue,
  DaemonWorkspaceProviderProps,
  ResourceResult,
  ResourceState,
} from './workspace/index.js';

// ── Shared (daemon → webui bridge) ─────────────────────────────────
export { daemonTranscriptToUnifiedMessages } from './transcriptAdapter.js';
