/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useUIState } from '../contexts/UIStateContext.js';
import { theme } from '../semantic-colors.js';

export const ExitWarning: React.FC = () => {
  const uiState = useUIState();
  return (
    <>
      {uiState.dialogsVisible && uiState.ctrlCPressedOnce && (
        <box marginTop={1}>
          <text color={theme.status.warning}>Press Ctrl+C again to exit.</text>
        </box>
      )}

      {uiState.dialogsVisible && uiState.ctrlDPressedOnce && (
        <box marginTop={1}>
          <text color={theme.status.warning}>Press Ctrl+D again to exit.</text>
        </box>
      )}
    </>
  );
};
