/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { t } from '../../../i18n/index.js';

interface HooksDisabledStepProps {
  configuredHooksCount: number;
}

export function HooksDisabledStep({
  configuredHooksCount,
}: HooksDisabledStepProps): React.JSX.Element {
  // Note: The i18n t() function expects string parameters (Record<string, string>).
  // Pluralization is handled manually by selecting the appropriate translation key
  // based on the count, since the i18n system doesn't support ICU MessageFormat.
  const hooksText =
    configuredHooksCount === 1
      ? t('{{count}} configured hook', { count: String(configuredHooksCount) })
      : t('{{count}} configured hooks', {
          count: String(configuredHooksCount),
        });

  return (
    <box style={{ flexDirection: "column" }} paddingX={1}>
      {/* Title */}
      <box marginBottom={1}>
        <text bold color={theme.status.warning}>
          {t('Hook Configuration - Disabled')}
        </text>
      </box>

      {/* Main message */}
      <box marginBottom={1}>
        <text color={theme.text.primary}>
          {t(
            'All hooks are currently disabled. You have {{count}} that are not running.',
            {
              count: hooksText,
            },
          )}
        </text>
      </box>

      {/* Explanation */}
      <box style={{ flexDirection: "column" }} marginBottom={1}>
        <text bold color={theme.text.primary}>
          {t('When hooks are disabled:')}
        </text>
        {/* Note: Using middle dot (·) as bullet character. This is consistent with
            other CLI components. If a design system evolves, consider extracting
            to a shared constant or using a BulletList component. */}
        <box>
          <text color={theme.text.secondary}>
            {`  · ${t('No hook commands will execute')}`}
          </text>
        </box>
        <box>
          <text color={theme.text.secondary}>
            {`  · ${t('StatusLine will not be displayed')}`}
          </text>
        </box>
        <box>
          <text color={theme.text.secondary}>
            {`  · ${t('Tool operations will proceed without hook validation')}`}
          </text>
        </box>
      </box>

      {/* How to re-enable */}
      <box marginBottom={1}>
        <text color={theme.text.secondary}>
          {t(
            'To re-enable hooks, remove "disableAllHooks" from settings.json or ask Qwen Code.',
          )}
        </text>
      </box>

      {/* Footer hint */}
      <box marginTop={1}>
        <text color={theme.text.secondary}>{t('Esc to close')}</text>
      </box>
    </box>
  );
}
