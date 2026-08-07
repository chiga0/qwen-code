/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { SkillLevel } from '@qwen-code/qwen-code-core';
import { type SkillDefinition } from '../../types.js';
import { t } from '../../../i18n/index.js';
import { levelLabel } from '../../utils/skill-level-label.js';

const NAME_COLUMN = 24;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

interface SkillsListProps {
  skills: readonly SkillDefinition[];
}

export const SkillsList: React.FC<SkillsListProps> = ({ skills }) => (
  <box style={{ flexDirection: "column" }} marginBottom={1}>
    <text bold color={theme.text.primary}>
      {t('Available skills:')}
    </text>
    <box style={{ height: 1 }} />
    {skills.length > 0 ? (
      skills.map((skill) => (
        <box key={skill.name} style={{ flexDirection: "row" }}>
          <text color={theme.text.primary}>{'  '}- </text>
          <text bold color={theme.text.accent}>
            {skill.description
              ? truncate(skill.name, NAME_COLUMN).padEnd(NAME_COLUMN)
              : skill.name}
          </text>
          {skill.description && (
            <text color={theme.text.secondary}>
              {' '}
              {truncate(skill.description, 80)}
            </text>
          )}
          {skill.level && (
            <text color={theme.text.secondary}>
              {'  '}({levelLabel(skill.level as SkillLevel)})
            </text>
          )}
        </box>
      ))
    ) : (
      <text color={theme.text.primary}> {t('No skills available')}</text>
    )}
  </box>
);
