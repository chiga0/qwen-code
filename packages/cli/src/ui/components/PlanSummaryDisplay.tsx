/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { MarkdownDisplay } from '../utils/MarkdownDisplay.js';
import { Colors } from '../colors.js';
import type { PlanResultDisplay } from '@qwen-code/qwen-code-core';

interface PlanSummaryDisplayProps {
  data: PlanResultDisplay;
  availableHeight?: number;
  childWidth: number;
}

export const PlanSummaryDisplay: React.FC<PlanSummaryDisplayProps> = ({
  data,
  availableHeight,
  childWidth,
}) => {
  const { message, plan, rejected } = data;
  const messageColor = rejected ? Colors.AccentYellow : Colors.AccentGreen;

  return (
    <box style={{ flexDirection: "column" }}>
      <box marginBottom={1}>
        <text color={messageColor} wrap="wrap">
          {message}
        </text>
      </box>
      <MarkdownDisplay
        text={plan}
        isPending={false}
        availableTerminalHeight={availableHeight}
        contentWidth={childWidth}
      />
    </box>
  );
};
