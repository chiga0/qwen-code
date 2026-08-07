/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text } from 'ink';
import { theme } from '../semantic-colors.js';

export const ShellModeIndicator: React.FC = () => (
  <text color={theme.ui.symbol}>
    shell mode enabled
    <text color={theme.text.secondary}> (esc to disable)</text>
  </text>
);
