/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { RadioButtonSelect } from '../../shared/RadioButtonSelect.js';
import {
  redactUrlCredentials,
  type Extension,
} from '@qwen-code/qwen-code-core';
import { t } from '../../../../i18n/index.js';
import { stripUnsafeCharacters } from '../../../utils/textUtils.js';

export type PluginDetailAction =
  | 'toggle'
  | 'favorite'
  | 'change-scope'
  | 'mark-update'
  | 'update'
  | 'uninstall';

interface PluginDetailViewProps {
  extension: Extension;
  scope: string;
  isFavorite: boolean;
  hasUpdateAvailable: boolean;
  isFocused: boolean;
  /** Whether to offer the favorite toggle (hidden in the Sources tab). */
  showFavorite?: boolean;
  onAction: (action: PluginDetailAction) => void;
}

const LABEL_WIDTH = 14;

const InfoRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <box>
    <box style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
      <text color={theme.text.primary}>{label}</text>
    </box>
    <box style={{ flexGrow: 1 }}>
      <text>{children}</text>
    </box>
  </box>
);

function componentSummary(ext: Extension): string {
  const parts: string[] = [];
  const mcpCount = ext.mcpServers ? Object.keys(ext.mcpServers).length : 0;
  if (mcpCount) parts.push(t('{{count}} MCP', { count: String(mcpCount) }));
  if (ext.skills?.length)
    parts.push(t('{{count}} Skills', { count: String(ext.skills.length) }));
  if (ext.commands?.length)
    parts.push(t('{{count}} Commands', { count: String(ext.commands.length) }));
  if (ext.agents?.length)
    parts.push(t('{{count}} Agents', { count: String(ext.agents.length) }));
  return parts.length ? parts.join(' · ') : t('None');
}

export const PluginDetailView = ({
  extension,
  scope,
  isFavorite,
  hasUpdateAvailable,
  isFocused,
  showFavorite = true,
  onAction,
}: PluginDetailViewProps) => {
  const ext = extension;
  const isActive = ext.isActive;

  const actions = useMemo(() => {
    const items: Array<{
      key: string;
      label: string;
      value: PluginDetailAction;
    }> = [
      {
        key: 'toggle',
        label: isActive ? t('Disable') : t('Enable'),
        value: 'toggle',
      },
      ...(showFavorite
        ? [
            {
              key: 'favorite',
              label: isFavorite
                ? t('Remove from Favorites')
                : t('Add to Favorites'),
              value: 'favorite' as const,
            },
          ]
        : []),
      {
        key: 'change-scope',
        label: t('Change scope'),
        value: 'change-scope',
      },
      {
        key: 'mark-update',
        label: t('Mark for Update'),
        value: 'mark-update',
      },
      ...(hasUpdateAvailable
        ? [{ key: 'update', label: t('Update Now'), value: 'update' as const }]
        : []),
      {
        key: 'uninstall',
        label: t('Uninstall'),
        value: 'uninstall',
      },
    ];
    return items;
  }, [isActive, isFavorite, hasUpdateAvailable, showFavorite]);

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column" }}>
        <InfoRow label={t('Name:')}>{ext.name}</InfoRow>
        <InfoRow label={t('Version:')}>
          {stripUnsafeCharacters(ext.version ?? '')}
        </InfoRow>
        <InfoRow label={t('Scope:')}>{scope}</InfoRow>
        <InfoRow label={t('Status:')}>
          <text color={isActive ? theme.status.success : theme.text.secondary}>
            {isActive ? t('active') : t('disabled')}
          </text>
          {isFavorite ? <text color={theme.status.warning}> ★</text> : null}
        </InfoRow>
        {ext.installMetadata && (
          <InfoRow label={t('Source:')}>
            {redactUrlCredentials(ext.installMetadata.source)}
          </InfoRow>
        )}
        <InfoRow label={t('Components:')}>{componentSummary(ext)}</InfoRow>
      </box>

      <box style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>{t('Actions')}</text>
        <RadioButtonSelect
          items={actions}
          isFocused={isFocused}
          showNumbers={false}
          onSelect={onAction}
        />
      </box>
    </box>
  );
};
