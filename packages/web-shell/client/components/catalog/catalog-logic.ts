import type {
  DaemonWorkspaceSkillStatus,
  DaemonWorkspaceToolStatus,
} from '@qwen-code/webui/daemon-react-sdk';

export type SkillLevelFilter = 'all' | DaemonWorkspaceSkillStatus['level'];

export function filterTools(
  tools: readonly DaemonWorkspaceToolStatus[],
  query: string,
): DaemonWorkspaceToolStatus[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...tools];
  return tools.filter((tool) =>
    [tool.name, tool.displayName, tool.description]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized)),
  );
}

export function filterSkills(
  skills: readonly DaemonWorkspaceSkillStatus[],
  query: string,
  level: SkillLevelFilter = 'all',
): DaemonWorkspaceSkillStatus[] {
  const normalized = query.trim().toLowerCase();
  return skills.filter((skill) => {
    if (level !== 'all' && skill.level !== level) return false;
    if (!normalized) return true;
    return [
      skill.name,
      skill.description,
      skill.extensionName,
      skill.argumentHint,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
  });
}

export function preserveCatalogSelection<T extends { name: string }>(
  name: string | null,
  entries: readonly T[],
): string | null {
  return name && entries.some((entry) => entry.name === name) ? name : null;
}
