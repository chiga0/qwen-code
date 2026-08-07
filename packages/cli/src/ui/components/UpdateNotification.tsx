/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';

interface UpdateNotificationProps {
  message: string;
}

export const UpdateNotification = ({ message }: UpdateNotificationProps) => (
  <box style={{ borderStyle: "round", borderColor: theme.status.warning }} paddingX={1} marginY={1}>
    <text color={theme.status.warning}>{message}</text>
  </box>
);
