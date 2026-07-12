import type {
  DaemonWorkspaceAgentSummary,
  DaemonWorkspaceToolStatus,
} from '@qwen-code/webui/daemon-react-sdk';

export type AgentLevelFilter =
  | 'all'
  | 'project'
  | 'user'
  | 'extension'
  | 'builtin';

export type AgentToolPreset = 'all' | 'read' | 'edit' | 'execute';

export function filterAgents(
  agents: readonly DaemonWorkspaceAgentSummary[],
  query: string,
  level: AgentLevelFilter,
): DaemonWorkspaceAgentSummary[] {
  const normalized = query.trim().toLowerCase();
  return agents.filter((agent) => {
    if (level !== 'all' && agent.level !== level) return false;
    if (!normalized) return true;
    return [agent.name, agent.description, agent.extensionName]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
  });
}

export function canModifyAgent(agent: DaemonWorkspaceAgentSummary): boolean {
  return (
    (agent.level === 'project' || agent.level === 'user') && !agent.isBuiltin
  );
}

export function agentScope(
  agent: DaemonWorkspaceAgentSummary,
): 'workspace' | 'global' | undefined {
  if (agent.level === 'project') return 'workspace';
  if (agent.level === 'user') return 'global';
  return undefined;
}

function matches(name: string, tokens: readonly string[]): boolean {
  const words = new Set(
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  return tokens.some((token) => words.has(token));
}

export function toolsForPreset(
  tools: readonly DaemonWorkspaceToolStatus[],
  preset: AgentToolPreset,
): string[] {
  if (preset === 'all') return [];
  const enabled = tools
    .filter((tool) => tool.enabled)
    .map((tool) => tool.displayName || tool.name)
    .sort((a, b) => a.localeCompare(b));
  const read = enabled.filter((name) =>
    matches(name, [
      'read',
      'grep',
      'glob',
      'list',
      'search',
      'fetch',
      'think',
      'todo',
      'context',
    ]),
  );
  if (preset === 'read') return read;
  const edit = enabled.filter((name) =>
    matches(name, [
      'edit',
      'editor',
      'write',
      'delete',
      'move',
      'patch',
      'replace',
    ]),
  );
  if (preset === 'edit') return [...new Set([...read, ...edit])];
  const execute = enabled.filter((name) =>
    matches(name, ['shell', 'exec', 'run', 'command', 'terminal', 'bash']),
  );
  return [...new Set([...read, ...edit, ...execute])];
}
