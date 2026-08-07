/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { RadioButtonSelect } from '../../shared/RadioButtonSelect.js';
import { t } from '../../../../i18n/index.js';
import { MCPServerStatus } from '@qwen-code/qwen-code-core';
import type { ServerDetailStepProps } from '../types.js';
import {
  getStatusColor,
  getStatusIcon,
  formatServerCommand,
} from '../utils.js';

// 标签列宽度
const LABEL_WIDTH = 15;

type ServerAction =
  | 'view-tools'
  | 'view-resources'
  | 'approve'
  | 'reconnect'
  | 'toggle-disable'
  | 'authenticate'
  | 'clear-auth';

export const ServerDetailStep: React.FC<ServerDetailStepProps> = ({
  server,
  onViewTools,
  onViewResources,
  onApprove,
  onReconnect,
  onDisable,
  onAuthenticate,
  onClearAuth,
  onBack,
  isActive = true,
}) => {
  // 受门控（#4615）但未审批的 server 被 discovery 跳过，不会进入连接/认证流程，
  // 审批原因优先展示。
  const awaitingApproval =
    !!server && !server.isDisabled && !!server.approvalState;
  // 未连接且需要认证时，状态以"需要认证"展示，避免误导用户去排查连接问题。
  // requiresAuth 是加载时的快照，状态被实时推到 connected 后不再适用。
  const needsAuth =
    !!server &&
    !server.isDisabled &&
    !awaitingApproval &&
    !!server.requiresAuth &&
    server.status !== MCPServerStatus.CONNECTED;
  const statusColor = server
    ? server.isDisabled || awaitingApproval || needsAuth
      ? 'yellow'
      : getStatusColor(server.status)
    : 'gray';

  // 根据服务器状态动态生成可用操作
  const actions = useMemo(() => {
    const result: Array<{
      key: string;
      label: string;
      value: ServerAction;
    }> = [];

    if (!server) {
      return result;
    }

    // 只在服务器未禁用且有工具时显示"查看工具"选项
    if (!server.isDisabled && (server.toolCount ?? 0) > 0) {
      result.push({
        key: 'view-tools',
        label: t('View tools'),
        value: 'view-tools',
      });
    }

    // 只在调用方接入了 onViewResources 回调、且服务器未禁用并有资源时显示
    // "查看资源"。onViewResources 是可选 prop：像扩展管理器（McpServerActionsView）
    // 这类同样复用 ServerDetailStep 的调用方，若未接入资源子视图就不应出现一个
    // 点了没反应的死操作。
    if (
      onViewResources &&
      !server.isDisabled &&
      (server.resourceCount ?? 0) > 0
    ) {
      result.push({
        key: 'view-resources',
        label: t('View resources'),
        value: 'view-resources',
      });
    }

    // 只在服务器未禁用且已断开连接时显示"重新连接"选项。受门控但未审批的 server
    // 被 discovery 跳过，重连无法推进（仍是 pending/rejected），故隐藏以与状态文案一致。
    if (
      !server.isDisabled &&
      !awaitingApproval &&
      server.status === 'disconnected'
    ) {
      result.push({
        key: 'reconnect',
        label: t('Reconnect'),
        value: 'reconnect',
      });
    }

    // 受门控但未审批的 server 显示"审批"按钮，让用户可以在 /mcp 中直接审批
    // 而不必等待启动时的弹窗。
    if (awaitingApproval && onApprove) {
      result.push({
        key: 'approve',
        label: t('Approve'),
        value: 'approve',
      });
    }

    // 始终显示启用/禁用选项（扩展提供的服务器走扩展级禁用记录）
    result.push({
      key: 'toggle-disable',
      label: server.isDisabled ? t('Enable') : t('Disable'),
      value: 'toggle-disable',
    });

    // 已认证的服务器显示"重新认证"，未认证的显示"认证"。审批未通过时认证同样无法推进，隐藏。
    if (!server.isDisabled && !awaitingApproval) {
      result.push({
        key: 'authenticate',
        label: server.hasOAuthTokens ? t('Re-authenticate') : t('Authenticate'),
        value: 'authenticate',
      });
    }

    // 只在存储有 OAuth 认证信息时显示“清空认证”选项
    if (!server.isDisabled && server.hasOAuthTokens) {
      result.push({
        key: 'clear-auth',
        label: t('Clear Authentication'),
        value: 'clear-auth',
      });
    }

    return result;
  }, [server, onViewResources, onApprove, awaitingApproval]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onBack();
      }
    },
    { isActive },
  );

  if (!server) {
    return (
      <box>
        <text color={theme.status.error}>{t('No server selected')}</text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      {/* 服务器详情 */}
      <box style={{ flexDirection: "column" }}>
        <box>
          <box style={{ width: LABEL_WIDTH }}>
            <text color={theme.text.primary}>{t('Status:')}</text>
          </box>
          <box>
            <text
              color={
                statusColor === 'green'
                  ? theme.status.success
                  : statusColor === 'yellow'
                    ? theme.status.warning
                    : theme.status.error
              }
            >
              {getStatusIcon(server.status)}{' '}
              {server.isDisabled
                ? t('disabled')
                : awaitingApproval
                  ? server.approvalState === 'rejected'
                    ? t('rejected — edit config to re-approve')
                    : t('needs approval')
                  : needsAuth
                    ? t('needs authentication')
                    : t(server.status)}
            </text>
          </box>
        </box>

        <box>
          <box style={{ width: LABEL_WIDTH }}>
            <text color={theme.text.primary}>{t('Source:')}</text>
          </box>
          <box>
            <text color={theme.text.primary}>
              {server.source === 'user'
                ? t('User Settings')
                : server.source === 'project'
                  ? '.mcp.json'
                  : server.source === 'workspace'
                    ? t('Workspace Settings')
                    : server.source === 'system'
                      ? t('System Settings')
                      : t('Extension')}
            </text>
          </box>
        </box>

        <box>
          <box style={{ width: LABEL_WIDTH }}>
            <text color={theme.text.primary}>{t('Command:')}</text>
          </box>
          <box>
            <text wrap="truncate">{formatServerCommand(server)}</text>
          </box>
        </box>

        {server.config.cwd && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Working Directory:')}</text>
            </box>
            <box>
              <text wrap="truncate">{server.config.cwd}</text>
            </box>
          </box>
        )}

        {!server.isDisabled && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Tools:')}</text>
            </box>
            <box>
              <text>
                {server.toolCount}{' '}
                {server.toolCount === 1 ? t('tool') : t('tools')}
                {!!server.invalidToolCount && server.invalidToolCount > 0 && (
                  <text color={theme.status.warning}>
                    {' '}
                    ({server.invalidToolCount}{' '}
                    {server.invalidToolCount === 1
                      ? t('invalid')
                      : t('invalid')}
                    )
                  </text>
                )}
              </text>
            </box>
          </box>
        )}

        {!server.isDisabled && server.promptCount > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Prompts:')}</text>
            </box>
            <box>
              <text>{server.promptCount}</text>
            </box>
          </box>
        )}

        {!server.isDisabled && server.resourceCount > 0 && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.text.primary}>{t('Resources:')}</text>
            </box>
            <box>
              <text>{server.resourceCount}</text>
            </box>
          </box>
        )}

        {server.errorMessage && (
          <box>
            <box style={{ width: LABEL_WIDTH }}>
              <text color={theme.status.error}>{t('Error:')}</text>
            </box>
            <box>
              <text color={theme.status.error} wrap="wrap">
                {server.errorMessage}
              </text>
            </box>
          </box>
        )}
      </box>

      {/* 操作列表 */}
      <box>
        <RadioButtonSelect<ServerAction>
          items={actions}
          isFocused={isActive}
          showNumbers={false}
          onSelect={(value: ServerAction) => {
            switch (value) {
              case 'view-tools':
                onViewTools();
                break;
              case 'view-resources':
                onViewResources?.();
                break;
              case 'approve':
                onApprove?.();
                break;
              case 'reconnect':
                onReconnect?.();
                break;
              case 'toggle-disable':
                onDisable?.();
                break;
              case 'authenticate':
                onAuthenticate?.();
                break;
              case 'clear-auth':
                onClearAuth?.();
                break;
              default:
                break;
            }
          }}
        />
      </box>
    </box>
  );
};
