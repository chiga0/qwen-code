/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import {
  redactUrlCredentials,
  getExtensionDisplayName,
  getExtensionDescription,
  type Extension,
} from '@qwen-code/qwen-code-core';
import { t, getCurrentLanguage } from '../../../../i18n/index.js';

interface ExtensionDetailStepProps {
  selectedExtension: Extension | null;
}

export const ExtensionDetailStep = ({
  selectedExtension,
}: ExtensionDetailStepProps) => {
  if (!selectedExtension) {
    return (
      <box>
        <text color={theme.status.error}>{t('No extension selected')}</text>
      </box>
    );
  }

  const ext = selectedExtension;
  const isActive = ext.isActive;
  const activeColor = isActive ? theme.status.success : theme.text.secondary;
  const activeString = isActive ? t('active') : t('disabled');

  const locale = getCurrentLanguage();
  const description = getExtensionDescription(ext, locale);

  // Fixed width for labels to ensure alignment
  const LABEL_WIDTH = 12;

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <box>
          <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
            <text color={theme.text.primary}>{t('Name:')}</text>
          </box>
          <text>{getExtensionDisplayName(ext, locale)}</text>
        </box>

        {description && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Description:')}</text>
            </box>
            <text color={theme.text.secondary}>{description}</text>
          </box>
        )}

        <box>
          <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
            <text color={theme.text.primary}>{t('Version:')}</text>
          </box>
          <text>{ext.version}</text>
        </box>

        <box>
          <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
            <text color={theme.text.primary}>{t('Status:')}</text>
          </box>
          <text color={activeColor}>{activeString}</text>
        </box>

        <box>
          <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
            <text color={theme.text.primary}>{t('Path:')}</text>
          </box>
          <text>{ext.path}</text>
        </box>

        {ext.installMetadata && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Source:')}</text>
            </box>
            <text>{redactUrlCredentials(ext.installMetadata.source)}</text>
          </box>
        )}

        {ext.mcpServers && Object.keys(ext.mcpServers).length > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('MCP Servers:')}</text>
            </box>
            <text>{Object.keys(ext.mcpServers).join(', ')}</text>
          </box>
        )}

        {ext.commands && ext.commands.length > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Commands:')}</text>
            </box>
            <text>{ext.commands.join(', ')}</text>
          </box>
        )}

        {ext.skills && ext.skills.length > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Skills:')}</text>
            </box>
            <text>{ext.skills.map((s) => s.name).join(', ')}</text>
          </box>
        )}

        {ext.agents && ext.agents.length > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Agents:')}</text>
            </box>
            <text>{ext.agents.map((a) => a.name).join(', ')}</text>
          </box>
        )}

        {ext.resolvedSettings && ext.resolvedSettings.length > 0 && (
          <box style={{ flexDirection: "column" }} marginTop={1}>
            <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
              <text color={theme.text.primary}>{t('Settings:')}</text>
            </box>
            <box style={{ flexDirection: "column" }} paddingLeft={2}>
              {ext.resolvedSettings.map((setting) => (
                <text key={setting.name}>
                  - {setting.name}: {setting.value}
                </text>
              ))}
            </box>
          </box>
        )}
      </box>
    </box>
  );
};
