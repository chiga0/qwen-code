/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { type SlashCommand } from '../commands/types.js';
import { t } from '../../i18n/index.js';
import {
  formatSupportedModes,
  getCommandDisplayName,
  getCommandSourceBadge,
  getCommandSourceGroup,
  getCommandSubcommandNames,
} from '../../services/commandMetadata.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { HelpTab } from '../contexts/UIActionsContext.js';

export type { HelpTab };

interface HelpProps {
  commands: readonly SlashCommand[];
  width?: number;
  activeTab?: HelpTab;
  onTabChange?: (tab: HelpTab) => void;
  onClose?: () => void;
  isInteractive?: boolean;
}

type CommandGroup = {
  key: string;
  title: string;
  order: number;
  commands: SlashCommand[];
};

const DEFAULT_WIDTH = 100;
const KEY_COL_WIDTH = 20;
const COMMAND_LIST_VISIBLE_LINES = 18;
const TAB_DEFS: Array<{ tab: HelpTab; labelKey: string }> = [
  { tab: 'general', labelKey: 'general' },
  { tab: 'commands', labelKey: 'commands' },
  { tab: 'custom-commands', labelKey: 'custom-commands' },
];
const DOCS_URL = 'https://qwenlm.github.io/qwen-code-docs/';

export const Help: React.FC<HelpProps> = ({
  commands,
  width = DEFAULT_WIDTH,
  activeTab = 'general',
  onTabChange,
  onClose,
  isInteractive = false,
}) => {
  const safeWidth = Math.max(72, width);
  const bodyWidth = safeWidth - 6;
  const handleTabChange = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = TAB_DEFS.findIndex((tab) => tab.tab === activeTab);
      const nextIndex =
        (currentIndex + direction + TAB_DEFS.length) % TAB_DEFS.length;
      onTabChange?.(TAB_DEFS[nextIndex].tab);
    },
    [activeTab, onTabChange],
  );

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose?.();
        return;
      }
      if (key.name === 'tab') {
        handleTabChange(key.shift ? -1 : 1);
      }
    },
    { isActive: isInteractive },
  );

  return (
    <box style={{ flexDirection: "column", width: safeWidth }}>
      <box style={{ borderColor: theme.border.default, borderStyle: "single", width: safeWidth }}>
        <box style={{ flexDirection: "column", width: safeWidth - 2 }} paddingX={2} paddingY={1}>
          <HelpTabs activeTab={activeTab} />
          <box marginTop={1}>
            {activeTab === 'general' && <GeneralHelp width={bodyWidth} />}
            {activeTab === 'commands' && (
              <CommandsHelp
                commands={commands}
                width={bodyWidth}
                customOnly={false}
                isInteractive={isInteractive}
              />
            )}
            {activeTab === 'custom-commands' && (
              <CommandsHelp
                commands={commands}
                width={bodyWidth}
                customOnly
                isInteractive={isInteractive}
              />
            )}
          </box>
          <box marginTop={1}>
            <text color={theme.text.secondary}>
              {t('For more help:')} <text underline>{DOCS_URL}</text>
            </text>
          </box>
          <box marginTop={1}>
            <text italic color={theme.text.secondary}>
              {t('Tab/Shift+Tab to switch tabs  ·  Esc to cancel')}
            </text>
          </box>
        </box>
      </box>
    </box>
  );
};

const HelpTabs: React.FC<{ activeTab: HelpTab }> = ({ activeTab }) => (
  <box style={{ flexDirection: "row" }}>
    <text bold color={theme.text.accent}>
      Qwen Code
    </text>
    <text color={theme.text.secondary}> </text>
    {TAB_DEFS.map(({ tab, labelKey }) => {
      const active = tab === activeTab;
      return (
        <box key={tab} marginLeft={1}>
          <text color={active ? theme.background.primary : theme.text.primary} style={{ backgroundColor: active ? theme.text.accent : undefined }}>
            {` ${t(labelKey)} `}
          </text>
        </box>
      );
    })}
  </box>
);

