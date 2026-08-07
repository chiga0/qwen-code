/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import type { HookConfigDisplayInfo, HookEventDisplayInfo } from './types.js';
import { HooksConfigSource } from '@qwen-code/qwen-code-core';
import { t } from '../../../i18n/index.js';
import {
  getTranslatedSourceDisplayMap,
  supportsMatchers,
} from './constants.js';

interface HookConfigDetailStepProps {
  hookEvent: HookEventDisplayInfo;
  hookConfig: HookConfigDisplayInfo;
}

export function HookConfigDetailStep({
  hookEvent,
  hookConfig,
}: HookConfigDetailStepProps): React.JSX.Element {
  const { columns: terminalWidth } = useTerminalSize();

  const sourceDisplay = getTranslatedSourceDisplayMap()[hookConfig.source];

  const isFromExtension = hookConfig.source === HooksConfigSource.Extensions;

  const getHookTypeDisplay = (): string => {
    switch (hookConfig.config.type) {
      case 'command':
        return 'command';
      default:
        return hookConfig.config.type;
    }
  };

  const getCommand = (): string => {
    if (hookConfig.config.type === 'command') {
      return hookConfig.config.command;
    }
    return '';
  };

  const getPrompt = (): string => {
    if (hookConfig.config.type === 'prompt') {
      return hookConfig.config.prompt;
    }
    return '';
  };

  const getUrl = (): string => {
    if (hookConfig.config.type === 'http') {
      return hookConfig.config.url;
    }
    return '';
  };

  const commandBoxWidth = Math.min(terminalWidth - 6, 80);

  const labelWidth = 12;
  const showMatcher = supportsMatchers(hookEvent.event);

  return (
    <box style={{ flexDirection: "column" }} paddingX={1}>
      <box marginBottom={1}>
        <text bold color={theme.text.primary}>
          {t('Hook details')}
        </text>
      </box>

      <box>
        <box style={{ width: labelWidth }}>
          <text color={theme.text.secondary}>{t('Event:')}</text>
        </box>
        <text color={theme.text.primary}>{hookEvent.event}</text>
      </box>

      {showMatcher && (
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Matcher:')}</text>
          </box>
          <text color={theme.text.primary}>{hookConfig.matcher || '*'}</text>
        </box>
      )}

      <box>
        <box style={{ width: labelWidth }}>
          <text color={theme.text.secondary}>{t('Type:')}</text>
        </box>
        <text color={theme.text.primary}>{getHookTypeDisplay()}</text>
      </box>

      <box>
        <box style={{ width: labelWidth }}>
          <text color={theme.text.secondary}>{t('Source:')}</text>
        </box>
        <text color={theme.text.primary}>{sourceDisplay}</text>
        {hookConfig.sourcePath && (
          <text color={theme.text.secondary}> ({hookConfig.sourcePath})</text>
        )}
      </box>

      {isFromExtension && hookConfig.sourceDisplay && (
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Extension:')}</text>
          </box>
          <text color={theme.text.primary}>{hookConfig.sourceDisplay}</text>
        </box>
      )}

      {hookConfig.config.name && (
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Name:')}</text>
          </box>
          <text color={theme.text.primary}>{hookConfig.config.name}</text>
        </box>
      )}

      {hookConfig.config.description && (
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Desc:')}</text>
          </box>
          <text color={theme.text.primary}>
            {hookConfig.config.description}
          </text>
        </box>
      )}

      {hookConfig.config.type === 'command' && (
        <>
          <box marginTop={1}>
            <text color={theme.text.secondary}>{t('Command:')}</text>
          </box>
          <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: commandBoxWidth }} paddingX={1}>
            <text color={theme.text.primary}>{getCommand()}</text>
          </box>
        </>
      )}

      {hookConfig.config.type === 'prompt' && (
        <>
          <box marginTop={1}>
            <text color={theme.text.secondary}>{t('Prompt:')}</text>
          </box>
          <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: commandBoxWidth }} paddingX={1}>
            <text color={theme.text.primary}>{getPrompt()}</text>
          </box>
        </>
      )}

      {hookConfig.config.type === 'http' && (
        <>
          <box marginTop={1}>
            <text color={theme.text.secondary}>{t('URL:')}</text>
          </box>
          <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: commandBoxWidth }} paddingX={1}>
            <text color={theme.text.primary}>{getUrl()}</text>
          </box>
        </>
      )}

      <box marginTop={1}>
        <text color={theme.text.secondary}>
          {t(
            'To modify or remove this hook, edit settings.json directly or ask Qwen to help.',
          )}
        </text>
      </box>

      <box marginTop={1}>
        <text color={theme.text.secondary}>{t('Esc to go back')}</text>
      </box>
    </box>
  );
}
