/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { HookEventDisplayInfo, HookMatcherDisplayInfo } from './types.js';
import { HookEventHeader } from './HookEventHeader.js';
import { HandlerListBody } from './HandlerListBody.js';
import { t } from '../../../i18n/index.js';

interface HookMatcherDetailStepProps {
  hookEvent: HookEventDisplayInfo;
  matcherGroup: HookMatcherDisplayInfo;
  selectedIndex: number;
}

export function HookMatcherDetailStep({
  hookEvent,
  matcherGroup,
  selectedIndex,
}: HookMatcherDetailStepProps): React.JSX.Element {
  const hasConfigs = matcherGroup.configs.length > 0;

  return (
    <box style={{ flexDirection: "column" }} paddingX={1}>
      <HookEventHeader
        title={`${hookEvent.event} - ${t('Matcher:')} ${matcherGroup.matcher}`}
        description={hookEvent.description}
        exitCodes={hookEvent.exitCodes}
      />

      {hasConfigs ? (
        <HandlerListBody
          configs={matcherGroup.configs}
          selectedIndex={selectedIndex}
        />
      ) : (
        <>
          <box>
            <text color={theme.text.secondary}>
              {t('No hooks configured for this matcher.')}
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
