/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { formatDuration } from '../utils/formatters.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
} from '../utils/displayUtils.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import type { ToolCallStats } from '@qwen-code/qwen-code-core';
import { t } from '../../i18n/index.js';

const TOOL_NAME_COL_WIDTH = 25;
const CALLS_COL_WIDTH = 8;
const SUCCESS_RATE_COL_WIDTH = 15;
const AVG_DURATION_COL_WIDTH = 15;

const StatRow: React.FC<{
  name: string;
  stats: ToolCallStats;
}> = ({ name, stats }) => {
  const successRate = stats.count > 0 ? (stats.success / stats.count) * 100 : 0;
  const avgDuration = stats.count > 0 ? stats.durationMs / stats.count : 0;
  const successColor = getStatusColor(successRate, {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  });

  return (
    <box>
      <box style={{ width: TOOL_NAME_COL_WIDTH }}>
        <text color={theme.text.link}>{name}</text>
      </box>
      <box style={{ width: CALLS_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={theme.text.primary}>{stats.count}</text>
      </box>
      <box style={{ width: SUCCESS_RATE_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={successColor}>{successRate.toFixed(1)}%</text>
      </box>
      <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
        <text color={theme.text.primary}>{formatDuration(avgDuration)}</text>
      </box>
    </box>
  );
};

interface ToolStatsDisplayProps {
  width?: number;
}

export const ToolStatsDisplay: React.FC<ToolStatsDisplayProps> = ({
  width,
}) => {
  const { stats } = useSessionStats();
  const { tools } = stats.metrics;
  const activeTools = Object.entries(tools.byName).filter(
    ([, metrics]) => metrics.count > 0,
  );

  if (activeTools.length === 0) {
    return (
      <box style={{ borderStyle: "round", borderColor: theme.border.default, width: width }} paddingY={1} paddingX={2}>
        <text color={theme.text.primary}>
          {t('No tool calls have been made in this session.')}
        </text>
      </box>
    );
  }

  const totalDecisions = Object.values(tools.byName).reduce(
    (acc, tool) => {
      acc.accept += tool.decisions.accept;
      acc.reject += tool.decisions.reject;
      acc.modify += tool.decisions.modify;
      return acc;
    },
    { accept: 0, reject: 0, modify: 0 },
  );

  const totalReviewed =
    totalDecisions.accept + totalDecisions.reject + totalDecisions.modify;
  const agreementRate =
    totalReviewed > 0 ? (totalDecisions.accept / totalReviewed) * 100 : 0;
  const agreementColor = getStatusColor(agreementRate, {
    green: USER_AGREEMENT_RATE_HIGH,
    yellow: USER_AGREEMENT_RATE_MEDIUM,
  });

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", width: width }} paddingY={1} paddingX={2}>
      <text bold color={theme.text.accent}>
        {t('Tool Stats For Nerds')}
      </text>
      <box style={{ height: 1 }} />

      {/* Header */}
      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH }}>
          <text bold color={theme.text.primary}>
            {t('Tool Name')}
          </text>
        </box>
        <box style={{ width: CALLS_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Calls')}
          </text>
        </box>
        <box style={{ width: SUCCESS_RATE_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Success Rate')}
          </text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Avg Duration')}
          </text>
        </box>
      </box>

      {/* Divider */}
      <box style={{ borderStyle: "single", borderColor: theme.border.default, width: "100%" }} borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} />

      {/* Tool Rows */}
      {activeTools.map(([name, stats]) => (
        <StatRow key={name} name={name} stats={stats as ToolCallStats} />
      ))}

      <box style={{ height: 1 }} />

      {/* User Decision Summary */}
      <text bold color={theme.text.primary}>
        {t('User Decision Summary')}
      </text>
      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH + CALLS_COL_WIDTH + SUCCESS_RATE_COL_WIDTH }}>
          <text color={theme.text.link}>
            {t('Total Reviewed Suggestions:')}
          </text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text color={theme.text.primary}>{totalReviewed}</text>
        </box>
      </box>
      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH + CALLS_COL_WIDTH + SUCCESS_RATE_COL_WIDTH }}>
          <text color={theme.text.primary}>{t(' » Accepted:')}</text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text color={theme.status.success}>{totalDecisions.accept}</text>
        </box>
      </box>
      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH + CALLS_COL_WIDTH + SUCCESS_RATE_COL_WIDTH }}>
          <text color={theme.text.primary}>{t(' » Rejected:')}</text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text color={theme.status.error}>{totalDecisions.reject}</text>
        </box>
      </box>
      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH + CALLS_COL_WIDTH + SUCCESS_RATE_COL_WIDTH }}>
          <text color={theme.text.primary}>{t(' » Modified:')}</text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text color={theme.status.warning}>{totalDecisions.modify}</text>
        </box>
      </box>

      {/* Divider */}
      <box style={{ borderStyle: "single", borderColor: theme.border.default, width: "100%" }} borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} />

      <box>
        <box style={{ width: TOOL_NAME_COL_WIDTH + CALLS_COL_WIDTH + SUCCESS_RATE_COL_WIDTH }}>
          <text color={theme.text.primary}>
            {t(' Overall Agreement Rate:')}
          </text>
        </box>
        <box style={{ width: AVG_DURATION_COL_WIDTH, justifyContent: "flex-end" }}>
          <text bold color={totalReviewed > 0 ? agreementColor : undefined}>
            {totalReviewed > 0 ? `${agreementRate.toFixed(1)}%` : '--'}
          </text>
        </box>
      </box>
    </box>
  );
};
