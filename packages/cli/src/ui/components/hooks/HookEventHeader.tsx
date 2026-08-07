/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { HookEventDisplayInfo } from './types.js';
import { t } from '../../../i18n/index.js';

interface HookEventHeaderProps {
  title: string;
  description: string;
  exitCodes: HookEventDisplayInfo['exitCodes'];
}

export function HookEventHeader({
  title,
  description,
  exitCodes,
}: HookEventHeaderProps): React.JSX.Element {
  return (
    <>
      <box marginBottom={1}>
        <text bold color={theme.text.primary}>
          {title}
        </text>
      </box>

      {description && (
        <box marginBottom={1}>
          <text color={theme.text.secondary}>{description}</text>
        </box>
      )}

      <ExitCodesBlock exitCodes={exitCodes} />
    </>
  );
}

function ExitCodesBlock({
  exitCodes,
}: {
  exitCodes: HookEventDisplayInfo['exitCodes'];
}): React.JSX.Element | null {
  if (exitCodes.length === 0) return null;
  return (
    <box style={{ flexDirection: "column" }} marginBottom={1}>
      {exitCodes.map((ec, index) => {
        const label =
          typeof ec.code === 'number'
            ? `${t('Exit code')} ${ec.code}`
            : `${t('Other exit codes')}`;
        return (
          <box key={index}>
            <text color={theme.text.secondary}>
              {label} - {ec.description}
            </text>
          </box>
        );
      })}
    </box>
  );
}
