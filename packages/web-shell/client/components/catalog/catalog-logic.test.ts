import { describe, expect, it } from 'vitest';
import type {
  DaemonWorkspaceSkillStatus,
  DaemonWorkspaceToolStatus,
} from '@qwen-code/webui/daemon-react-sdk';
import {
  filterSkills,
  filterTools,
  preserveCatalogSelection,
} from './catalog-logic';

describe('catalog logic', () => {
  const tools: DaemonWorkspaceToolStatus[] = [
    {
      name: 'read_file',
      displayName: 'Read File',
      description: 'Reads workspace files',
      enabled: true,
    },
    {
      name: 'shell',
      description: 'Runs a command',
      enabled: false,
    },
  ];
  const skills: DaemonWorkspaceSkillStatus[] = [
    {
      kind: 'skill',
      status: 'ok',
      name: 'frontend-design',
      description: 'Design interfaces',
      level: 'extension',
      modelInvocable: true,
      extensionName: 'design-pack',
    },
    {
      kind: 'skill',
      status: 'ok',
      name: 'review',
      description: 'Review code',
      level: 'user',
      modelInvocable: false,
      argumentHint: '<path>',
    },
  ];

  it('filters tools by name, display name, and description', () => {
    expect(filterTools(tools, 'Read File')).toEqual([tools[0]]);
    expect(filterTools(tools, 'command')).toEqual([tools[1]]);
  });

  it('filters skills by metadata and preserves valid selection', () => {
    expect(filterSkills(skills, 'design-pack')).toEqual([skills[0]]);
    expect(filterSkills(skills, '<path>')).toEqual([skills[1]]);
    expect(filterSkills(skills, '', 'extension')).toEqual([skills[0]]);
    expect(filterSkills(skills, 'code', 'user')).toEqual([skills[1]]);
    expect(filterSkills(skills, 'design', 'user')).toEqual([]);
    expect(preserveCatalogSelection('review', skills)).toBe('review');
    expect(preserveCatalogSelection('removed', skills)).toBeNull();
  });
});
