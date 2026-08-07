/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type {
  ContextCategoryBreakdown,
  ContextMemoryDetail,
  ContextSkillDetail,
  ContextThresholds,
  ContextTier,
  ContextToolDetail,
} from '../../types.js';
import { t } from '../../../i18n/index.js';

// Progress bar characters
const FILLED = '\u2588'; // █ - filled block
const BUFFER = '\u2592'; // ▒ - medium shade (autocompact buffer)
const EMPTY = '\u2591'; // ░ - light shade (free space)

const CONTENT_WIDTH = 56;

interface ContextUsageProps {
  modelName: string;
  totalTokens: number;
  contextWindowSize: number;
  breakdown: ContextCategoryBreakdown;
  builtinTools: ContextToolDetail[];
  mcpTools: ContextToolDetail[];
  memoryFiles: ContextMemoryDetail[];
  skills: ContextSkillDetail[];
  /** True when totalTokens is estimated (no API call yet) */
  isEstimated?: boolean;
  /** When true, show per-item detail breakdowns. Default: false (compact). */
  showDetails?: boolean;
}

/**
 * Truncate a string to maxLen, appending '…' if truncated.
 */
function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Format token count for display (e.g. 1234 -> "1.2k", 123456 -> "123.5k")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${tokens}`;
}

/**
 * Render a three-segment progress bar: used | autocompact buffer | free space.
 */
const ProgressBar: React.FC<{
  usedPercentage: number;
  bufferPercentage: number;
  width: number;
}> = ({ usedPercentage, bufferPercentage, width }) => {
  const usedCount = Math.round((Math.min(usedPercentage, 100) / 100) * width);
  const bufferCount = Math.round(
    (Math.min(bufferPercentage, 100 - usedPercentage) / 100) * width,
  );
  const freeCount = Math.max(0, width - usedCount - bufferCount);

  const usedStr = FILLED.repeat(Math.max(0, usedCount));
  const freeStr = EMPTY.repeat(Math.max(0, freeCount));
  const bufferStr = BUFFER.repeat(Math.max(0, bufferCount));

  // Used color: accent by default, warning/error at high usage.
  let usedColor = theme.text.accent;
  if (usedPercentage > 80) {
    usedColor = theme.status.error;
  } else if (usedPercentage > 60) {
    usedColor = theme.status.warning;
  }

  return (
    <text>
      <text color={usedColor}>{usedStr}</text>
      <text color={theme.text.secondary}>{freeStr}</text>
      <text color={theme.status.warning}>{bufferStr}</text>
    </text>
  );
};

/**
 * Format percentage for display, showing ">100%" when exceeding limit.
 */
function formatPercentage(tokens: number, contextWindowSize: number): string {
  if (contextWindowSize <= 0) return '0.0';
  const percentage = (tokens / contextWindowSize) * 100;
  if (percentage > 100) {
    return '>100';
  }
  return percentage.toFixed(1);
}

/**
 * A row showing a category with its token count and percentage.
 */
const CategoryRow: React.FC<{
  symbol: string;
  label: string;
  tokens: number;
  contextWindowSize: number;
  symbolColor?: string;
  isOverLimit?: boolean;
}> = ({
  symbol,
  label,
  tokens,
  contextWindowSize,
  symbolColor,
  isOverLimit,
}) => {
  const percentageStr = formatPercentage(tokens, contextWindowSize);
  const tokenStr = `${formatTokens(tokens)} ${t('tokens')} (${percentageStr}%)`;

  return (
    <box style={{ width: CONTENT_WIDTH }}>
      <box style={{ width: 2 }}>
        <text color={symbolColor || theme.text.secondary}>{symbol}</text>
      </box>
      <box style={{ width: 24 }}>
        <text color={theme.text.primary}>{label}</text>
      </box>
      <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <text color={isOverLimit ? theme.status.error : theme.text.secondary}>
          {tokenStr}
        </text>
      </box>
    </box>
  );
};

/**
 * A row inside the "Compaction thresholds" section: label + token count, with
 * a left-edge marker when the current usage has crossed this tier.
 */
const ThresholdRow: React.FC<{
  label: string;
  tokens: number;
  isCurrent?: boolean;
  hint?: string;
}> = ({ label, tokens, isCurrent, hint }) => {
  const tokenStr = `${formatTokens(tokens)} ${t('tokens')}`;
  return (
    <box style={{ width: CONTENT_WIDTH }}>
      <box style={{ width: 2 }}>
        <text color={isCurrent ? theme.status.warning : theme.text.secondary}>
          {isCurrent ? '▶' : ' '}
        </text>
      </box>
      <box style={{ width: 22 }}>
        <text color={theme.text.primary}>{label}</text>
      </box>
      <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <text color={theme.text.secondary}>
          {tokenStr}
          {hint ? `  ${hint}` : ''}
        </text>
      </box>
    </box>
  );
};

/**
 * Color associated with each compaction tier — green for safe, escalating to
 * red for hard. Keep these aligned with how `theme.status.*` is used elsewhere
 * so the tier badge feels native to the existing design.
 */
function tierColor(tier: ContextTier): string {
  switch (tier) {
    case 'safe':
      return theme.status.success;
    case 'warn':
      return theme.status.warning;
    case 'auto':
      return theme.status.warning;
    case 'hard':
      return theme.status.error;
    default:
      return theme.text.secondary;
  }
}

/**
 * Renders the three-tier compaction threshold ladder (warn / auto / hard) with
 * the effective window and a current-tier marker. Source of the data is
 * `breakdown.thresholds` + `breakdown.currentTier`, which the context command
 * derives from `computeThresholds()` in core.
 */
const CompactionThresholds: React.FC<{
  thresholds: ContextThresholds;
  currentTier: ContextTier;
}> = ({ thresholds, currentTier }) => (
  <box style={{ flexDirection: "column" }} marginTop={1}>
    <text bold color={theme.text.primary}>
      {t('Compaction thresholds')}
    </text>
    <ThresholdRow
      label={t('Effective window')}
      tokens={thresholds.effectiveWindow}
    />
    <ThresholdRow
      label={t('Warn threshold')}
      tokens={thresholds.warn}
      isCurrent={currentTier === 'warn'}
    />
    <ThresholdRow
      label={t('Auto threshold')}
      tokens={thresholds.auto}
      isCurrent={currentTier === 'auto'}
    />
    <ThresholdRow
      label={t('Hard threshold')}
      tokens={thresholds.hard}
      isCurrent={currentTier === 'hard'}
    />
    <box style={{ width: CONTENT_WIDTH }}>
      <box style={{ width: 2 }}>
        <text> </text>
      </box>
      <box style={{ width: 22 }}>
        <text color={theme.text.primary}>{t('Current tier')}</text>
      </box>
      <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <text bold color={tierColor(currentTier)}>
          {currentTier}
        </text>
      </box>
    </box>
  </box>
);

/**
 * A detail row for individual items (MCP tools, memory files, skills).
 */
const DETAIL_NAME_MAX_LEN = 30;

const DetailRow: React.FC<{
  name: string;
  tokens: number;
}> = ({ name, tokens }) => {
  const tokenStr =
    tokens > 0 ? `${formatTokens(tokens)} ${t('tokens')}` : `0 ${t('tokens')}`;
  return (
    <box style={{ width: CONTENT_WIDTH }} paddingLeft={2}>
      <text color={theme.text.secondary}>{'\u2514'} </text>
      <box style={{ width: 32 }}>
        <text color={theme.text.link}>
          {truncateName(name, DETAIL_NAME_MAX_LEN)}
        </text>
      </box>
      <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
        <text color={theme.text.secondary}>{tokenStr}</text>
      </box>
    </box>
  );
};

export const ContextUsage: React.FC<ContextUsageProps> = ({
  modelName,
  totalTokens,
  contextWindowSize,
  breakdown,
  builtinTools,
  mcpTools,
  memoryFiles,
  skills,
  isEstimated,
  showDetails = false,
}) => {
  const percentage =
    contextWindowSize > 0 ? (totalTokens / contextWindowSize) * 100 : 0;
  const isOverLimit = percentage > 100;

  // Sort detail items by token count (descending) for better readability
  const sortedBuiltinTools = [...builtinTools].sort(
    (a, b) => b.tokens - a.tokens,
  );
  const sortedMcpTools = [...mcpTools].sort((a, b) => b.tokens - a.tokens);
  const sortedMemoryFiles = [...memoryFiles].sort(
    (a, b) => b.tokens - a.tokens,
  );
  // Sort skills: loaded first, then by total token cost descending
  const sortedSkills = [...skills].sort((a, b) => {
    if (a.loaded !== b.loaded) return a.loaded ? -1 : 1;
    const aTotal = a.tokens + (a.bodyTokens ?? 0);
    const bTotal = b.tokens + (b.bodyTokens ?? 0);
    return bTotal - aTotal;
  });

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column" }} paddingY={1} paddingX={2}>
      {/* Title */}
      <text bold color={theme.text.accent}>
        {t('Context Usage')}
      </text>
      <box style={{ height: 1 }} />

      {isEstimated ? (
        <>
          {/* No API data yet — show hint instead of progress bar */}
          <box marginBottom={1}>
            <text color={theme.status.warning} italic>
              {t('No API response yet. Send a message to see actual usage.')}
            </text>
          </box>

          {/* Estimated overhead categories */}
          <text bold color={theme.text.primary}>
            {t('Estimated pre-conversation overhead')}
          </text>
          <text color={theme.text.secondary}>
            {t('Model')}: {modelName}
            {'  '}
            {t('Context window')}: {formatTokens(contextWindowSize)}{' '}
            {t('tokens')}
          </text>
          <box style={{ height: 1 }} />
        </>
      ) : (
        <>
          {/* Model name + context window info */}
          <box style={{ width: CONTENT_WIDTH }} marginBottom={1}>
            <text color={theme.text.secondary}>
              {t('Model')}: {modelName}
            </text>
            <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
              <text color={theme.text.secondary}>
                {t('Context window')}: {formatTokens(contextWindowSize)}{' '}
                {t('tokens')}
              </text>
            </box>
          </box>
          {/* Progress bar — three segments: used | free | buffer */}
          <box style={{ width: CONTENT_WIDTH }}>
            <ProgressBar
              usedPercentage={Math.min(percentage, 100)}
              bufferPercentage={
                contextWindowSize > 0
                  ? (breakdown.autocompactBuffer / contextWindowSize) * 100
                  : 0
              }
              width={CONTENT_WIDTH}
            />
          </box>
          {/* Warning when context exceeds limit */}
          {isOverLimit && (
            <box marginBottom={1}>
              <text color={theme.status.error}>
                {t('Context exceeds limit! Use /compress or /clear to reduce.')}
              </text>
            </box>
          )}
          <box style={{ height: 1 }} />
          {/* Legend — same layout as CategoryRow for alignment */}
          <CategoryRow
            symbol={FILLED}
            label={t('Used')}
            tokens={totalTokens}
            contextWindowSize={contextWindowSize}
            symbolColor={isOverLimit ? theme.status.error : theme.text.accent}
            isOverLimit={isOverLimit}
          />
          <CategoryRow
            symbol={EMPTY}
            label={t('Free')}
            tokens={breakdown.freeSpace}
            contextWindowSize={contextWindowSize}
            symbolColor={theme.text.secondary}
          />
          <CategoryRow
            symbol={BUFFER}
            label={t('Autocompact buffer')}
            tokens={breakdown.autocompactBuffer}
            contextWindowSize={contextWindowSize}
            symbolColor={theme.status.warning}
          />
          <box style={{ height: 1 }} />

          {/* Breakdown header */}
          <text bold color={theme.text.primary}>
            {t('Usage by category')}
          </text>
        </>
      )}

      <CategoryRow
        symbol={FILLED}
        label={t('System prompt')}
        tokens={breakdown.systemPrompt}
        contextWindowSize={contextWindowSize}
        symbolColor={theme.text.accent}
      />
      <CategoryRow
        symbol={FILLED}
        label={t('Built-in tools')}
        tokens={breakdown.builtinTools}
        contextWindowSize={contextWindowSize}
        symbolColor={theme.text.accent}
      />
      {breakdown.mcpTools > 0 && (
        <CategoryRow
          symbol={FILLED}
          label={t('MCP tools')}
          tokens={breakdown.mcpTools}
          contextWindowSize={contextWindowSize}
          symbolColor={theme.text.accent}
        />
      )}
      <CategoryRow
        symbol={FILLED}
        label={t('Memory files')}
        tokens={breakdown.memoryFiles}
        contextWindowSize={contextWindowSize}
        symbolColor={theme.text.accent}
      />
      <CategoryRow
        symbol={FILLED}
        label={t('Skills')}
        tokens={breakdown.skills}
        contextWindowSize={contextWindowSize}
        symbolColor={theme.text.accent}
      />
      {/* Only show Messages when we have real API data */}
      {!isEstimated && (
        <CategoryRow
          symbol={FILLED}
          label={t('Messages')}
          tokens={breakdown.messages}
          contextWindowSize={contextWindowSize}
          symbolColor={theme.text.accent}
        />
      )}

      {/* Three-tier compaction thresholds — visible even when isEstimated so
          the user can see the auto-compact landscape before any API call. */}
      {breakdown.thresholds && breakdown.currentTier && (
        <CompactionThresholds
          thresholds={breakdown.thresholds}
          currentTier={breakdown.currentTier}
        />
      )}

      {showDetails ? (
        <>
          {/* Built-in tools detail */}
          {sortedBuiltinTools.length > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1}>
              <text bold color={theme.text.primary}>
                {t('Built-in tools')}
              </text>
              {sortedBuiltinTools.map((tool) => (
                <DetailRow
                  key={tool.name}
                  name={tool.name}
                  tokens={tool.tokens}
                />
              ))}
            </box>
          )}

          {/* MCP Tools detail */}
          {sortedMcpTools.length > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1}>
              <text bold color={theme.text.primary}>
                {t('MCP tools')}
              </text>
              {sortedMcpTools.map((tool) => (
                <DetailRow
                  key={tool.name}
                  name={tool.name}
                  tokens={tool.tokens}
                />
              ))}
            </box>
          )}

          {/* Memory files detail */}
          {sortedMemoryFiles.length > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1}>
              <text bold color={theme.text.primary}>
                {t('Memory files')}
              </text>
              {sortedMemoryFiles.map((file) => (
                <DetailRow
                  key={file.path}
                  name={file.path}
                  tokens={file.tokens}
                />
              ))}
            </box>
          )}

          {/* Skills detail */}
          {sortedSkills.length > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1}>
              <text bold color={theme.text.primary}>
                {t('Skills')}
              </text>
              {sortedSkills.map((skill) => (
                <box key={skill.name} style={{ flexDirection: "column" }}>
                  <box style={{ width: CONTENT_WIDTH }} paddingLeft={2}>
                    <text color={theme.text.secondary}>{'\u2514'} </text>
                    <box style={{ width: 32 }}>
                      <text color={theme.text.link}>
                        {truncateName(skill.name, DETAIL_NAME_MAX_LEN)}
                      </text>
                      {skill.loaded && (
                        <text color={theme.status.success}> {t('active')}</text>
                      )}
                    </box>
                    <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
                      <text color={theme.text.secondary}>
                        {formatTokens(skill.tokens)} {t('tokens')}
                      </text>
                    </box>
                  </box>
                  {skill.loaded &&
                    skill.bodyTokens != null &&
                    skill.bodyTokens > 0 && (
                      <box style={{ width: CONTENT_WIDTH }} paddingLeft={4}>
                        <text color={theme.text.secondary}>{'  \u2514'} </text>
                        <box style={{ width: 30 }}>
                          <text color={theme.text.secondary} italic>
                            {t('body loaded')}
                          </text>
                        </box>
                        <box style={{ flexGrow: 1, justifyContent: "flex-end" }}>
                          <text color={theme.status.success}>
                            +{formatTokens(skill.bodyTokens)} {t('tokens')}
                          </text>
                        </box>
                      </box>
                    )}
                </box>
              ))}
            </box>
          )}
        </>
      ) : (
        <box marginTop={1}>
          <text color={theme.text.secondary} italic>
            {t('Run /context detail for per-item breakdown.')}
          </text>
        </box>
      )}
    </box>
  );
};
