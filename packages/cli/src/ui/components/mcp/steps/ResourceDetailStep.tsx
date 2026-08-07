/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { t } from '../../../../i18n/index.js';
import { buildMcpResourceRef } from '../../../hooks/mcpResourceRef.js';
import type { ResourceDetailStepProps } from '../types.js';

const LABEL_WIDTH = 15;

export const ResourceDetailStep: React.FC<ResourceDetailStepProps> = ({
  resource,
  onBack,
  isActive = true,
}) => {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onBack();
      }
    },
    { isActive },
  );

  if (!resource) {
    return (
      <box>
        <text color={theme.status.error}>{t('No resource selected')}</text>
      </box>
    );
  }

  // 与 URI 不同时才展示友好名称，避免重复信息。
  const friendlyName = resource.title || resource.name;
  const showName = friendlyName && friendlyName !== resource.uri;

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      {/* 资源元信息 */}
      <box style={{ flexDirection: "column" }}>
        <box>
          <box style={{ width: LABEL_WIDTH }}>
            <text color={theme.text.primary}>{t('URI:')}</text>
          </box>
          <box>
            <text wrap="wrap">{resource.uri}</text>
          </box>
        </box>

        {showName && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Name:')}</text>
            </box>
            <box>
              <text wrap="wrap">{friendlyName}</text>
            </box>
          </box>
        )}

        {resource.mimeType && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('MIME Type:')}</text>
            </box>
            <box>
              <text wrap="truncate">{resource.mimeType}</text>
            </box>
          </box>
        )}

        {typeof resource.size === 'number' && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Size:')}</text>
            </box>
            <box>
              <text>
                {t('{{count}} bytes', { count: String(resource.size) })}
              </text>
            </box>
          </box>
        )}
      </box>

      {/* 资源描述 */}
      {resource.description && (
        <box style={{ flexDirection: "column" }}>
          <text color={theme.text.primary} bold>
            {t('Description')}:
          </text>
          <text wrap="wrap">{resource.description}</text>
        </box>
      )}

      {/* 如何引用：告诉用户在对话里输入 @server:uri 即可注入内容 */}
      <box style={{ flexDirection: "column" }}>
        <text color={theme.text.primary} bold>
          {t('Reference in chat')}:
        </text>
        <text color={theme.text.accent}>
          @{buildMcpResourceRef(resource.serverName, resource.uri)}
        </text>
      </box>
    </box>
  );
};
