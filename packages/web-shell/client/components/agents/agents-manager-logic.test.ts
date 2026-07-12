import { describe, expect, it } from 'vitest';
import type {
  DaemonWorkspaceAgentSummary,
  DaemonWorkspaceToolStatus,
} from '@qwen-code/webui/daemon-react-sdk';
import {
  canModifyAgent,
  filterAgents,
  toolsForPreset,
} from './agents-manager-logic';

describe('agents manager logic', () => {
  const agents: DaemonWorkspaceAgentSummary[] = [
    {
      kind: 'agent',
      name: 'reviewer',
      description: 'Reviews code',
      level: 'project',
      isBuiltin: false,
      hasTools: true,
    },
    {
      kind: 'agent',
      name: 'helper',
      description: 'Built-in helper',
      level: 'builtin',
      isBuiltin: true,
      hasTools: false,
    },
  ];

  it('combines search and level filters', () => {
    expect(filterAgents(agents, 'review', 'project')).toEqual([agents[0]]);
    expect(filterAgents(agents, 'helper', 'project')).toEqual([]);
    expect(filterAgents(agents, '', 'builtin')).toEqual([agents[1]]);
  });

  it('only allows user and project agents to be modified', () => {
    expect(canModifyAgent(agents[0])).toBe(true);
    expect(canModifyAgent(agents[1])).toBe(false);
  });

  it('builds tool presets from enabled tools', () => {
    const tools: DaemonWorkspaceToolStatus[] = [
      { name: 'read_file', enabled: true },
      { name: 'write_file', enabled: true },
      { name: 'shell', enabled: true },
      { name: 'disabled_read', enabled: false },
    ];
    expect(toolsForPreset(tools, 'all')).toEqual([]);
    expect(toolsForPreset(tools, 'read')).toEqual(['read_file']);
    expect(toolsForPreset(tools, 'edit')).toEqual(['read_file', 'write_file']);
    expect(toolsForPreset(tools, 'execute')).toEqual([
      'read_file',
      'write_file',
      'shell',
    ]);
  });

  it('matches tool categories by words instead of arbitrary substrings', () => {
    const tools: DaemonWorkspaceToolStatus[] = [
      { name: 'thread_context', enabled: true },
      { name: 'spreadsheet_editor', enabled: true },
      { name: 'executeShellCommand', enabled: true },
    ];
    expect(toolsForPreset(tools, 'read')).toEqual(['thread_context']);
    expect(toolsForPreset(tools, 'edit')).toEqual([
      'thread_context',
      'spreadsheet_editor',
    ]);
    expect(toolsForPreset(tools, 'execute')).toEqual([
      'thread_context',
      'spreadsheet_editor',
      'executeShellCommand',
    ]);
  });
});
