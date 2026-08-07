/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { SettingScope } from '../../config/settings.js';
import { TextInput } from './shared/TextInput.js';
import { Colors } from '../colors.js';
import { t } from '../../i18n/index.js';
import type {
  PermissionManager,
  RuleWithSource,
  RuleType,
} from '@qwen-code/qwen-code-core';
import { isPathWithinRoot, parseRule } from '@qwen-code/qwen-code-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'allow' | 'ask' | 'deny' | 'workspace';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

/** Internal views for the dialog state machine. */
type DialogView =
  | 'rule-list' // main rule list view
  | 'add-rule-input' // text input for new rule
  | 'add-rule-scope' // scope selector after entering a rule
  | 'delete-confirm' // confirm rule deletion
  | 'ws-dir-list' // workspace directory list
  | 'ws-add-dir-input' // text input for adding a directory
  | 'ws-remove-confirm'; // confirm directory removal

// ---------------------------------------------------------------------------
// Scope items (matches Claude Code screenshot layout)
// ---------------------------------------------------------------------------

interface PermScopeItem {
  label: string;
  description: string;
  value: SettingScope;
  key: string;
}

function getPermScopeItems(): PermScopeItem[] {
  return [
    {
      label: t('Project settings'),
      description: t('Checked in at .qwen/settings.json'),
      value: SettingScope.Workspace,
      key: 'project',
    },
    {
      label: t('User settings'),
      description: t('Saved in at ~/.qwen/settings.json'),
      value: SettingScope.User,
      key: 'user',
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTabs(): Tab[] {
  return [
    {
      id: 'allow',
      label: t('Allow'),
      description: t("Qwen Code won't ask before using allowed tools."),
    },
    {
      id: 'ask',
      label: t('Ask'),
      description: t('Qwen Code will ask before using these tools.'),
    },
    {
      id: 'deny',
      label: t('Deny'),
      description: t('Qwen Code is not allowed to use denied tools.'),
    },
    {
      id: 'workspace',
      label: t('Workspace'),
      description: t('Manage trusted directories for this workspace.'),
    },
  ];
}

function describeRule(raw: string): string {
  const match = raw.match(/^([^(]+?)(?:\((.+)\))?$/);
  if (!match) return raw;
  const toolName = match[1]!.trim();
  const specifier = match[2]?.trim();
  if (!specifier) {
    return t('Any use of the {{tool}} tool', { tool: toolName });
  }
  return t("{{tool}} commands matching '{{pattern}}'", {
    tool: toolName,
    pattern: specifier,
  });
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'user':
      return t('From user settings');
    case 'workspace':
      return t('From project settings');
    case 'session':
      return t('From session');
    default:
      return scope;
  }
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface PermissionsDialogProps {
  onExit: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PermissionsDialog({
  onExit,
}: PermissionsDialogProps): React.JSX.Element {
  const config = useConfig();
  const settings = useSettings();
  const pm = config.getPermissionManager?.() as PermissionManager | null;

  // --- Tab state ---
  const tabs = useMemo(() => getTabs(), []);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = tabs[activeTabIndex]!;

  // --- Rule list state ---
  const [allRules, setAllRules] = useState<RuleWithSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // --- Dialog view state machine ---
  const [view, setView] = useState<DialogView>('rule-list');
  const [newRuleInput, setNewRuleInput] = useState('');
  const [ruleInputError, setRuleInputError] = useState('');
  const [pendingRuleText, setPendingRuleText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RuleWithSource | null>(null);

  // --- Workspace directory state ---
  const workspaceContext = config.getWorkspaceContext();
  const [newDirInput, setNewDirInput] = useState('');
  const [dirInputError, setDirInputError] = useState('');
  const [dirInputRemountKey, setDirInputRemountKey] = useState(0);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [removeDirTarget, setRemoveDirTarget] = useState<string | null>(null);
  const [dirRefreshKey, setDirRefreshKey] = useState(0);

  // Refresh rules from PermissionManager
  const refreshRules = useCallback(() => {
    if (pm) {
      setAllRules(pm.listRules());
    }
  }, [pm]);

  useEffect(() => {
    refreshRules();
  }, [refreshRules]);

  // --- Workspace directory helpers ---
  const directories = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dirRefreshKey; // dependency to trigger re-computation
    return workspaceContext.getDirectories();
  }, [workspaceContext, dirRefreshKey]);

  const initialDirs = useMemo(
    () => new Set(workspaceContext.getInitialDirectories()),
    [workspaceContext],
  );

  // Filesystem completions based on current input
  const dirCompletions = useMemo(() => {
    const trimmed = newDirInput.trim();
    if (!trimmed) return [];
    const expanded = trimmed.startsWith('~')
      ? trimmed.replace(/^~/, os.homedir())
      : trimmed;
    const endsWithSep =
      expanded.endsWith('/') || expanded.endsWith(nodePath.sep);
    const searchDir = endsWithSep ? expanded : nodePath.dirname(expanded);
    const prefix = endsWithSep ? '' : nodePath.basename(expanded);
    try {
      return fs
        .readdirSync(searchDir, { withFileTypes: true })
        .filter(
          (e) =>
            e.isDirectory() &&
            e.name.startsWith(prefix) &&
            !e.name.startsWith('.'),
        )
        .map((e) => nodePath.join(searchDir, e.name))
        .slice(0, 6);
    } catch {
      return [];
    }
  }, [newDirInput]);

  const handleDirInputChange = useCallback(
    (text: string) => {
      setNewDirInput(text);
      if (dirInputError) setDirInputError('');
    },
    [dirInputError],
  );

  // Reset selection to first item whenever the completions list changes
  useEffect(() => {
    setCompletionIndex(0);
  }, [dirCompletions]);

  const handleDirTabComplete = useCallback(() => {
    const selected = dirCompletions[completionIndex] ?? dirCompletions[0];
    if (selected) {
      setNewDirInput(selected + '/');
      setDirInputRemountKey((k) => k + 1);
    }
  }, [dirCompletions, completionIndex]);

  const handleDirCompletionUp = useCallback(() => {
    if (dirCompletions.length === 0) return;
    setCompletionIndex(
      (prev) => (prev - 1 + dirCompletions.length) % dirCompletions.length,
    );
  }, [dirCompletions.length]);

  const handleDirCompletionDown = useCallback(() => {
    if (dirCompletions.length === 0) return;
    setCompletionIndex((prev) => (prev + 1) % dirCompletions.length);
  }, [dirCompletions.length]);

  const dirListItems = useMemo(() => {
    const items: Array<{
      label: string;
      value: string;
      key: string;
    }> = [];
    // 'Add directory…' always FIRST
    items.push({
      label: t('Add directory…'),
      value: '__add_dir__',
      key: '__add_dir__',
    });
    // Only show non-initial (runtime-added) directories in the selectable list
    for (const dir of directories) {
      if (!initialDirs.has(dir)) {
        items.push({
          label: dir,
          value: dir,
          key: `dir-${dir}`,
        });
      }
    }
    return items;
  }, [directories, initialDirs]);

  const handleDirListSelect = useCallback(
    (value: string) => {
      if (value === '__add_dir__') {
        setNewDirInput('');
        setView('ws-add-dir-input');
        return;
      }
      // Selecting a directory → offer to remove if not initial
      if (!initialDirs.has(value)) {
        setRemoveDirTarget(value);
        setView('ws-remove-confirm');
      }
    },
    [initialDirs],
  );

  const handleAddDirSubmit = useCallback(() => {
    const trimmed = newDirInput.trim();
    if (!trimmed) return;

    const expanded = trimmed.startsWith('~')
      ? trimmed.replace(/^~/, os.homedir())
      : trimmed;
    const absoluteExpanded = nodePath.isAbsolute(expanded)
      ? expanded
      : nodePath.resolve(expanded);

    // Existence & type checks
    if (!fs.existsSync(absoluteExpanded)) {
      setDirInputError(t('Directory does not exist.'));
      return;
    }
    if (!fs.statSync(absoluteExpanded).isDirectory()) {
      setDirInputError(t('Path is not a directory.'));
      return;
    }

    // Resolve real path to match what workspaceContext stores
    let resolved: string;
    try {
      resolved = fs.realpathSync(absoluteExpanded);
    } catch {
      resolved = absoluteExpanded;
    }

    // Validate: exact duplicate
    if ((directories as string[]).includes(resolved)) {
      setDirInputError(t('This directory is already in the workspace.'));
      return;
    }

    // Validate: is a subdirectory of an existing workspace directory
    for (const existingDir of directories) {
      if (isPathWithinRoot(resolved, existingDir)) {
        setDirInputError(
          t('Already covered by existing directory: {{dir}}', {
            dir: existingDir,
          }),
        );
        return;
      }
    }

    setDirInputError('');

    // Add to workspace context (already validated)
    workspaceContext.addDirectory(resolved);

    // Persist directly to project (Workspace) settings
    const key = 'context.includeDirectories';
    const currentDirs = (settings.merged as Record<string, unknown>)[
      'context'
    ] as Record<string, string[]> | undefined;
    const existingDirs = currentDirs?.['includeDirectories'] ?? [];
    if (!existingDirs.includes(resolved)) {
      settings.setValue(SettingScope.Workspace, key, [
        ...existingDirs,
        resolved,
      ]);
    }

    setDirRefreshKey((k) => k + 1);
    setView('ws-dir-list');
    setNewDirInput('');
  }, [newDirInput, directories, workspaceContext, settings]);

  const handleRemoveDirConfirm = useCallback(() => {
    if (!removeDirTarget) return;

    // Remove from workspace context
    workspaceContext.removeDirectory(removeDirTarget);

    // Remove from settings (try both scopes)
    for (const scope of [SettingScope.User, SettingScope.Workspace]) {
      const scopeSettings = settings.forScope(scope).settings;
      const contextSection = (scopeSettings as Record<string, unknown>)[
        'context'
      ] as Record<string, string[]> | undefined;
      const scopeDirs = contextSection?.['includeDirectories'];
      if (scopeDirs?.includes(removeDirTarget)) {
        const updated = scopeDirs.filter((d: string) => d !== removeDirTarget);
        settings.setValue(scope, 'context.includeDirectories', updated);
        break;
      }
    }

    setDirRefreshKey((k) => k + 1);
    setRemoveDirTarget(null);
    setView('ws-dir-list');
  }, [removeDirTarget, workspaceContext, settings]);

  // Filter rules for current tab
  const currentTabRules = useMemo(() => {
    if (activeTab.id === 'workspace') return [];
    return allRules.filter((r) => r.type === activeTab.id);
  }, [allRules, activeTab.id]);

  // Search-filtered rules
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return currentTabRules;
    const q = searchQuery.toLowerCase();
    return currentTabRules.filter(
      (r) =>
        r.rule.raw.toLowerCase().includes(q) ||
        r.rule.toolName.toLowerCase().includes(q),
    );
  }, [currentTabRules, searchQuery]);

  // Build radio items: "Add a new rule..." + filtered rules
  const listItems = useMemo(() => {
    const items: Array<{
      label: string;
      value: string;
      key: string;
    }> = [
      {
        label: t('Add a new rule…'),
        value: '__add__',
        key: '__add__',
      },
    ];
    for (const r of filteredRules) {
      items.push({
        label: `${r.rule.raw}`,
        value: r.rule.raw,
        key: `${r.type}-${r.scope}-${r.rule.raw}`,
      });
    }
    return items;
  }, [filteredRules]);

  // --- Action handlers ---

  const handleTabCycle = useCallback(
    (direction: 1 | -1) => {
      const newIndex = (activeTabIndex + direction + tabs.length) % tabs.length;
      setActiveTabIndex(newIndex);
      setSearchQuery('');
      setIsSearchActive(false);
      setDirInputError('');
      // Set the appropriate default view for each tab
      const newTab = tabs[newIndex]!;
      setView(newTab.id === 'workspace' ? 'ws-dir-list' : 'rule-list');
    },
    [activeTabIndex, tabs],
  );

  const handleListSelect = useCallback(
    (value: string) => {
      if (value === '__add__') {
        setNewRuleInput('');
        setRuleInputError('');
        setView('add-rule-input');
        return;
      }
      // Selecting an existing rule → offer to delete
      const found = filteredRules.find((r) => r.rule.raw === value);
      if (found) {
        setDeleteTarget(found);
        setView('delete-confirm');
      }
    },
    [filteredRules],
  );

  const handleAddRuleSubmit = useCallback(() => {
    const trimmed = newRuleInput.trim();
    if (!trimmed) return;
    const rule = parseRule(trimmed);
    if (rule.invalid) {
      setRuleInputError(
        t(
          'Malformed rule: unbalanced parentheses. Use the format ToolName(specifier).',
        ),
      );
      return;
    }
    setRuleInputError('');
    setPendingRuleText(trimmed);
    setView('add-rule-scope');
  }, [newRuleInput]);

  const handleScopeSelect = useCallback(
    (scope: SettingScope) => {
      if (!pm || activeTab.id === 'workspace') return;
      const ruleType = activeTab.id as RuleType;

      // Add to PermissionManager in-memory
      pm.addPersistentRule(pendingRuleText, ruleType);

      // Persist to settings file (with dedup)
      const key = `permissions.${ruleType}`;
      const perms = (settings.merged as Record<string, unknown>)[
        'permissions'
      ] as Record<string, string[]> | undefined;
      const currentRules = perms?.[ruleType] ?? [];
      if (!currentRules.includes(pendingRuleText)) {
        settings.setValue(scope, key, [...currentRules, pendingRuleText]);
      }

      // Refresh and go back
      refreshRules();
      setView('rule-list');
      setPendingRuleText('');
    },
    [pm, activeTab.id, pendingRuleText, settings, refreshRules],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!pm || !deleteTarget) return;
    const ruleType = deleteTarget.type;

    // Remove from PermissionManager in-memory
    pm.removePersistentRule(deleteTarget.rule.raw, ruleType);

    // Persist removal — find and remove from settings
    // We try both User and Workspace scopes
    for (const scope of [SettingScope.User, SettingScope.Workspace]) {
      const scopeSettings = settings.forScope(scope).settings;
      const perms = (scopeSettings as Record<string, unknown>)[
        'permissions'
      ] as Record<string, string[]> | undefined;
      const scopeRules = perms?.[ruleType];
      if (scopeRules?.includes(deleteTarget.rule.raw)) {
        const updated = scopeRules.filter(
          (r: string) => r !== deleteTarget.rule.raw,
        );
        settings.setValue(scope, `permissions.${ruleType}`, updated);
        break;
      }
    }

    refreshRules();
    setDeleteTarget(null);
    setView('rule-list');
  }, [pm, deleteTarget, settings, refreshRules]);

  // --- Keypress handling ---

  useKeypress(
    (key) => {
      if (view === 'rule-list') {
        if (key.name === 'escape') {
          if (isSearchActive && searchQuery) {
            setSearchQuery('');
            setIsSearchActive(false);
          } else {
            onExit();
          }
          return;
        }
        if (key.name === 'tab') {
          handleTabCycle(1);
          return;
        }
        if (key.name === 'right' || key.name === 'left') {
          handleTabCycle(key.name === 'right' ? 1 : -1);
          return;
        }
        // Search input: backspace
        if (key.name === 'backspace' || key.name === 'delete') {
          if (searchQuery.length > 0) {
            setSearchQuery((prev) => prev.slice(0, -1));
          }
          return;
        }
        // Search input: printable characters
        if (
          key.sequence &&
          !key.ctrl &&
          !key.meta &&
          key.sequence.length === 1 &&
          key.sequence >= ' '
        ) {
          setSearchQuery((prev) => prev + key.sequence);
          setIsSearchActive(true);
          return;
        }
      }
      if (view === 'add-rule-input') {
        if (key.name === 'escape') {
          setView('rule-list');
          return;
        }
      }
      if (view === 'add-rule-scope') {
        if (key.name === 'escape') {
          setView('add-rule-input');
          return;
        }
      }
      if (view === 'delete-confirm') {
        if (key.name === 'escape') {
          setDeleteTarget(null);
          setView('rule-list');
          return;
        }
        if (key.name === 'return') {
          handleDeleteConfirm();
          return;
        }
      }
      // Workspace tab views
      if (view === 'ws-dir-list') {
        if (key.name === 'escape') {
          onExit();
          return;
        }
        if (key.name === 'tab') {
          handleTabCycle(1);
          return;
        }
        if (key.name === 'right' || key.name === 'left') {
          handleTabCycle(key.name === 'right' ? 1 : -1);
          return;
        }
      }
      if (view === 'ws-add-dir-input') {
        if (key.name === 'escape') {
          setDirInputError('');
          setView('ws-dir-list');
          return;
        }
      }
      if (view === 'ws-remove-confirm') {
        if (key.name === 'escape') {
          setRemoveDirTarget(null);
          setView('ws-dir-list');
          return;
        }
        if (key.name === 'return') {
          handleRemoveDirConfirm();
          return;
        }
      }
    },
    { isActive: true },
  );

  // --- Workspace tab: add directory input ---
  if (activeTab.id === 'workspace' && view === 'ws-add-dir-input') {
    return (
      <box style={{ flexDirection: "column" }}>
        <text bold color={theme.text.accent}>
          {t('Add directory to workspace')}
        </text>
        <box style={{ height: 1 }} />
        <text color={theme.text.secondary} wrap="wrap">
          {t(
            'Qwen Code will be able to read files in this directory and make edits when auto-accept edits is on.',
          )}
        </text>
        <box style={{ height: 1 }} />
        <text>{t('Enter the path to the directory:')}</text>
        <box style={{ borderStyle: "round", borderColor: theme.border.default }} paddingLeft={1} paddingRight={1} marginTop={1}>
          <TextInput
            key={dirInputRemountKey}
            value={newDirInput}
            onChange={handleDirInputChange}
            onSubmit={handleAddDirSubmit}
            onTab={dirCompletions.length > 0 ? handleDirTabComplete : undefined}
            onUp={dirCompletions.length > 0 ? handleDirCompletionUp : undefined}
            onDown={
              dirCompletions.length > 0 ? handleDirCompletionDown : undefined
            }
            placeholder={t('Enter directory path…')}
            isActive={true}
            validationErrors={dirInputError ? [dirInputError] : []}
          />
        </box>
        {/* Filesystem completions: ↑/↓ to navigate, Tab to apply */}
        {dirCompletions.length > 0 && (
          <box style={{ flexDirection: "column" }} marginTop={1} paddingLeft={2}>
            {dirCompletions.map((completion, idx) => {
              const name = nodePath.basename(completion);
              const isSelected = idx === completionIndex;
              return (
                <box key={completion}>
                  <text
                    bold={isSelected}
                    color={
                      isSelected ? theme.text.primary : theme.text.secondary
                    }
                  >
                    {`${name}/`}
                  </text>
                  <text color={theme.text.secondary}>{`    directory`}</text>
                </box>
              );
            })}
          </box>
        )}
        <box marginTop={1}>
          <text color={theme.text.secondary}>
            {t('Tab to complete · Enter to add · Esc to cancel')}
          </text>
        </box>
      </box>
    );
  }

  // --- Workspace tab: remove directory confirmation ---
  if (
    activeTab.id === 'workspace' &&
    view === 'ws-remove-confirm' &&
    removeDirTarget
  ) {
    return (
      <box style={{ flexDirection: "column" }}>
        <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1 }}>
          <text bold>{t('Remove directory?')}</text>
          <box style={{ height: 1 }} />
          <box marginLeft={2} style={{ flexDirection: "column" }}>
            <text bold>{removeDirTarget}</text>
          </box>
          <box style={{ height: 1 }} />
          <text>
            {t(
              'Are you sure you want to remove this directory from the workspace?',
            )}
          </text>
        </box>
        <box marginTop={1} marginLeft={1}>
          <text color={theme.text.secondary}>
            {t('Enter to confirm · Esc to cancel')}
          </text>
        </box>
      </box>
    );
  }

  // --- Workspace tab: directory list (default) ---
  if (activeTab.id === 'workspace') {
    const initialDirArray = Array.from(initialDirs);
    return (
      <box style={{ flexDirection: "column" }}>
        <TabBar tabs={tabs} activeIndex={activeTabIndex} />
        <text color={theme.text.secondary} wrap="wrap">
          {t(
            'Qwen Code can read files in the workspace, and make edits when auto-accept edits is on.',
          )}
        </text>
        <box style={{ height: 1 }} />
        {/* Initial (non-removable) dirs: shown inline with dash, same visual level as list */}
        {initialDirArray.map((dir, idx) => (
          <box key={dir} marginLeft={2}>
            <text color={theme.text.secondary}>{'- '}</text>
            <text>{dir}</text>
            <text color={theme.text.secondary}>
              {idx === 0
                ? t('  (Original working directory)')
                : t('  (from settings)')}
            </text>
          </box>
        ))}
        {/* Selectable list: runtime-added dirs + 'Add directory…' at end */}
        <RadioButtonSelect
          items={dirListItems}
          onSelect={handleDirListSelect}
          isFocused={view === 'ws-dir-list'}
          showNumbers={true}
          showScrollArrows={false}
          maxItemsToShow={15}
        />
        <FooterHint view={view} />
      </box>
    );
  }

  // --- Render views ---

  if (view === 'add-rule-input') {
    return (
      <box style={{ flexDirection: "column" }}>
        <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1 }}>
          <text bold>
            {t('Add {{type}} permission rule', { type: activeTab.id })}
          </text>
          <box style={{ height: 1 }} />
          <text wrap="wrap">
            {t(
              'Permission rules are a tool name, optionally followed by a specifier in parentheses.',
            )}
          </text>
          <text>
            {t('e.g.,')} <text bold>WebFetch</text> {t('or')}{' '}
            <text bold>Bash(ls:*)</text>
          </text>
          <box style={{ height: 1 }} />
          <box style={{ borderStyle: "round", borderColor: theme.border.default }} paddingLeft={1} paddingRight={1}>
            <TextInput
              value={newRuleInput}
              onChange={setNewRuleInput}
              onSubmit={handleAddRuleSubmit}
              placeholder={t('Enter permission rule…')}
              isActive={true}
            />
          </box>
          {ruleInputError && (
            <>
              <box style={{ height: 1 }} />
              <text color={theme.status.error}>{ruleInputError}</text>
            </>
          )}
        </box>
        <box marginTop={1} marginLeft={1}>
          <text color={theme.text.secondary}>
            {t('Enter to submit · Esc to cancel')}
          </text>
        </box>
      </box>
    );
  }

  if (view === 'add-rule-scope') {
    const scopeItems = getPermScopeItems();
    return (
      <box style={{ flexDirection: "column" }}>
        <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1 }}>
          <text bold>
            {t('Add {{type}} permission rule', { type: activeTab.id })}
          </text>
          <box style={{ height: 1 }} />
          <box marginLeft={2} style={{ flexDirection: "column" }}>
            <text bold>{pendingRuleText}</text>
            <text color={theme.text.secondary}>
              {describeRule(pendingRuleText)}
            </text>
          </box>
          <box style={{ height: 1 }} />
          <text>{t('Where should this rule be saved?')}</text>
          <RadioButtonSelect
            items={scopeItems.map((s) => ({
              label: `${s.label}    ${s.description}`,
              value: s.value,
              key: s.key,
            }))}
            onSelect={handleScopeSelect}
            isFocused={true}
            showNumbers={true}
          />
        </box>
        <box marginTop={1} marginLeft={1}>
          <text color={theme.text.secondary}>
            {t('Enter to confirm · Esc to cancel')}
          </text>
        </box>
      </box>
    );
  }

  if (view === 'delete-confirm' && deleteTarget) {
    return (
      <box style={{ flexDirection: "column" }}>
        <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1 }}>
          <text bold>
            {t('Delete {{type}} rule?', { type: deleteTarget.type })}
          </text>
          <box style={{ height: 1 }} />
          <box marginLeft={2} style={{ flexDirection: "column" }}>
            <text bold>{deleteTarget.rule.raw}</text>
            <text color={theme.text.secondary}>
              {describeRule(deleteTarget.rule.raw)}
            </text>
            <text color={theme.text.secondary}>
              {scopeLabel(deleteTarget.scope)}
            </text>
          </box>
          <box style={{ height: 1 }} />
          <text>
            {t('Are you sure you want to delete this permission rule?')}
          </text>
        </box>
        <box marginTop={1} marginLeft={1}>
          <text color={theme.text.secondary}>
            {t('Enter to confirm · Esc to cancel')}
          </text>
        </box>
      </box>
    );
  }

  // --- Default: rule-list view ---

  return (
    <box style={{ flexDirection: "column" }}>
      <TabBar tabs={tabs} activeIndex={activeTabIndex} />
      <text>{activeTab.description}</text>
      {/* Search box */}
      <box style={{ borderStyle: "round", borderColor: theme.border.default, width: 60 }} paddingLeft={1} paddingRight={1}>
        <text color={theme.text.accent}>{'> '}</text>
        {searchQuery ? (
          <text>{searchQuery}</text>
        ) : (
          <text color={Colors.Gray}>{t('Search…')}</text>
        )}
      </box>
      <box style={{ height: 1 }} />
      {/* Rule list */}
      <RadioButtonSelect
        items={listItems}
        onSelect={handleListSelect}
        isFocused={view === 'rule-list'}
        showNumbers={true}
        showScrollArrows={false}
        maxItemsToShow={15}
      />
      <FooterHint view={view} />
    </box>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabBar({
  tabs,
  activeIndex,
}: {
  tabs: Tab[];
  activeIndex: number;
}): React.JSX.Element {
  return (
    <box marginBottom={1}>
      <text color={theme.text.accent} bold>
        {t('Permissions:')}{' '}
      </text>
      {tabs.map((tab, i) => (
        <box key={tab.id} marginRight={2}>
          {i === activeIndex ? (
            <text bold style={{ backgroundColor: theme.text.accent }} color={theme.background.primary}>
              {` ${tab.label} `}
            </text>
          ) : (
            <text color={theme.text.secondary}>{` ${tab.label} `}</text>
          )}
        </box>
      ))}
      <text color={theme.text.secondary}>{t('(←/→ or tab to cycle)')}</text>
    </box>
  );
}

function FooterHint({ view }: { view: DialogView }): React.JSX.Element {
  if (view !== 'rule-list' && view !== 'ws-dir-list') return <></>;
  return (
    <box marginTop={1}>
      <text color={theme.text.secondary}>
        {t(
          'Press ↑↓ to navigate · Enter to select · Type to search · Esc to cancel',
        )}
      </text>
    </box>
  );
}
