/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import {
  buildBrailleLineChart,
  MONTH_LABELS,
  type LineChartPoint,
} from '../utils/asciiCharts.js';
import { fmtTokens, fmtDurationShort, TableRow } from './stats-helpers.js';
import { HeatmapView } from './StatsHeatmapView.js';
import type { StatsData } from '../utils/statsDataService.js';
import type { TimeRange } from '@qwen-code/qwen-code-core';
import { t } from '../../i18n/index.js';

export const ActivityTab: React.FC<{
  data: StatsData;
  bodyWidth: number;
  chartMonthOffset: number;
  range: TimeRange;
}> = ({ data, bodyWidth, chartMonthOffset, range }) => {
  const heatmapWeeks = Math.min(
    26,
    Math.max(8, Math.floor((bodyWidth - 4) / 2)),
  );
  const col1Width = Math.floor(bodyWidth / 3);

  let totalTokens = 0;
  for (const m of Object.values(data.report.models)) {
    totalTokens += m.totalTokens;
  }

  const dailyTotals = new Map<string, number>();
  for (const d of data.tokensPerDay) {
    dailyTotals.set(d.date, (dailyTotals.get(d.date) || 0) + d.tokens);
  }
  const allDates = [...dailyTotals.keys()].sort();
  const availableMonths = [...new Set(allDates.map((d) => d.slice(0, 7)))]
    .sort()
    .reverse();
  const clampedOffset = Math.min(
    chartMonthOffset,
    Math.max(0, availableMonths.length - 1),
  );
  const chartMonth =
    range === 'all' && availableMonths.length > 0
      ? availableMonths[clampedOffset]!
      : null;
  const chartMonthLabel = chartMonth
    ? `${MONTH_LABELS[Number(chartMonth.slice(5, 7)) - 1]} ${chartMonth.slice(0, 4)}`
    : null;
  const canGoLeft = clampedOffset < availableMonths.length - 1;
  const canGoRight = clampedOffset > 0;
  const filteredTokens = chartMonth
    ? data.tokensPerDay.filter((d) => d.date.startsWith(chartMonth))
    : data.tokensPerDay;

  const filteredDailyTotals = new Map<string, number>();
  for (const d of filteredTokens) {
    filteredDailyTotals.set(
      d.date,
      (filteredDailyTotals.get(d.date) || 0) + d.tokens,
    );
  }

  const lineData: LineChartPoint[] = [...filteredDailyTotals.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const lineChart = buildBrailleLineChart(lineData, bodyWidth - 8, 8);

  return (
    <box style={{ flexDirection: "column" }}>
      {/* KPI Row */}
      <box style={{ flexDirection: "row" }} marginBottom={1}>
        <box style={{ width: col1Width }}>
          <text color={theme.text.secondary}>{t('Sessions')} </text>
          <text bold color={theme.text.primary}>
            {data.report.sessionCount}
          </text>
          {data.delta?.sessions != null && (
            <text
              color={
                data.delta.sessions >= 0
                  ? theme.status.success
                  : theme.status.error
              }
            >
              {' '}
              {data.delta.sessions >= 0 ? '\u25B2' : '\u25BC'}
              {Math.abs(data.delta.sessions).toFixed(0)}%
            </text>
          )}
        </box>
        <box style={{ width: col1Width }}>
          <text color={theme.text.secondary}>{t('Duration')} </text>
          <text bold color={theme.text.primary}>
            {fmtDurationShort(data.report.totalDurationMs)}
          </text>
          {data.delta?.duration != null && (
            <text
              color={
                data.delta.duration >= 0
                  ? theme.status.success
                  : theme.status.error
              }
            >
              {' '}
              {data.delta.duration >= 0 ? '\u25B2' : '\u25BC'}
              {Math.abs(data.delta.duration).toFixed(0)}%
            </text>
          )}
        </box>
        <box>
          <text color={theme.text.secondary}>{t('Tokens')} </text>
          <text bold color={theme.status.warning}>
            {fmtTokens(totalTokens)}
          </text>
          {data.delta?.tokens != null && (
            <text
              color={
                data.delta.tokens >= 0
                  ? theme.status.success
                  : theme.status.error
              }
            >
              {' '}
              {data.delta.tokens >= 0 ? '\u25B2' : '\u25BC'}
              {Math.abs(data.delta.tokens).toFixed(0)}%
            </text>
          )}
        </box>
      </box>

      {/* Heatmap with streak */}
      <box style={{ flexDirection: "row" }}>
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          <HeatmapView
            data={data}
            weeks={heatmapWeeks}
            monthOffset={clampedOffset}
          />
        </box>
        <box marginLeft={2} style={{ flexDirection: "column" }}>
          <box>
            <text color={theme.text.secondary}>{t('streak')}: </text>
            <text color={theme.status.success} bold>
              {data.currentStreak}
              {t('d')}
            </text>
          </box>
          <box>
            <text color={theme.text.secondary}>{t('best')}: </text>
            <text color={theme.status.warning} bold>
              {data.longestStreak}
              {t('d')}
            </text>
          </box>
        </box>
      </box>

      {/* Token Trend Chart */}
      <box style={{ flexDirection: "column" }} marginTop={1}>
        <box>
          <text bold color={theme.text.primary}>
            {t('Token Trend')}
          </text>
          {chartMonthLabel && (
            <text color={theme.text.accent}>
              {'  '}
              {canGoLeft ? '\u2190 ' : '  '}
              {chartMonthLabel}
              {canGoRight ? ' \u2192' : ''}
            </text>
          )}
        </box>
        {lineChart ? (
          <box style={{ flexDirection: "column" }}>
            {lineChart.rows.map((row, ri) => (
              <box key={ri}>
                <text color={theme.text.secondary}>
                  {lineChart.yLabels[ri]?.padStart(6) ?? '      '}
                  {'\u2502'}
                </text>
                {row.map((cell, ci) => (
                  <text
                    key={ci}
                    color={
                      cell.filled ? theme.text.accent : theme.text.secondary
                    }
                  >
                    {cell.char}
                  </text>
                ))}
              </box>
            ))}
            <box>
              <text color={theme.text.secondary}>
                {'      \u2514'}
                {lineChart.xLabels}
              </text>
            </box>
            <box marginTop={0}>
              <text color={theme.text.secondary}>
                {'       '}peak {fmtTokens(lineChart.peak)}
              </text>
            </box>
          </box>
        ) : (
          <text color={theme.text.secondary}>
            {'  '}
            {t('(no data)')}
          </text>
        )}
      </box>

      {/* Project Ranking */}
      {data.report.projects.length > 0 && (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <text bold color={theme.text.primary}>
            {t('Projects')}
          </text>
          <TableRow
            cells={[
              {
                text: '  ' + t('Project'),
                width: 22,
                color: theme.text.secondary,
              },
              { text: t('Sessions'), width: 10, color: theme.text.secondary },
              { text: t('Tokens'), width: 10, color: theme.text.secondary },
              { text: t('Duration'), width: 10, color: theme.text.secondary },
            ]}
          />
          {data.report.projects.slice(0, 5).map((proj) => {
            const name = proj.path.split('/').pop() || proj.path;
            const tokens = proj.totalTokens;
            return (
              <TableRow
                key={proj.path}
                cells={[
                  {
                    text: '  ' + name.slice(0, 18),
                    width: 22,
                    color: theme.text.primary,
                  },
                  {
                    text: String(proj.sessionCount),
                    width: 10,
                    color: theme.text.primary,
                  },
                  {
                    text: fmtTokens(tokens),
                    width: 10,
                    color: theme.status.warning,
                  },
                  {
                    text: fmtDurationShort(proj.totalDurationMs),
                    width: 10,
                    color: theme.text.secondary,
                  },
                ]}
              />
            );
          })}
        </box>
      )}
    </box>
  );
};
