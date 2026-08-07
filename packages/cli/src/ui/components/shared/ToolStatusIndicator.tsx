/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { ToolCallStatus } from '../../types.js';
import { GeminiRespondingSpinner } from '../GeminiRespondingSpinner.js';
import {
  TOOL_STATUS,
  SHELL_COMMAND_NAME,
  SHELL_NAME,
} from '../../constants.js';
import { theme } from '../../semantic-colors.js';

// One column for the status glyph plus one trailing column so the tool
// name never sits flush against the indicator. Paired with flexShrink={0}
// on the indicator Box so the reservation survives a tight header row.
// The fixed 2-col width ensures both 1-col and 2-col glyphs push text
// to the same start position.
export const STATUS_INDICATOR_WIDTH = 2;

type ToolStatusIndicatorProps = {
  status: ToolCallStatus;
  name: string;
};

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  status,
  name,
}) => {
  const isShell = name === SHELL_COMMAND_NAME || name === SHELL_NAME;
  const statusColor = isShell ? theme.ui.symbol : theme.status.warning;

  return (
    // minWidth (not width) so the box can grow for wider content like the
    // tmux spinner frames or test mocks; all production glyphs are ≤2 cols.
    <box minWidth={STATUS_INDICATOR_WIDTH} style={{ flexShrink: 0 }}>
      {status === ToolCallStatus.Pending && (
        <text color={theme.status.success}>{TOOL_STATUS.PENDING}</text>
      )}
      {status === ToolCallStatus.Executing && (
        <GeminiRespondingSpinner
          spinnerType="toggle"
          nonRespondingDisplay={TOOL_STATUS.EXECUTING}
        />
      )}
      {status === ToolCallStatus.Success && (
        <text color={theme.status.success} aria-label={'Success:'}>
          {TOOL_STATUS.SUCCESS}
        </text>
      )}
      {status === ToolCallStatus.Confirming && (
        <text color={statusColor} aria-label={'Confirming:'}>
          {TOOL_STATUS.CONFIRMING}
        </text>
      )}
      {status === ToolCallStatus.Canceled && (
        <text color={statusColor} aria-label={'Canceled:'} bold>
          {TOOL_STATUS.CANCELED}
        </text>
      )}
      {status === ToolCallStatus.Error && (
        <text color={theme.status.error} aria-label={'Error:'} bold>
          {TOOL_STATUS.ERROR}
        </text>
      )}
    </box>
  );
};
