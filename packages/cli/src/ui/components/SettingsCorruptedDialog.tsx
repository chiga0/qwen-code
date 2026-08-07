/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { t } from '../../i18n/index.js';

const EXIT_INDEX = 0;
const CONTINUE_INDEX = 1;

interface SettingsCorruptedDialogProps {
  corruptedPath: string;
  wasRecovered: boolean;
  onExit: () => void;
  onContinue: () => void;
}

export const SettingsCorruptedDialog: React.FC<
  SettingsCorruptedDialogProps
> = ({ corruptedPath, wasRecovered, onExit, onContinue }) => {
  const [selectedIndex, setSelectedIndex] = useState(EXIT_INDEX);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onContinue();
        return;
      }
      if (key.ctrl && key.name === 'c') {
        onExit();
        return;
      }
      if (key.name === 'up') {
        setSelectedIndex(EXIT_INDEX);
      }
      if (key.name === 'down') {
        setSelectedIndex(CONTINUE_INDEX);
      }
      if (key.name === 'return') {
        if (selectedIndex === EXIT_INDEX) {
          onExit();
        } else {
          onContinue();
        }
      }
    },
    { isActive: true },
  );

  const continueLabel = wasRecovered
    ? t('Continue with recovered settings (esc)')
    : t('Continue with empty settings (esc)');

  return (
    <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.status.error, padding: 1, width: "100%" }} marginLeft={1}>
      <box marginBottom={1} style={{ flexDirection: "column" }}>
        <text>
          <text color={theme.status.error}>{'> '}</text>
          <text bold color={theme.status.error}>
            {t('Settings file corrupted')}
          </text>
        </text>
        <text color={theme.text.secondary}>
          {t(
            'Your settings file had invalid JSON. A copy of the corrupted file has been saved for reference.',
          )}
        </text>
        <text color={theme.text.secondary}>{corruptedPath}</text>
      </box>
      <box style={{ flexDirection: "column" }}>
        <box>
          <text>
            {selectedIndex === EXIT_INDEX ? (
              <text color={theme.status.success}>{'> '}</text>
            ) : (
              '  '
            )}
          </text>
          <text
            color={
              selectedIndex === EXIT_INDEX
                ? theme.status.success
                : theme.text.primary
            }
          >
            {t('Exit and restore corrupted file')}
          </text>
        </box>
        <box>
          <text>
            {selectedIndex === CONTINUE_INDEX ? (
              <text color={theme.status.success}>{'> '}</text>
            ) : (
              '  '
            )}
          </text>
          <text
            color={
              selectedIndex === CONTINUE_INDEX
                ? theme.status.success
                : theme.text.primary
            }
          >
            {continueLabel}
          </text>
        </box>
      </box>
    </box>
  );
};
