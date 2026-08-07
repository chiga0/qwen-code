/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import type { HookEventDisplayInfo } from './types.js';
import { HookEventHeader } from './HookEventHeader.js';
import { formatSourceLabels } from './sourceLabels.js';
import { t } from '../../../i18n/index.js';

interface HookEventMatcherListStepProps {
  hook: HookEventDisplayInfo;
  selectedIndex: number;
}

export function HookEventMatcherListStep({
  hook,
  selectedIndex,
}: HookEventMatcherListStepProps): React.JSX.Element {
  const { columns: terminalWidth } = useTerminalSize();
  const leftWidth = Math.floor(terminalWidth * 0.6);
  const hasMatchers = hook.matcherGroups.length > 0;

  return (
    <box style={{ flexDirection: "column" }} paddingX={1}>
      <HookEventHeader
        title={`${hook.event} - ${t('Matchers')}`}
        description={hook.description}
        exitCodes={hook.exitCodes}
      />

      {hasMatchers ? (
        <>
          {hook.matcherGroups.map((group, index) => {
            const isSelected = index === selectedIndex;
            const sourceLabel = formatSourceLabels(group.configs);
            const count = group.configs.length;
            const countLabel =
              count === 1
                ? t('{{count}} hook', { count: String(count) })
                : t('{{count}} hooks', { count: String(count) });
            const rowText = `${index + 1}. [${sourceLabel}] ${group.matcher}`;

            return (
              <box key={`${group.matcher}-${index}`}>
                <box minWidth={2}>
                  <text
                    color={isSelected ? theme.text.accent : theme.text.primary}
                  >
                    {isSelected ? '❯' : ' '}
                  </text>
                </box>
                <box style={{ width: leftWidth }}>
                  <text
                    color={isSelected ? theme.text.accent : theme.text.primary}
                    bold={isSelected}
                    wrap="wrap"
                  >
                    {rowText}
                  </text>
                </box>
                <text color={theme.text.secondary}>{countLabel}</text>
              </box>
            );
          })}
          <box marginTop={1}>
            <text color={theme.text.secondary}>
              {t('Enter to select · Esc to go back')}
            </text>
          </box>
        </>
      ) : (
        <>
          <box>
            <text color={theme.text.secondary}>
              {t('No hooks configured for this event.')}
            </text>
          </box>
          <box marginTop={1}>
            <text color={theme.text.secondary}>
              {t('To add hooks, edit settings.json directly or ask Qwen.')}
            </text>
          </box>
          <box marginTop={1}>
            <text color={theme.text.secondary}>{t('Esc to go back')}</text>
          </box>
        </>
      )}
    </box>
  );
}
