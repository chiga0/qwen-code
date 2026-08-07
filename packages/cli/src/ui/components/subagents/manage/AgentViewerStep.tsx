/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { shouldShowColor, getColorForDisplay } from '../utils.js';
import { type SubagentConfig } from '@qwen-code/qwen-code-core';
import { t } from '../../../../i18n/index.js';

interface AgentViewerStepProps {
  selectedAgent: SubagentConfig | null;
}

export const AgentViewerStep = ({ selectedAgent }: AgentViewerStepProps) => {
  if (!selectedAgent) {
    return (
      <box>
        <text color={theme.status.error}>{t('No agent selected')}</text>
      </box>
    );
  }

  const agent = selectedAgent;

  const toolsDisplay = agent.tools ? agent.tools.join(', ') : '*';

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box>
          <text color={theme.text.primary}>{t('File Path: ')}</text>
          <text>{agent.filePath}</text>
        </box>

        <box>
          <text color={theme.text.primary}>{t('Tools: ')}</text>
          <text>{toolsDisplay}</text>
        </box>

        {agent.model && (
          <box>
            <text color={theme.text.primary}>{t('Model: ')}</text>
            <text>{agent.model}</text>
          </box>
        )}

        {shouldShowColor(agent.color) && (
          <box>
            <text color={theme.text.primary}>{t('Color: ')}</text>
            <text color={getColorForDisplay(agent.color)}>{agent.color}</text>
          </box>
        )}

        <box marginTop={1}>
          <text color={theme.text.primary}>{t('Description:')}</text>
        </box>
        <box style={{ padding: 1 }} paddingBottom={0}>
          <text wrap="wrap">{agent.description}</text>
        </box>

        <box marginTop={1}>
          <text color={theme.text.primary}>{t('System Prompt:')}</text>
        </box>
        <box style={{ padding: 1 }} paddingBottom={0}>
          <text wrap="wrap">{agent.systemPrompt}</text>
        </box>
      </box>
    </box>
  );
};
