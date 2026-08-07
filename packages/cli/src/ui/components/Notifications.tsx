/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useAppContext } from '../contexts/AppContext.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { theme } from '../semantic-colors.js';
import { StreamingState } from '../types.js';

export const Notifications = () => {
  const { startupWarnings } = useAppContext();
  const { initError, streamingState } = useUIState();

  const showStartupWarnings = startupWarnings.length > 0;
  const showInitError =
    initError && streamingState !== StreamingState.Responding;

  return (
    <>
      {showStartupWarnings && (
        <box style={{ borderStyle: "round", borderColor: theme.status.warning, flexDirection: "column" }} paddingX={1} marginY={1}>
          {startupWarnings.map((warning, index) => (
            <text key={index} color={theme.status.warning}>
              {warning}
            </text>
          ))}
        </box>
      )}
      {showInitError && (
        <box style={{ borderStyle: "round", borderColor: theme.status.error }} paddingX={1} marginBottom={1}>
          <text color={theme.status.error}>
            Initialization Error: {initError}
          </text>
          <text color={theme.status.error}>
            {' '}
            Please check API key and configuration.
          </text>
        </box>
      )}
    </>
  );
};
