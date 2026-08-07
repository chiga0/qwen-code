/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type React from 'react';
import { TrustLevel } from '../../config/trustedFolders.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { useTrustModify } from '../hooks/useTrustModify.js';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { relaunchApp } from '../../utils/processUtils.js';
import { type UseHistoryManagerReturn } from '../hooks/useHistoryManager.js';

interface TrustDialogProps {
  onExit: () => void;
  addItem: UseHistoryManagerReturn['addItem'];
}

const TRUST_LEVEL_ITEMS = [
  {
    label: 'Trust this folder',
    value: TrustLevel.TRUST_FOLDER,
    key: TrustLevel.TRUST_FOLDER,
  },
  {
    label: 'Trust parent folder',
    value: TrustLevel.TRUST_PARENT,
    key: TrustLevel.TRUST_PARENT,
  },
  {
    label: "Don't trust",
    value: TrustLevel.DO_NOT_TRUST,
    key: TrustLevel.DO_NOT_TRUST,
  },
];

export function TrustDialog({
  onExit,
  addItem,
}: TrustDialogProps): React.JSX.Element {
  const {
    cwd,
    currentTrustLevel,
    isInheritedTrustFromParent,
    isInheritedTrustFromIde,
    needsRestart,
    updateTrustLevel,
    commitTrustLevelChange,
  } = useTrustModify(onExit, addItem);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      }
      if (needsRestart && key.name === 'r') {
        if (commitTrustLevelChange()) {
          relaunchApp();
          onExit();
        }
      }
    },
    { isActive: true },
  );

  const index = TRUST_LEVEL_ITEMS.findIndex(
    (item) => item.value === currentTrustLevel,
  );
  const initialIndex = index === -1 ? 0 : index;

  return (
    <>
      <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1 }}>
        <box style={{ flexDirection: "column" }} paddingBottom={1}>
          <text bold>{'> '}Modify Trust Level</text>
          <box marginTop={1} />
          <text>Folder: {cwd}</text>
          <text>
            Current Level: <text bold>{currentTrustLevel || 'Not Set'}</text>
          </text>
          {isInheritedTrustFromParent && (
            <text color={theme.text.secondary}>
              Note: This folder behaves as a trusted folder because one of the
              parent folders is trusted. It will remain trusted even if you set
              a different trust level here. To change this, you need to modify
              the trust setting in the parent folder.
            </text>
          )}
          {isInheritedTrustFromIde && (
            <text color={theme.text.secondary}>
              Note: This folder behaves as a trusted folder because the
              connected IDE workspace is trusted. It will remain trusted even if
              you set a different trust level here.
            </text>
          )}
        </box>

        <RadioButtonSelect
          items={TRUST_LEVEL_ITEMS}
          onSelect={updateTrustLevel}
          isFocused={true}
          initialIndex={initialIndex}
        />
        <box marginTop={1}>
          <text color={theme.text.secondary}>(Use Enter to select)</text>
        </box>
      </box>
      {needsRestart && (
        <box marginLeft={1} marginTop={1}>
          <text color={theme.status.warning}>
            To apply the trust changes, Qwen Code must be restarted. Press
            &apos;r&apos; to restart CLI now.
          </text>
        </box>
      )}
    </>
  );
}
