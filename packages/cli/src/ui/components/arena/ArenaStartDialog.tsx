/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { AuthType } from '@qwen-code/qwen-code-core';
import { useConfig } from '../../contexts/ConfigContext.js';
import { theme } from '../../semantic-colors.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import { MultiSelect } from '../shared/MultiSelect.js';
import { t } from '../../../i18n/index.js';

interface ArenaStartDialogProps {
  onClose: () => void;
  onConfirm: (selectedModels: string[]) => void;
}

const MODEL_PROVIDERS_DOCUMENTATION_URL =
  'https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/#modelproviders';

export function ArenaStartDialog({
  onClose,
  onConfirm,
}: ArenaStartDialogProps): React.JSX.Element {
  const config = useConfig();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const modelItems = useMemo(() => {
    const allModels = config.getAllConfiguredModels();
    const selectableModels = allModels.filter(
      (model) => !model.isRuntimeModel && !model.imageOnly,
    );

    return selectableModels.map((model) => {
      const token = `${model.authType}:${model.id}`;
      const isQwenOauth = model.authType === AuthType.QWEN_OAUTH;
      return {
        key: token,
        value: token,
        label: `[${model.authType}] ${model.label}`,
        disabled: isQwenOauth,
      };
    });
  }, [config]);
  const hasDisabledQwenOauth = modelItems.some((item) => item.disabled);
  const selectableModelCount = modelItems.filter(
    (item) => !item.disabled,
  ).length;
  const needsMoreModels = selectableModelCount < 2;
  const shouldShowMoreModelsHint =
    selectableModelCount >= 2 && selectableModelCount < 3;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  const handleConfirm = (values: string[]) => {
    if (values.length < 2) {
      setErrorMessage(
        t('Please select at least 2 models to start an Arena session.'),
      );
      return;
    }

    setErrorMessage(null);
    onConfirm(values);
  };

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
      <text bold>{t('Select Models')}</text>

      {modelItems.length === 0 ? (
        <box marginTop={1} style={{ flexDirection: "column" }}>
          <text color={theme.status.warning}>
            {t('No models available. Please configure models first.')}
          </text>
        </box>
      ) : (
        <box marginTop={1}>
          <MultiSelect
            items={modelItems}
            initialIndex={0}
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            onConfirm={handleConfirm}
            showNumbers
            showScrollArrows
            maxItemsToShow={10}
          />
        </box>
      )}

      {errorMessage && (
        <box marginTop={1}>
          <text color={theme.status.error}>{errorMessage}</text>
        </box>
      )}

      {(hasDisabledQwenOauth || needsMoreModels) && (
        <box marginTop={1} style={{ flexDirection: "column" }}>
          {hasDisabledQwenOauth && (
            <text color={theme.status.warning}>
              {t('Note: qwen-oauth models are not supported in Arena.')}
            </text>
          )}
          {needsMoreModels && (
            <>
              <text color={theme.status.warning}>
                {t('Arena requires at least 2 models. To add more:')}
              </text>
              <text color={theme.status.warning}>
                {t(
                  '  - Run /auth to set up a Coding Plan (includes multiple models)',
                )}
              </text>
              <text color={theme.status.warning}>
                {t('  - Or configure modelProviders in settings.json')}
              </text>
            </>
          )}
        </box>
      )}

      {shouldShowMoreModelsHint && (
        <>
          <box marginTop={1}>
            <text color={theme.text.secondary}>
              {t('Configure more models with the modelProviders guide:')}
            </text>
          </box>
          <box marginTop={0}>
            <Link url={MODEL_PROVIDERS_DOCUMENTATION_URL} fallback={false}>
              <text color={theme.text.secondary} underline>
                {MODEL_PROVIDERS_DOCUMENTATION_URL}
              </text>
            </Link>
          </box>
        </>
      )}

      <box marginTop={1} style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>
          {t('Space to toggle, Enter to confirm, Esc to cancel')}
        </text>
      </box>
    </box>
  );
}
