/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { t } from '../../i18n/index.js';
import { useKeypress } from '../hooks/useKeypress.js';

interface ExternalAuthProgressProps {
  title: string;
  message: string;
  detail?: string;
  onCancel?: () => void;
}

export function ExternalAuthProgress({
  title,
  message,
  detail,
  onCancel,
}: ExternalAuthProgressProps): React.JSX.Element {
  useKeypress(
    (key) => {
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        onCancel?.();
      }
    },
    { isActive: Boolean(onCancel) },
  );

  return (
    <box style={{ borderStyle: "single", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
      <text bold>{title}</text>

      <box marginTop={1} style={{ flexDirection: "column" }}>
        <text>{message}</text>
        {detail ? <text color={theme.text.secondary}>{detail}</text> : null}
      </box>

      <box marginTop={1} style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>
          {t('Please wait while authentication completes...')}
        </text>
        {onCancel ? (
          <text color={theme.text.secondary}>{t('Esc to cancel')}</text>
        ) : null}
      </box>
    </box>
  );
}
