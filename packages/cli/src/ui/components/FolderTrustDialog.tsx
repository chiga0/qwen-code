/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type React from 'react';
import { useEffect } from 'react';
import { theme } from '../semantic-colors.js';
import type { RadioSelectItem } from './shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import * as process from 'node:process';
import * as path from 'node:path';
import { relaunchApp } from '../../utils/processUtils.js';

export enum FolderTrustChoice {
  TRUST_FOLDER = 'trust_folder',
  TRUST_PARENT = 'trust_parent',
  DO_NOT_TRUST = 'do_not_trust',
}

interface FolderTrustDialogProps {
  onSelect: (choice: FolderTrustChoice) => void;
  isRestarting?: boolean;
}

export const FolderTrustDialog: React.FC<FolderTrustDialogProps> = ({
  onSelect,
  isRestarting,
}) => {
  useEffect(() => {
    const doRelaunch = async () => {
      if (isRestarting) {
        setTimeout(async () => {
          await relaunchApp();
        }, 250);
      }
    };
    doRelaunch();
  }, [isRestarting]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onSelect(FolderTrustChoice.DO_NOT_TRUST);
      }
    },
    { isActive: !isRestarting },
  );

  const dirName = path.basename(process.cwd());
  const parentFolder = path.basename(path.dirname(process.cwd()));

  const options: Array<RadioSelectItem<FolderTrustChoice>> = [
    {
      label: `Trust folder (${dirName})`,
      value: FolderTrustChoice.TRUST_FOLDER,
      key: `Trust folder (${dirName})`,
    },
    {
      label: `Trust parent folder (${parentFolder})`,
      value: FolderTrustChoice.TRUST_PARENT,
      key: `Trust parent folder (${parentFolder})`,
    },
    {
      label: "Don't trust (esc)",
      value: FolderTrustChoice.DO_NOT_TRUST,
      key: "Don't trust (esc)",
    },
  ];

  return (
    <box style={{ flexDirection: "column" }}>
      <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.status.warning, padding: 1, width: "100%" }} marginLeft={1}>
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text bold color={theme.text.primary}>
            Do you trust this folder?
          </text>
          <text color={theme.text.primary}>
            Trusting a folder allows Qwen Code to execute commands it suggests.
            This is a security feature to prevent accidental execution in
            untrusted directories.
          </text>
        </box>

        <RadioButtonSelect
          items={options}
          onSelect={onSelect}
          isFocused={!isRestarting}
        />
      </box>
      {isRestarting && (
        <box marginLeft={1} marginTop={1}>
          <text color={theme.status.warning}>
            Qwen Code is restarting to apply the trust changes...
          </text>
        </box>
      )}
    </box>
  );
};
