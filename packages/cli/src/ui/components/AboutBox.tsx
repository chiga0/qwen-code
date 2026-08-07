/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { ExtendedSystemInfo } from '../../utils/systemInfo.js';
import { getSystemInfoFields } from '../../utils/systemInfoFields.js';
import { t } from '../../i18n/index.js';

type AboutBoxProps = ExtendedSystemInfo & {
  width?: number;
};

export const AboutBox: React.FC<AboutBoxProps> = ({ width, ...props }) => {
  const fields = getSystemInfoFields(props);

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: width }}>
      <box marginBottom={1}>
        <text bold color={theme.text.accent}>
          {t('Status')}
        </text>
      </box>
      {fields.map((field) => (
        <box key={field.label} style={{ flexDirection: "row" }} marginTop={field.label === t('Auth') ? 1 : 0}>
          <box style={{ width: "35%" }}>
            <text bold color={theme.text.link}>
              {field.label}
            </text>
          </box>
          <box>
            <text color={theme.text.primary}>{field.value}</text>
          </box>
        </box>
      ))}
    </box>
  );
};