const GeneralHelp: React.FC<{ width: number }> = ({ width }) => {
  const shortcuts: Array<[string, string]> = [
    ['@', t('Add files or folders as context')],
    ['!', t('Run shell commands')],
    ['/', t('Open command menu')],
    ['Tab', t('Accept ghost text or completion')],
    ['Esc Esc', t('Clear input or cancel operation')],
    ['Ctrl+L', t('Clear the screen')],
    ['Ctrl+Q', t('Queue message for the next turn')],
    [
      process.platform === 'win32' ? 'Ctrl+Enter' : 'Ctrl+J',
      t('Insert a newline'),
    ],
    [
      process.platform === 'win32' ? 'Tab' : 'Shift+Tab',
      t('Cycle approval modes'),
    ],
    ['Alt+←/→', t('Jump through words')],
    ['↑/↓', t('Cycle prompt history')],
  ];
  const left = shortcuts.slice(0, Math.ceil(shortcuts.length / 2));
  const right = shortcuts.slice(Math.ceil(shortcuts.length / 2));
  const colWidth = Math.floor((width - 2) / 2);

  return (
    <box style={{ flexDirection: "column" }}>
      <box marginBottom={1}>
        <text color={theme.text.primary}>
          {t(
            'Qwen Code understands your codebase, makes edits with your permission, and executes commands right from your terminal.',
          )}
        </text>
      </box>
      <text bold color={theme.text.primary}>
        {t('Shortcuts')}
      </text>
      <box style={{ flexDirection: "row", gap: 2 }}>
        <box style={{ flexDirection: "column", width: colWidth }}>
          {left.map(([key, desc]) => (
            <ShortcutRow
              key={key}
              shortcutKey={key}
              desc={desc}
              width={colWidth}
            />
          ))}
        </box>
        <box style={{ flexDirection: "column", width: colWidth }}>
          {right.map(([key, desc]) => (
            <ShortcutRow
              key={key}
              shortcutKey={key}
              desc={desc}
              width={colWidth}
            />
          ))}
        </box>
      </box>
    </box>
  );
};

const ShortcutRow: React.FC<{
  shortcutKey: string;
  desc: string;
  width: number;
}> = ({ shortcutKey, desc, width }) => (
  <box style={{ flexDirection: "row", width: width }}>
    <box style={{ width: KEY_COL_WIDTH, flexShrink: 0 }}>
      <text color={theme.text.accent}>{shortcutKey}</text>
    </box>
    <text color={theme.text.primary} wrap="truncate">
      {truncateText(desc, width - KEY_COL_WIDTH - 1)}
    </text>
  </box>
);

const CommandsHelp: React.FC<{
  commands: readonly SlashCommand[];
  width: number;
  customOnly: boolean;
  isInteractive: boolean;
}> = ({ commands, width, customOnly, isInteractive }) => {
  const groups = useMemo(
    () => groupCommands(commands, customOnly),
    [commands, customOnly],
  );
  const lines = useMemo(
    () => renderCommandLines(groups, width),
    [groups, width],
  );
  const maxScroll = Math.max(0, lines.length - COMMAND_LIST_VISIBLE_LINES);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setScrollOffset(0);
  }, [customOnly, commands]);

  useEffect(() => {
    setScrollOffset((offset) => Math.min(offset, maxScroll));
  }, [maxScroll]);

  useKeypress(
    (key) => {
      if (key.name === 'up') {
        setScrollOffset((offset) => Math.max(0, offset - 1));
      } else if (key.name === 'down') {
        setScrollOffset((offset) => Math.min(maxScroll, offset + 1));
      } else if (key.name === 'pageup') {
        setScrollOffset((offset) =>
          Math.max(0, offset - COMMAND_LIST_VISIBLE_LINES),
        );
      } else if (key.name === 'pagedown') {
        setScrollOffset((offset) =>
          Math.min(maxScroll, offset + COMMAND_LIST_VISIBLE_LINES),
        );
      }
    },
    { isActive: isInteractive },
  );

  if (groups.length === 0) {
    return (
      <text color={theme.text.secondary}>
        {customOnly
          ? t('No custom commands are currently available.')
          : t('No commands are currently available.')}
      </text>
    );
  }

  const visibleLines = lines.slice(
    scrollOffset,
    scrollOffset + COMMAND_LIST_VISIBLE_LINES,
  );

  return (
    <box style={{ flexDirection: "column" }}>
      <box marginBottom={1}>
        <text color={theme.text.primary}>
          {customOnly
            ? t('Browse custom, skill, plugin, and MCP commands:')
            : t('Browse built-in commands:')}
        </text>
      </box>
      <box style={{ flexDirection: "column", height: COMMAND_LIST_VISIBLE_LINES }}>
        {visibleLines.map((line, index) => {
          const stableKey =
            line.type === 'blank'
              ? `blank:${index}`
              : `${line.type}:${line.text}:${index}`;
          return <CommandLine key={stableKey} line={line} />;
        })}
      </box>
      {maxScroll > 0 &&
        (() => {
          const totalCommands = lines.filter(
            (l) => l.type === 'signature',
          ).length;
          const visibleSignatures = visibleLines.filter(
            (l): l is Extract<CommandLine, { type: 'signature' }> =>
              l.type === 'signature',
          );
          const firstCmd =
            visibleSignatures.length > 0
              ? visibleSignatures[0].commandIndex + 1
              : 0;
          const lastCmd =
            visibleSignatures.length > 0
              ? visibleSignatures[visibleSignatures.length - 1].commandIndex + 1
              : 0;
          const range =
            firstCmd === lastCmd ? `${firstCmd}` : `${firstCmd}-${lastCmd}`;
          return (
            <box marginTop={1}>
              <text color={theme.text.secondary}>
                {t('Use ↑/↓ to scroll')} {`(${range}/${totalCommands})`}
              </text>
            </box>
          );
        })()}
    </box>
  );
};

