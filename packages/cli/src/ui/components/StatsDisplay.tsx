/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../semantic-colors.js';
import { formatDuration } from '../utils/formatters.js';
import type { ModelMetrics } from '../contexts/SessionContext.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
} from '../utils/displayUtils.js';
import { getRenderableGradientColors } from '../utils/gradientUtils.js';
import { computeSessionStats } from '../utils/computeStats.js';
import { flattenModelsBySource } from '../utils/modelsBySource.js';
import { t } from '../../i18n/index.js';

// A more flexible and powerful StatRow component
interface StatRowProps {
  title: string;
  children: React.ReactNode; // Use children to allow for complex, colored values
}

const StatRow: React.FC<StatRowProps> = ({ title, children }) => (
  <box>
    {/* Fixed width for the label creates a clean "gutter" for alignment */}
    <box style={{ width: 28 }}>
      <text color={theme.text.link}>{title}</text>
    </box>
    {/* FIX: Wrap children in a Box that can grow to fill remaining space */}
    <box style={{ flexGrow: 1 }}>{children}</box>
  </box>
);

// A SubStatRow for indented, secondary information
interface SubStatRowProps {
  title: string;
  children: React.ReactNode;
}

const SubStatRow: React.FC<SubStatRowProps> = ({ title, children }) => (
  <box paddingLeft={2}>
    {/* Adjust width for the "» " prefix */}
    <box style={{ width: 26 }}>
      <text color={theme.text.secondary}>» {title}</text>
    </box>
    {/* FIX: Apply the same flexGrow fix here */}
    <box style={{ flexGrow: 1 }}>{children}</box>
  </box>
);

// A Section component to group related stats
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <box style={{ flexDirection: "column", width: "100%" }} marginBottom={1}>
    <text bold color={theme.text.primary}>
      {title}
    </text>
    {children}
  </box>
);

