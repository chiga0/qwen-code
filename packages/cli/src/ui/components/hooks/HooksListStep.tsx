/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import type { HookEventDisplayInfo } from './types.js';
import { t } from '../../../i18n/index.js';

function configCountFor(hook: HookEventDisplayInfo): number {
  return hook.matcherGroups.reduce(
    (sum, group) => sum + group.configs.length,
    0,
  );
}

interface HooksListStepProps {
  hooks: HookEventDisplayInfo[];
  selectedIndex: number;
}

export function HooksListStep({
  hooks,
  selectedIndex,
}: HooksListStepProps): React.JSX.Element {
  const { columns: terminalWidth } = useTerminalSize();

  const hookNameWidth = Math.min(
    35,
    Math.max(20, Math.floor(terminalWidth * 0.25)),
  );

  if (hooks.length === 0) {
    return (
      <box style={{ flexDirection: "column" }} paddingX={1}>
        <text color={theme.text.secondary}>{t('No hook events found.')}</text>
      </box>
    );
  }

  const totalConfigured = hooks.reduce(
    (sum, hook) => sum + configCountFor(hook),
    0,
  );

  const hooksConfiguredText =
    totalConfigured === 1
      ? t('{{count}} hook configured', { count: String(totalConfigured) })
      : t('{{count}} hooks configured', { count: String(totalConfigured) });

  return (
    <box style={{ flexDirection: "column" }} paddingX={1}>
      <box marginBottom={1}>
        <text bold color={theme.text.primary}>
          {t('Hooks')}
        </text>
        <text color={theme.text.secondary}>{` · ${hooksConfiguredText}`}</text>
      </box>

      <box marginBottom={1}>
        <text color={theme.text.secondary}>
          {t(
            'This menu is read-only. To add or modify hooks, edit settings.json directly or ask Qwen Code.',
          )}
        </text>
      </box>

      {hooks.map((hook, index) => {
        const isSelected = index === selectedIndex;
        const configCount = configCountFor(hook);
        const maxDigits = String(hooks.length).length;
        const paddedIndex = String(index + 1).padStart(maxDigits);

        return (
          <box key={hook.event}>
            <box minWidth={2}>
              <text color={isSelected ? theme.text.accent : theme.text.primary}>
                {isSelected ? '❯' : ' '}
              </text>
            </box>
            <box style={{ width: hookNameWidth }}>
              <text
                color={isSelected ? theme.text.accent : theme.text.primary}
                bold={isSelected}
              >
                {paddedIndex}. {hook.event}
                {configCount > 0 && (
                  <text color={theme.status.success}> ({configCount})</text>
                )}
              </text>
            </box>
            <text color={theme.text.secondary}>{hook.shortDescription}</text>
          </box>
        );
      })}

      <box marginTop={1}>
        <text color={theme.text.secondary}>
          {t('Enter to select · Esc to cancel')}
        </text>
      </box>
    </box>
  );
}