type CommandLine =
  | { type: 'group'; text: string; count: number }
  | { type: 'signature'; text: string; meta: string; commandIndex: number }
  | { type: 'description'; text: string }
  | { type: 'subcommands'; text: string }
  | { type: 'blank' };

const CommandLine: React.FC<{ line: CommandLine }> = ({ line }) => {
  switch (line.type) {
    case 'group':
      return (
        <text bold color={theme.text.primary}>
          {line.text}{' '}
          <text color={theme.text.secondary}>{`(${line.count})`}</text>
        </text>
      );
    case 'signature':
      return (
        <box style={{ flexDirection: "row" }}>
          <text color={theme.text.accent}> {line.text}</text>
          {line.meta && <text color={theme.text.secondary}> {line.meta}</text>}
        </box>
      );
    case 'description':
      return (
        <box paddingLeft={4}>
          <text color={theme.text.primary} wrap="truncate">
            {line.text}
          </text>
        </box>
      );
    case 'subcommands':
      return (
        <box paddingLeft={4}>
          <text color={theme.text.secondary} wrap="truncate">
            {line.text}
          </text>
        </box>
      );
    case 'blank':
      return <text> </text>;
    default:
      return null;
  }
};

function renderCommandLines(
  groups: CommandGroup[],
  width: number,
): CommandLine[] {
  const lines: CommandLine[] = [];
  let commandIndex = 0;
  groups.forEach((group, groupIndex) => {
    lines.push({
      type: 'group',
      text: group.title,
      count: group.commands.length,
    });
    group.commands.forEach((cmd) => {
      const sigLine = getCommandSignatureLine(cmd, width);
      lines.push({ ...sigLine, commandIndex: commandIndex++ } as CommandLine);
      const descriptionLine = getCommandDescriptionLine(cmd, width);
      if (descriptionLine) {
        lines.push(descriptionLine);
      }
      const subcommandsLine = getCommandSubcommandsLine(cmd, width);
      if (subcommandsLine) {
        lines.push(subcommandsLine);
      }
    });
    if (groupIndex < groups.length - 1) {
      lines.push({ type: 'blank' });
    }
  });
  return lines;
}

function getCommandSignatureLine(
  command: SlashCommand,
  width: number,
): CommandLine {
  const badge = getCommandSourceBadge(command);
  const name = getCommandDisplayName(command, {
    prefix: '/',
    includeAliases: false,
  });
  const signature = [name, command.argumentHint].filter(Boolean).join(' ');
  const meta = [
    badge,
    formatSupportedModes(command),
    command.modelInvocable ? '[model]' : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    type: 'signature',
    text: truncateText(signature, Math.floor(width * 0.42)),
    meta,
    commandIndex: -1, // assigned by renderCommandLines
  };
}

function getCommandDescriptionLine(
  command: SlashCommand,
  width: number,
): CommandLine | null {
  if (!command.description) {
    return null;
  }
  return {
    type: 'description',
    text: truncateText(command.description, Math.max(20, width - 4)),
  };
}

function getCommandSubcommandsLine(
  command: SlashCommand,
  width: number,
): CommandLine | null {
  const subcommands = getCommandSubcommandNames(command);
  if (subcommands.length === 0) {
    return null;
  }
  const descWidth = Math.max(20, width - 4);
  return {
    type: 'subcommands',
    text: `${t('subcommands:')} ${truncateText(subcommands.join(', '), descWidth - 13)}`,
  };
}

function groupCommands(
  commands: readonly SlashCommand[],
  customOnly: boolean,
): CommandGroup[] {
  const groups = new Map<string, CommandGroup>();

  commands
    .filter((cmd) => cmd.description && !cmd.hidden)
    .forEach((cmd) => {
      const group = getCommandSourceGroup(cmd);
      if (customOnly ? group.key === 'built-in' : group.key !== 'built-in') {
        return;
      }
      const existing = groups.get(group.key);
      if (existing) {
        existing.commands.push(cmd);
      } else {
        groups.set(group.key, {
          key: group.key,
          title: group.title,
          order: group.order,
          commands: [cmd],
        });
      }
    });

  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      commands: group.commands.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 1 || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}
