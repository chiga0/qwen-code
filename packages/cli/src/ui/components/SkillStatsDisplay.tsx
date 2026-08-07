/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { SkillCallStats } from '@qwen-code/qwen-code-core';
import { t } from '../../i18n/index.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import { theme } from '../semantic-colors.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
} from '../utils/displayUtils.js';

const SKILL_NAME_COL_WIDTH = 30;
const CALLS_COL_WIDTH = 8;
const SUCCESS_COL_WIDTH = 8;
const FAIL_COL_WIDTH = 8;
const SUCCESS_RATE_COL_WIDTH = 15;

const StatRow: React.FC<{
  name: string;
  stats: SkillCallStats;
}> = ({ name, stats }) => {
  const successRate = stats.count > 0 ? (stats.success / stats.count) * 100 : 0;
  const successColor = getStatusColor(successRate, {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  });

  return (
    <box>
      <box style={{ width: SKILL_NAME_COL_WIDTH }}>
        <text color={theme.text.link}>{name}</text>
      </box>
      <box style={{ width: CALLS_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={theme.text.primary}>{stats.count}</text>
      </box>
      <box style={{ width: SUCCESS_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={theme.status.success}>{stats.success}</text>
      </box>
      <box style={{ width: FAIL_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={stats.fail > 0 ? theme.status.error : theme.text.primary}>
          {stats.fail}
        </text>
      </box>
      <box style={{ width: SUCCESS_RATE_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={successColor}>{successRate.toFixed(1)}%</text>
      </box>
    </box>
  );
};

interface SkillStatsDisplayProps {
  width?: number;
}

export const SkillStatsDisplay: React.FC<SkillStatsDisplayProps> = ({
  width,
}) => {
  const { stats } = useSessionStats();
  const skills = stats.metrics.skills ?? {
    totalCalls: 0,
    totalSuccess: 0,
    totalFail: 0,
    byName: {},
  };
  const activeSkills = Object.entries(skills.byName)
    .filter(([, metrics]) => metrics.count > 0)
    .sort(([leftName, left], [rightName, right]) => {
      const countDelta = right.count - left.count;
      return countDelta !== 0 ? countDelta : leftName.localeCompare(rightName);
    });

  if (activeSkills.length === 0) {
    return (
      <box style={{ borderStyle: "round", borderColor: theme.border.default, width: width }} paddingY={1} paddingX={2}>
        <text color={theme.text.primary}>
          {t('No skill calls have been made in this session.')}
        </text>
      </box>
    );
  }

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", width: width }} paddingY={1} paddingX={2}>
      <text bold color={theme.text.accent}>
        {t('Skill Stats For Nerds')}
      </text>
      <box style={{ height: 1 }} />

      <box>
        <box style={{ width: SKILL_NAME_COL_WIDTH }}>
          <text bold color={theme.text.primary}>
            {t('Skill Name')}
          </text>
        </box>
        <box style={{ width: CALLS_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Calls')}
          </text>
        </box>
        <box style={{ width: SUCCESS_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('OK')}
          </text>
        </box>
        <box style={{ width: FAIL_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Fail')}
          </text>
        </box>
        <box style={{ width: SUCCESS_RATE_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Success Rate')}
          </text>
        </box>
      </box>

      <box style={{ borderStyle: "single", borderColor: theme.border.default, width: "100%" }} borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} />

      {activeSkills.map(([name, skillStats]) => (
        <StatRow key={name} name={name} stats={skillStats} />
      ))}
    </box>
  );
};
