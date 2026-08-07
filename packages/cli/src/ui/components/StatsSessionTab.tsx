/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ICON } from '../constants.js';
import { fmtTokens, getSeriesColors } from './stats-helpers.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import { computeSessionStats } from '../utils/computeStats.js';
import { formatDuration } from '../utils/formatters.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
} from '../utils/displayUtils.js';
import { t } from '../../i18n/index.js';

export const SessionTab: React.FC = () => {
  const SERIES_COLORS = getSeriesColors();
  const { stats } = useSessionStats();
  const { metrics } = stats;
  const computed = computeSessionStats(metrics);
  const now = new Date();
  const wallDuration = stats.sessionStartTime
    ? now.getTime() - stats.sessionStartTime.getTime()
    : 0;

  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  for (const m of Object.values(metrics.models)) {
    totalInput += m.tokens.prompt;
    totalOutput += m.tokens.candidates;
    totalCached += m.tokens.cached;
  }
  const cacheRate = totalInput > 0 ? (totalCached / totalInput) * 100 : 0;
  const generation = metrics.generation;
  const lastGeneration = generation?.last;
  const lastTps =
    lastGeneration && lastGeneration.generationDurationMs > 0
      ? lastGeneration.outputTokens /
        (lastGeneration.generationDurationMs / 1000)
      : undefined;
  const averageTtft =
    generation && generation.timedRequests > 0
      ? generation.totalTtftMs / generation.timedRequests
      : undefined;
  const sessionTps =
    generation && generation.totalGenerationDurationMs > 0
      ? generation.totalThroughputOutputTokens /
        (generation.totalGenerationDurationMs / 1000)
      : undefined;

  const successColor = getStatusColor(computed.successRate, {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  });
  const agreementColor = getStatusColor(computed.agreementRate, {
    green: USER_AGREEMENT_RATE_HIGH,
    yellow: USER_AGREEMENT_RATE_MEDIUM,
  });

  const labelWidth = 28;

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Session ID */}
      <box>
        <box style={{ width: labelWidth }}>
          <text color={theme.text.secondary}>{t('Session ID:')}</text>
        </box>
        <text color={theme.text.primary}>{stats.sessionId}</text>
      </box>

      {/* Interaction Summary */}
      <box style={{ flexDirection: "column" }} marginTop={1}>
        <text bold color={theme.text.primary}>
          {t('Interaction Summary')}
        </text>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Tool Calls:')}</text>
          </box>
          <text color={theme.text.primary}>
            {metrics.tools.totalCalls} ({' '}
            <text color={theme.status.success}>
              ✓ {metrics.tools.totalSuccess}
            </text>{' '}
            <text color={theme.status.error}>✗ {metrics.tools.totalFail}</text>{' '}
            )
          </text>
        </box>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Success Rate:')}</text>
          </box>
          <text color={successColor}>{computed.successRate.toFixed(1)}%</text>
        </box>
        {computed.totalDecisions > 0 && (
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('User Agreement:')}</text>
            </box>
            <text color={agreementColor}>
              {computed.agreementRate.toFixed(1)}%{' '}
              <text color={theme.text.secondary}>
                ({computed.totalDecisions} {t('reviewed')})
              </text>
            </text>
          </box>
        )}
        {(metrics.files.totalLinesAdded > 0 ||
          metrics.files.totalLinesRemoved > 0) && (
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('Code Changes:')}</text>
            </box>
            <text color={theme.status.success}>
              +{metrics.files.totalLinesAdded}
            </text>
            <text color={theme.text.primary}> </text>
            <text color={theme.status.error}>
              -{metrics.files.totalLinesRemoved}
            </text>
          </box>
        )}
      </box>

      {/* Performance */}
      <box style={{ flexDirection: "column" }} marginTop={1}>
        <text bold color={theme.text.primary}>
          {t('Performance')}
        </text>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Wall Time:')}</text>
          </box>
          <text color={theme.text.primary}>{formatDuration(wallDuration)}</text>
        </box>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Agent Active:')}</text>
          </box>
          <text color={theme.text.primary}>
            {formatDuration(computed.agentActiveTime)}
          </text>
        </box>
        <box paddingLeft={2}>
          <box style={{ width: 26 }}>
            <text color={theme.text.secondary}>» {t('API Time:')}</text>
          </box>
          <text color={theme.text.primary}>
            {formatDuration(computed.totalApiTime)}{' '}
            <text color={theme.text.secondary}>
              ({computed.apiTimePercent.toFixed(1)}%)
            </text>
          </text>
        </box>
        <box paddingLeft={2}>
          <box style={{ width: 26 }}>
            <text color={theme.text.secondary}>» {t('Tool Time:')}</text>
          </box>
          <text color={theme.text.primary}>
            {formatDuration(computed.totalToolTime)}{' '}
            <text color={theme.text.secondary}>
              ({computed.toolTimePercent.toFixed(1)}%)
            </text>
          </text>
        </box>
      </box>

      {lastGeneration && (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <text bold color={theme.text.primary}>
            {t('Generation Metrics')} ({t('Latest Request')})
          </text>
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('Model')}:</text>
            </box>
            <text color={theme.text.primary}>{lastGeneration.model}</text>
          </box>
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>TTFT:</text>
            </box>
            <text color={theme.text.primary}>
              {formatDuration(lastGeneration.ttftMs)}
            </text>
          </box>
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('Generation Time')}:</text>
            </box>
            <text color={theme.text.primary}>
              {formatDuration(lastGeneration.generationDurationMs)}
            </text>
          </box>
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('Output Tokens')}:</text>
            </box>
            <text color={theme.text.primary}>
              {lastGeneration.outputTokens.toLocaleString()}
            </text>
          </box>
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>TPS:</text>
            </box>
            <text color={theme.text.primary}>
              {lastTps === undefined ? '—' : `${lastTps.toFixed(1)} tok/s`}
            </text>
          </box>
          <box paddingLeft={2}>
            <box style={{ width: 26 }}>
              <text color={theme.text.secondary}>» {t('Requests')}:</text>
            </box>
            <text color={theme.text.primary}>{generation.timedRequests}</text>
          </box>
          <box paddingLeft={2}>
            <box style={{ width: 26 }}>
              <text color={theme.text.secondary}>» {t('Average TTFT')}:</text>
            </box>
            <text color={theme.text.primary}>
              {averageTtft === undefined ? '—' : formatDuration(averageTtft)}
            </text>
          </box>
          <box paddingLeft={2}>
            <box style={{ width: 26 }}>
              <text color={theme.text.secondary}>» {t('Session TPS')}:</text>
            </box>
            <text color={theme.text.primary}>
              {sessionTps === undefined
                ? '—'
                : `${sessionTps.toFixed(1)} tok/s`}
            </text>
          </box>
        </box>
      )}

      {/* Token Summary */}
      <box style={{ flexDirection: "column" }} marginTop={1}>
        <text bold color={theme.text.primary}>
          {t('Tokens')}
        </text>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Input')}:</text>
          </box>
          <text color={theme.status.warning}>
            {totalInput.toLocaleString()}
          </text>
        </box>
        <box>
          <box style={{ width: labelWidth }}>
            <text color={theme.text.secondary}>{t('Output')}:</text>
          </box>
          <text color={theme.status.warning}>
            {totalOutput.toLocaleString()}
          </text>
        </box>
        {totalCached > 0 && (
          <box>
            <box style={{ width: labelWidth }}>
              <text color={theme.text.secondary}>{t('Cached')}:</text>
            </box>
            <text color={theme.status.success}>
              {totalCached.toLocaleString()} ({cacheRate.toFixed(1)}%)
            </text>
          </box>
        )}
      </box>

      {/* Models */}
      {Object.keys(metrics.models).length > 0 && (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <text bold color={theme.text.primary}>
            {t('Models')}
          </text>
          {Object.entries(metrics.models).map(([name, m], i) => (
            <box key={name}>
              <text color={SERIES_COLORS[i % SERIES_COLORS.length]}>
                {ICON.CIRCLE_FILLED + ' '}
              </text>
              <text color={theme.text.primary}>{name} </text>
              <text color={theme.text.secondary}>
                {m.api.totalRequests} {t('reqs')} · {t('in')}=
                {fmtTokens(m.tokens.prompt)} · {t('out')}=
                {fmtTokens(m.tokens.candidates)}
              </text>
            </box>
          ))}
        </box>
      )}
    </box>
  );
};
