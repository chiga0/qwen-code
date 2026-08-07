/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { type ToolDefinition } from '../../types.js';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';
import { t } from '../../../i18n/index.js';

interface ToolsListProps {
  tools: readonly ToolDefinition[];
  showDescriptions: boolean;
  contentWidth: number;
}

export const ToolsList: React.FC<ToolsListProps> = ({
  tools,
  showDescriptions,
  contentWidth,
}) => (
  <box style={{ flexDirection: "column" }}>
    <text bold color={theme.text.primary}>
      {t('Available Qwen Code CLI tools:')}
    </text>
    <box style={{ height: 1 }} />
    {tools.length > 0 ? (
      tools.map((tool) => (
        <box key={tool.name} style={{ flexDirection: "row" }}>
          <text color={theme.text.primary}>{'  '}- </text>
          <box style={{ flexDirection: "column" }}>
            <text bold color={theme.text.accent}>
              {tool.displayName}
              {showDescriptions ? ` (${tool.name})` : ''}
            </text>
            {showDescriptions && tool.description && (
              <MarkdownDisplay
                contentWidth={contentWidth}
                text={tool.description}
                isPending={false}
              />
            )}
          </box>
        </box>
      ))
    ) : (
      <text color={theme.text.primary}> {t('No tools available')}</text>
    )}
  </box>
);
