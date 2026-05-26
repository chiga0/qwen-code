/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DaemonClient } from '@qwen-code/sdk/daemon';
import { withActionTimeout } from '../timing.js';
import type { DaemonWorkspaceActions } from './types.js';

export interface CreateDaemonWorkspaceActionsArgs {
  getClient: () => DaemonClient | undefined;
  baseUrl: string;
  token?: string;
}

export function createDaemonWorkspaceActions({
  getClient,
  baseUrl,
  token,
}: CreateDaemonWorkspaceActionsArgs): DaemonWorkspaceActions {
  return {
    async loadMcpStatus() {
      const client = requireClient(getClient, 'Load MCP status failed');
      return withActionTimeout(
        client.workspaceMcp(),
        'Load MCP status timed out',
      );
    },

    async loadMcpTools(serverName) {
      const client = requireClient(getClient, 'Load MCP tools failed');
      try {
        return await withActionTimeout(
          client.workspaceMcpTools(serverName),
          'Load MCP tools timed out',
        );
      } catch {
        return {
          v: 1 as const,
          workspaceCwd: '',
          serverName,
          initialized: false,
          acpChannelLive: false,
          tools: [],
          errors: [
            {
              kind: 'mcp_tools' as const,
              status: 'error' as const,
              error: 'The connected daemon does not expose MCP tool details.',
            },
          ],
        };
      }
    },

    async restartMcpServer(serverName) {
      const client = requireClient(getClient, 'Restart MCP server failed');
      return withActionTimeout(
        client.restartMcpServer(serverName),
        'Restart MCP server timed out',
      );
    },

    async loadSkillsStatus() {
      const client = requireClient(getClient, 'Load skills failed');
      return withActionTimeout(
        client.workspaceSkills(),
        'Load skills timed out',
      );
    },

    async loadToolsStatus() {
      const client = requireClient(getClient, 'Load tools failed');
      return withActionTimeout(client.workspaceTools(), 'Load tools timed out');
    },

    async setWorkspaceToolEnabled(toolName, enabled) {
      const client = requireClient(getClient, 'Set tool enabled failed');
      return withActionTimeout(
        client.setWorkspaceToolEnabled(toolName, enabled),
        'Set tool enabled timed out',
      );
    },

    async loadMemoryStatus() {
      const client = requireClient(getClient, 'Load memory failed');
      return withActionTimeout(
        client.workspaceMemory(),
        'Load memory timed out',
      );
    },

    async readWorkspaceFile(filePath) {
      const client = requireClient(getClient, 'Read workspace file failed');
      return withActionTimeout(
        client.readWorkspaceFile(filePath),
        'Read workspace file timed out',
      );
    },

    async writeMemory(req) {
      const client = requireClient(getClient, 'Write memory failed');
      return withActionTimeout(
        client.writeWorkspaceMemory(req),
        'Write memory timed out',
      );
    },

    async listAgents() {
      const client = requireClient(getClient, 'List agents failed');
      return withActionTimeout(
        client.listWorkspaceAgents(),
        'List agents timed out',
      );
    },

    async getAgent(agentType) {
      const client = requireClient(getClient, 'Get agent failed');
      return withActionTimeout(
        client.getWorkspaceAgent(agentType),
        'Get agent timed out',
      );
    },

    async createAgent(req) {
      const client = requireClient(getClient, 'Create agent failed');
      return withActionTimeout(
        client.createWorkspaceAgent(req),
        'Create agent timed out',
      );
    },

    async deleteAgent(agentType, scope) {
      const client = requireClient(getClient, 'Delete agent failed');
      return withActionTimeout(
        client.deleteWorkspaceAgent(agentType, scope ? { scope } : {}),
        'Delete agent timed out',
      );
    },

    async globWorkspace(pattern, opts) {
      requireClient(getClient, 'Glob workspace failed');
      const url = createDaemonRequestUrl(baseUrl, '/glob');
      url.searchParams.set('pattern', pattern);
      if (opts?.maxResults !== undefined) {
        url.searchParams.set('maxResults', String(opts.maxResults));
      }
      if (opts?.includeIgnored !== undefined) {
        url.searchParams.set('includeIgnored', opts.includeIgnored ? '1' : '0');
      }
      if (opts?.cwd !== undefined) {
        url.searchParams.set('cwd', opts.cwd);
      }
      const res = await withActionTimeout(
        fetch(serializeDaemonRequestUrl(url, baseUrl), {
          headers: createDaemonHeaders(token),
        }),
        'Glob workspace timed out',
      );
      if (!res.ok) {
        throw new Error(await readDaemonError(res, 'GET /glob'));
      }
      const data = (await res.json()) as { matches?: unknown[] };
      return {
        matches: Array.isArray(data.matches)
          ? data.matches.filter(
              (match): match is string => typeof match === 'string',
            )
          : [],
      };
    },

    async loadProviders() {
      const client = requireClient(getClient, 'Load providers failed');
      return withActionTimeout(
        client.workspaceProviders(),
        'Load providers timed out',
      );
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function requireClient(
  getClient: () => DaemonClient | undefined,
  action: string,
): DaemonClient {
  const client = getClient();
  if (!client) {
    throw new Error(`${action}: DaemonClient is not connected`);
  }
  return client;
}

function createDaemonHeaders(token: string | undefined): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function createDaemonRequestUrl(baseUrl: string, path: string): URL {
  const normalizedBaseUrl = stripTrailingSlashes(baseUrl);
  const fallbackBase =
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  return new URL(`${normalizedBaseUrl}${path}`, fallbackBase);
}

function serializeDaemonRequestUrl(url: URL, baseUrl: string): string {
  return stripTrailingSlashes(baseUrl)
    ? url.toString()
    : `${url.pathname}${url.search}`;
}

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) end--;
  return end === value.length ? value : value.slice(0, end);
}

async function readDaemonError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown; message?: unknown };
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : undefined;
    return message
      ? `${fallback}: ${message}`
      : `${fallback}: HTTP ${res.status}`;
  } catch {
    return `${fallback}: HTTP ${res.status}`;
  }
}
