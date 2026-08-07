/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { InsightProgressProps } from '../../types.js';
import Spinner from 'ink-spinner';

interface InsightProgressMessageProps {
  progress: InsightProgressProps;
}

export const InsightProgressMessage: React.FC<InsightProgressMessageProps> = ({
  progress,
}) => {
  const { stage, progress: percent, isComplete, error } = progress;
  const width = 30;
  const completedWidth = Math.round((percent / 100) * width);
  const remainingWidth = width - completedWidth;

  const bar =
    '█'.repeat(Math.max(0, completedWidth)) +
    '░'.repeat(Math.max(0, remainingWidth));

  if (error) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text color={theme.status.error}>✕ {stage}</text>
        <text color={theme.text.secondary}>{error}</text>
      </box>
    );
  }

  if (isComplete) {
    return (
      <box style={{ flexDirection: "row" }}>
        <text color={theme.status.success}>✓ {stage}</text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "row" }}>
      <text color={theme.text.accent}>
        <Spinner type="dots" />
      </text>
      <text> </text>
      <text color={theme.text.secondary}>{bar} </text>
      <text color={theme.text.accent}>
        {stage}
        {progress.detail ? ` (${progress.detail})` : ''}
      </text>
    </box>
  );
};
