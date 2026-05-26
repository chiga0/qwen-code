/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import type {
  DaemonAgentMutationResult,
  DaemonCapabilities,
  DaemonClient,
  DaemonCreateAgentRequest,
  DaemonMcpRestartResult,
  DaemonWorkspaceAgentDetail,
  DaemonWorkspaceAgentsStatus,
  DaemonWorkspaceFile,
  DaemonWorkspaceMcpStatus,
  DaemonWorkspaceMcpToolsStatus,
  DaemonWorkspaceMemoryStatus,
  DaemonWorkspaceProvidersStatus,
  DaemonWorkspaceSkillsStatus,
  DaemonWorkspaceToolsStatus,
  DaemonWriteMemoryRequest,
  DaemonWriteMemoryResult,
} from '@qwen-code/sdk/daemon';

// ── Resource Hook Types (shared by workspace hooks) ────────────────

export interface DaemonResourceOptions {
  autoLoad?: boolean;
  enabled?: boolean;
}

export interface ResourceState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

export interface ResourceResult<T> extends ResourceState<T> {
  reload: () => Promise<T | undefined>;
}

// ── Workspace Provider ──────────────────────────────────────────────

export interface DaemonWorkspaceProviderProps {
  baseUrl: string;
  token?: string;
  workspaceCwd?: string;
  autoConnect?: boolean;
  children: ReactNode;
}

export interface DaemonWorkspaceContextValue {
  client: DaemonClient;
  token?: string;
  baseUrl: string;
  workspaceCwd?: string;
  capabilities?: DaemonCapabilities;
  actions: DaemonWorkspaceActions;
}

// ── Workspace Actions ───────────────────────────────────────────────

export interface DaemonGlobOptions {
  maxResults?: number;
  includeIgnored?: boolean;
  cwd?: string;
}

export interface DaemonGlobResult {
  matches: string[];
}

export interface DaemonWorkspaceActions {
  // MCP
  loadMcpStatus(): Promise<DaemonWorkspaceMcpStatus>;
  loadMcpTools(serverName: string): Promise<DaemonWorkspaceMcpToolsStatus>;
  restartMcpServer(serverName: string): Promise<DaemonMcpRestartResult>;

  // Skills (read-only)
  loadSkillsStatus(): Promise<DaemonWorkspaceSkillsStatus>;

  // Tools
  loadToolsStatus(): Promise<DaemonWorkspaceToolsStatus>;
  setWorkspaceToolEnabled(toolName: string, enabled: boolean): Promise<unknown>;

  // Memory
  loadMemoryStatus(): Promise<DaemonWorkspaceMemoryStatus>;
  readWorkspaceFile(filePath: string): Promise<DaemonWorkspaceFile>;
  writeMemory(req: DaemonWriteMemoryRequest): Promise<DaemonWriteMemoryResult>;

  // Agents (CRUD)
  listAgents(): Promise<DaemonWorkspaceAgentsStatus>;
  getAgent(agentType: string): Promise<DaemonWorkspaceAgentDetail>;
  createAgent(
    req: DaemonCreateAgentRequest,
  ): Promise<DaemonAgentMutationResult>;
  deleteAgent(agentType: string, scope?: 'workspace' | 'global'): Promise<void>;

  // Files
  globWorkspace(
    pattern: string,
    opts?: DaemonGlobOptions,
  ): Promise<DaemonGlobResult>;

  // Providers / env (read-only diagnostics)
  loadProviders(): Promise<DaemonWorkspaceProvidersStatus>;
}
