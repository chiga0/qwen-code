/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolConfirmationOutcome } from '@qwen-code/qwen-code-core';
import { Box, Text } from 'ink';
import type React from 'react';
import { theme } from '../semantic-colors.js';
import type { RadioSelectItem } from './shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { MaxSizedBox } from './shared/MaxSizedBox.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';
import { clampDialogHeight } from '../utils/layoutUtils.js';

// Border, title, subtitle, question, and option rows that must remain visible.
const SHELL_CONFIRMATION_FIXED_ROWS = 9;
const MIN_HEIGHT_WITH_HIDDEN_COMMAND_OPTIONS = 8;

export interface ShellConfirmationRequest {
  commands: string[];
  onConfirm: (
    outcome: ToolConfirmationOutcome,
    approvedCommands?: string[],
  ) => void;
}

export interface ShellConfirmationDialogProps {
  request: ShellConfirmationRequest;
  availableTerminalHeight?: number;
  contentWidth?: number;
}

export const ShellConfirmationDialog: React.FC<
  ShellConfirmationDialogProps
> = ({ request, availableTerminalHeight, contentWidth = 80 }) => {
  const { commands, onConfirm } = request;
  const constrainedHeight = clampDialogHeight(availableTerminalHeight);
  const commandPreviewHeight =
    constrainedHeight === undefined
      ? undefined
      : constrainedHeight >= SHELL_CONFIRMATION_FIXED_ROWS + 2
        ? Math.max(2, constrainedHeight - SHELL_CONFIRMATION_FIXED_ROWS)
        : 0;
  const commandsHidden =
    constrainedHeight !== undefined &&
    commandPreviewHeight === 0 &&
    commands.length > 0;
  const commandApprovalUnavailable =
    commandsHidden &&
    constrainedHeight !== undefined &&
    constrainedHeight < MIN_HEIGHT_WITH_HIDDEN_COMMAND_OPTIONS;
  const compactHiddenCommandsLayout =
    commandsHidden && constrainedHeight <= SHELL_CONFIRMATION_FIXED_ROWS;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onConfirm(ToolConfirmationOutcome.Cancel);
      }
    },
    { isActive: true },
  );

  const handleSelect = (item: ToolConfirmationOutcome) => {
    if (item === ToolConfirmationOutcome.Cancel) {
      onConfirm(item);
    } else {
      // For both ProceedOnce and ProceedAlways, we approve all the
      // commands that were requested.
      onConfirm(item, commands);
    }
  };

  const options: Array<RadioSelectItem<ToolConfirmationOutcome>> = [
    {
      label: t('Yes, allow once'),
      value: ToolConfirmationOutcome.ProceedOnce,
      key: 'Yes, allow once',
    },
    {
      label: t('Always allow in this project'),
      value: ToolConfirmationOutcome.ProceedAlwaysProject,
      key: 'Always allow in this project',
    },
    {
      label: t('Always allow for this user'),
      value: ToolConfirmationOutcome.ProceedAlwaysUser,
      key: 'Always allow for this user',
    },
    {
      label: t('No (esc)'),
      value: ToolConfirmationOutcome.Cancel,
      key: 'No (esc)',
    },
  ];
  const visibleOptions = commandApprovalUnavailable
    ? options.filter(
        (option) => option.value === ToolConfirmationOutcome.Cancel,
      )
    : options;

  return (
    <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.status.warning, width: "100%", height: constrainedHeight }} paddingX={1} paddingY={constrainedHeight === undefined ? 1 : 0} marginLeft={1} overflow="hidden">
      <text bold color={theme.text.primary} wrap="truncate">
        {t('Shell Command Execution')}
      </text>
      {!compactHiddenCommandsLayout && (
        <text color={theme.text.primary} wrap="truncate">
          {t('A custom command wants to run the following shell commands:')}
        </text>
      )}
      {constrainedHeight === undefined ? (
        <box style={{ flexDirection: "column", flexShrink: 1 }} marginTop={1} marginBottom={1}>
          <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default }} paddingX={1}>
            {commands.map((cmd) => (
              <text key={cmd} color={theme.text.link}>
                {cmd}
              </text>
            ))}
          </box>
        </box>
      ) : commandPreviewHeight !== undefined && commandPreviewHeight > 0 ? (
        <box style={{ flexDirection: "column", flexShrink: 1 }}>
          <MaxSizedBox
            maxHeight={commandPreviewHeight}
            maxWidth={Math.max(1, contentWidth - 8)}
            overflowDirection="top"
          >
            {commands.map((cmd) => (
              <box key={cmd}>
                <text color={theme.text.link}>{cmd}</text>
              </box>
            ))}
          </MaxSizedBox>
        </box>
      ) : commandsHidden ? (
        <text color={theme.status.warning} wrap="truncate">
          {commands.length}{' '}
          {t('shell commands hidden - resize terminal to review')}
        </text>
      ) : null}

      {!compactHiddenCommandsLayout && (
        <box marginBottom={constrainedHeight === undefined ? 1 : 0} style={{ flexShrink: 0 }}>
          <text color={theme.text.primary}>{t('Do you want to proceed?')}</text>
        </box>
      )}

      <box style={{ flexShrink: 0 }}>
        <RadioButtonSelect
          items={visibleOptions}
          onSelect={handleSelect}
          isFocused
        />
      </box>
    </box>
  );
};
