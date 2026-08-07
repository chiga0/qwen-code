/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useKeypress, type Key } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';
import type {
  ProviderUpdateEntry,
  UpdateChoice,
} from '../hooks/useProviderUpdates.js';

interface ProviderUpdatePromptProps {
  entries: ProviderUpdateEntry[];
  onConfirm: (choice: UpdateChoice) => void;
}

const ProviderDiffSection = ({ entry }: { entry: ProviderUpdateEntry }) => {
  const { providerLabel, diff } = entry;
  const hasModelChanges = diff.added.length > 0 || diff.removed.length > 0;

  return (
    <box style={{ flexDirection: "column" }}>
      <text bold color={theme.text.secondary}>
        {providerLabel}
      </text>
      {hasModelChanges ? (
        <box style={{ flexDirection: "column" }}>
          {diff.added.map((model) => (
            <text key={model} color={theme.status.success}>
              {'  + '}
              {model}
            </text>
          ))}
          {diff.removed.map((model) => (
            <text key={model} color={theme.status.error}>
              {'  - '}
              {model}
            </text>
          ))}
        </box>
      ) : (
        <text color={theme.text.secondary}>
          {'  '}
          {t('Model parameters updated (context window, capabilities, etc.)')}
        </text>
      )}
    </box>
  );
};

export const ProviderUpdatePrompt = ({
  entries,
  onConfirm,
}: ProviderUpdatePromptProps) => {
  const handleKeypress = useCallback(
    (key: Key) => {
      if (key.name === 'escape') {
        onConfirm('later');
      }
    },
    [onConfirm],
  );
  useKeypress(handleKeypress, { isActive: true });

  const affectedEntry = entries.find((e) => e.diff.currentModelAffected);

  const title =
    entries.length === 1
      ? t('Built-in Provider Update · {{provider}}', {
          provider: entries[0]!.providerLabel,
        })
      : t('Built-in Provider Updates');

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column" }} paddingY={1} paddingX={2}>
      <text bold>{title}</text>

      <box style={{ flexDirection: "column", gap: 1 }} marginTop={1}>
        {entries.map((entry) => (
          <ProviderDiffSection key={entry.providerLabel} entry={entry} />
        ))}
      </box>

      <box style={{ flexDirection: "column" }} marginTop={1}>
        {affectedEntry && (
          <text color={theme.status.warning}>
            {t(
              'Note: Your selected model is being removed. It will switch to "{{model}}" after update.',
              { model: affectedEntry.diff.fallbackModel ?? '' },
            )}
          </text>
        )}
        <text color={theme.text.secondary}>
          {t('Tips: Your credentials will not be modified.')}
        </text>
      </box>

      <box marginTop={1}>
        <RadioButtonSelect
          items={[
            {
              label: t('Update all'),
              value: 'update' as UpdateChoice,
              key: 'update',
            },
            {
              label: t('Skip this version'),
              value: 'skip' as UpdateChoice,
              key: 'skip',
            },
            {
              label: t('Remind me later (esc)'),
              value: 'later' as UpdateChoice,
              key: 'later',
            },
          ]}
          onSelect={onConfirm}
        />
      </box>
    </box>
  );
};