const ModelUsageTable: React.FC<{
  models: Record<string, ModelMetrics>;
  totalCachedTokens: number;
  cacheEfficiency: number;
}> = ({ models, totalCachedTokens, cacheEfficiency }) => {
  // 35 + 8 + 15 + 15 = 73, fitting within the 76-column panel allocated
  // when the terminal is at the default 80-column width. Subagent labels
  // longer than 35 characters will wrap — acceptable cosmetic trade-off
  // given the alternative is overflowing the panel border.
  const nameWidth = 35;
  const requestsWidth = 8;
  const inputTokensWidth = 15;
  const outputTokensWidth = 15;

  const entries = flattenModelsBySource(models);

  return (
    <box style={{ flexDirection: "column" }} marginTop={1}>
      {/* Header */}
      <box>
        <box style={{ width: nameWidth }}>
          <text bold color={theme.text.primary}>
            {t('Model Usage')}
          </text>
        </box>
        <box style={{ width: requestsWidth, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Reqs')}
          </text>
        </box>
        <box style={{ width: inputTokensWidth, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Input Tokens')}
          </text>
        </box>
        <box style={{ width: outputTokensWidth, justifyContent: "flex-end" }}>
          <text bold color={theme.text.primary}>
            {t('Output Tokens')}
          </text>
        </box>
      </box>
      {/* Divider */}
      <box style={{ borderStyle: "round", borderColor: theme.border.default, width: nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth }} borderBottom={true} borderTop={false} borderLeft={false} borderRight={false}></box>

      {/* Rows */}
      {entries.map(({ key, label, metrics }) => (
        <box key={key}>
          <box style={{ width: nameWidth }}>
            <text color={theme.text.primary}>{label}</text>
          </box>
          <box style={{ width: requestsWidth, justifyContent: "flex-end" }}>
            <text color={theme.text.primary}>{metrics.api.totalRequests}</text>
          </box>
          <box style={{ width: inputTokensWidth, justifyContent: "flex-end" }}>
            <text color={theme.status.warning}>
              {metrics.tokens.prompt.toLocaleString()}
            </text>
          </box>
          <box style={{ width: outputTokensWidth, justifyContent: "flex-end" }}>
            <text color={theme.status.warning}>
              {metrics.tokens.candidates.toLocaleString()}
            </text>
          </box>
        </box>
      ))}
      {cacheEfficiency > 0 && (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <text color={theme.text.primary}>
            <text color={theme.status.success}>{t('Savings Highlight:')}</text>{' '}
            {totalCachedTokens.toLocaleString()} ({cacheEfficiency.toFixed(1)}
            %){' '}
            {t('of input tokens were served from the cache, reducing costs.')}
          </text>
          <box style={{ height: 1 }} />
          <text color={theme.text.secondary}>
            » {t('Tip: For a full token breakdown, run `/stats model`.')}
          </text>
        </box>
      )}
    </box>
  );
};

interface StatsDisplayProps {
  duration: string;
  title?: string;
  width?: number;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  duration,
  title,
  width,
}) => {
  const { stats } = useSessionStats();
  const { metrics } = stats;
  const { models, tools, files } = metrics;
  const computed = computeSessionStats(metrics);

  const successThresholds = {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  };
  const agreementThresholds = {
    green: USER_AGREEMENT_RATE_HIGH,
    yellow: USER_AGREEMENT_RATE_MEDIUM,
  };
  const successColor = getStatusColor(computed.successRate, successThresholds);
  const agreementColor = getStatusColor(
    computed.agreementRate,
    agreementThresholds,
  );

  const renderTitle = () => {
    if (title) {
      const gradientColors = getRenderableGradientColors(theme.ui.gradient);
      return gradientColors ? (
        <Gradient colors={gradientColors}>
          <text bold color={theme.text.primary}>
            {title}
          </text>
        </Gradient>
      ) : (
        <text bold color={theme.text.accent}>
          {title}
        </text>
      );
    }
    return (
      <text bold color={theme.text.accent}>
        {t('Session Stats')}
      </text>
    );
  };

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", width: width }} paddingY={1} paddingX={2}>
      {renderTitle()}
      <box style={{ height: 1 }} />

      <Section title={t('Interaction Summary')}>
        <StatRow title={t('Session ID:')}>
          <text color={theme.text.primary}>{stats.sessionId}</text>
        </StatRow>
        <StatRow title={t('Tool Calls:')}>
          <text color={theme.text.primary}>
            {tools.totalCalls} ({' '}
            <text color={theme.status.success}>✓ {tools.totalSuccess}</text>{' '}
            <text color={theme.status.error}>x {tools.totalFail}</text> )
          </text>
        </StatRow>
        <StatRow title={t('Success Rate:')}>
          <text color={successColor}>{computed.successRate.toFixed(1)}%</text>
        </StatRow>
        {computed.totalDecisions > 0 && (
          <StatRow title={t('User Agreement:')}>
            <text color={agreementColor}>
              {computed.agreementRate.toFixed(1)}%{' '}
              <text color={theme.text.secondary}>
                ({computed.totalDecisions} {t('reviewed')})
              </text>
            </text>
          </StatRow>
        )}
        {files &&
          (files.totalLinesAdded > 0 || files.totalLinesRemoved > 0) && (
            <StatRow title={t('Code Changes:')}>
              <text color={theme.text.primary}>
                <text color={theme.status.success}>
                  +{files.totalLinesAdded}
                </text>{' '}
                <text color={theme.status.error}>
                  -{files.totalLinesRemoved}
                </text>
              </text>
            </StatRow>
          )}
      </Section>

      <Section title={t('Performance')}>
        <StatRow title={t('Wall Time:')}>
          <text color={theme.text.primary}>{duration}</text>
        </StatRow>
        <StatRow title={t('Agent Active:')}>
          <text color={theme.text.primary}>
            {formatDuration(computed.agentActiveTime)}
          </text>
        </StatRow>
        <SubStatRow title={t('API Time:')}>
          <text color={theme.text.primary}>
            {formatDuration(computed.totalApiTime)}{' '}
            <text color={theme.text.secondary}>
              ({computed.apiTimePercent.toFixed(1)}%)
            </text>
          </text>
        </SubStatRow>
        <SubStatRow title={t('Tool Time:')}>
          <text color={theme.text.primary}>
            {formatDuration(computed.totalToolTime)}{' '}
            <text color={theme.text.secondary}>
              ({computed.toolTimePercent.toFixed(1)}%)
            </text>
          </text>
        </SubStatRow>
      </Section>

      {Object.keys(models).length > 0 && (
        <ModelUsageTable
          models={models}
          totalCachedTokens={computed.totalCachedTokens}
          cacheEfficiency={computed.cacheEfficiency}
        />
      )}
    </box>
  );
};
