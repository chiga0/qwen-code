/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ContextUsageDisplay } from './ContextUsageDisplay.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { AutoAcceptIndicator } from './AutoAcceptIndicator.js';
import { ShellModeIndicator } from './ShellModeIndicator.js';
import { BackgroundTasksPill } from './background-view/BackgroundTasksPill.js';
import { MCPHealthPill } from './mcp/MCPHealthPill.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';

import { MAX_STATUS_LINES, useStatusLine } from '../hooks/useStatusLine.js';
import { useConfigInitMessage } from '../hooks/useConfigInitMessage.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useVimModeState } from '../contexts/VimModeContext.js';
import { GeminiSpinner } from './GeminiRespondingSpinner.js';
import {
  GoalPill,
  isLiveGoalSnapshot,
  useFooterGoalState,
} from './GoalPill.js';
import { CronPill, useFooterCronTaskCount } from './CronPill.js';
import { t } from '../../i18n/index.js';
import { useKeypressContext } from '../contexts/KeypressContext.js';
import { StreamingState } from '../types.js';

import type { PasteProgress } from '../contexts/KeypressContext.js';

const PasteProgressBar: React.FC<{ progress: PasteProgress }> = ({
  progress,
}) => {
  const { receivedBytes } = progress;
  const kb = receivedBytes / 1024;
  const label = kb >= 1 ? `${kb.toFixed(0)} KB` : `${receivedBytes} B`;

  return (
    <text dimColor>
      {t('Pasting…')} {label}
    </text>
  );
};

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();
  const { vimEnabled, vimMode } = useVimModeState();
  const { pasteProgress } = useKeypressContext();
  const {
    lines: statusLineLines,
    useThemeColors,
    respectUserColors,
    hideContextIndicator,
  } = useStatusLine();
  const configInitMessage = useConfigInitMessage(uiState.isConfigInitialized);

  const { promptTokenCount, showAutoAcceptIndicator } = {
    promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
    showAutoAcceptIndicator: uiState.showAutoAcceptIndicator,
  };

  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  // Determine sandbox info from environment
  const sandboxEnv = process.env['SANDBOX'];
  const sandboxInfo = sandboxEnv
    ? sandboxEnv === 'sandbox-exec'
      ? 'seatbelt'
      : sandboxEnv.startsWith('qwen-code')
        ? 'docker'
        : sandboxEnv
    : null;

  // Check if debug mode is enabled
  const debugMode = config.getDebugMode();

  const contextWindowSize =
    config.getContentGeneratorConfig()?.contextWindowSize;

  // Hide "? for shortcuts" when a custom status line is active (it already
  // occupies the footer, so the hint is redundant). Matches upstream behavior.
  const suppressHint = statusLineLines.length > 0;

  // MCP init progress lives in this row (not a standalone component above the
  // input) so the live area's height is constant in the default case, avoiding
  // the residual-blank-line artifact left behind when a separate block unmounts.
  // When a custom status line is active, the row shrinks by 1 on transition to
  // ready — a one-time, small regression preferred over hiding init progress.
  //
  // `configInitMessage` is placed ahead of `showAutoAcceptIndicator` so users
  // launched with YOLO / auto-accept-edits still see the ~1s startup progress;
  // the approval-mode indicator takes over as soon as init finishes.
  const leftBottomContent = uiState.ctrlCPressedOnce ? (
    <text color={theme.status.warning}>{t('Press Ctrl+C again to exit.')}</text>
  ) : uiState.ctrlDPressedOnce ? (
    <text color={theme.status.warning}>{t('Press Ctrl+D again to exit.')}</text>
  ) : uiState.showEscapePrompt ? (
    <text color={theme.text.secondary}>{t('Press Esc again to clear.')}</text>
  ) : pasteProgress.active ? (
    <PasteProgressBar progress={pasteProgress} />
  ) : uiState.rewindEscPending ? (
    <text color={theme.text.secondary}>
      {t('Press Esc again to rewind conversation.')}
    </text>
  ) : vimEnabled && vimMode === 'INSERT' ? (
    <text color={theme.text.secondary}>-- INSERT --</text>
  ) : vimEnabled && vimMode === 'NORMAL' ? (
    <text color={theme.text.secondary}>-- NORMAL --</text>
  ) : uiState.shellModeActive ? (
    <ShellModeIndicator />
  ) : configInitMessage ? (
    <text color={theme.text.secondary}>
      <GeminiSpinner /> {configInitMessage}
    </text>
  ) : uiState.startupIdeConnectionStatus.state === 'connecting' ? (
    <text color={theme.text.secondary}>
      <GeminiSpinner /> {t('IDE connecting... context may be unavailable')}
    </text>
  ) : uiState.startupIdeConnectionStatus.state === 'failed' ? (
    <text color={theme.status.warning}>
      {t('IDE connection unavailable: {{message}}', {
        message: uiState.startupIdeConnectionStatus.message,
      })}
    </text>
  ) : uiState.streamingState === StreamingState.Responding ? (
    <text color={theme.text.secondary}>
      {t('Enter to steer · Ctrl+Q to queue')}
      {showAutoAcceptIndicator !== undefined && (
        <>
          {' · '}
          <AutoAcceptIndicator approvalMode={showAutoAcceptIndicator} />
        </>
      )}
    </text>
  ) : showAutoAcceptIndicator !== undefined ? (
    <AutoAcceptIndicator approvalMode={showAutoAcceptIndicator} />
  ) : suppressHint ? null : (
    <text color={theme.text.secondary}>{t('? for shortcuts')}</text>
  );

  const rightItems: Array<{ key: string; node: React.ReactNode }> = [];
  if (sandboxInfo) {
    rightItems.push({
      key: 'sandbox',
      node: <text color={theme.status.success}>{sandboxInfo}</text>,
    });
  }
  if (config.isSafeMode()) {
    rightItems.push({
      key: 'safe-mode',
      node: <text color={theme.status.warning}>⚠ Safe Mode</text>,
    });
  }
  if (debugMode) {
    rightItems.push({
      key: 'debug',
      node: <text color={theme.status.warning}>Debug Mode</text>,
    });
  }
  // Dream tasks now surface via the BackgroundTasksPill (e.g. "1 dream")
  // alongside the other background-task kinds. The previous `◆ dreaming`
  // right-column indicator was removed to avoid two simultaneous signals
  // for the same underlying state.
  if (promptTokenCount > 0 && contextWindowSize && !hideContextIndicator) {
    rightItems.push({
      key: 'context',
      node: (
        <text color={theme.text.accent}>
          <ContextUsageDisplay
            promptTokenCount={promptTokenCount}
            terminalWidth={terminalWidth}
            contextWindowSize={contextWindowSize}
          />
        </text>
      ),
    });
  }
  // Goal pill: only present in `rightItems` when a goal is active so the
  // divider chain stays tight; the pill itself does the live elapsed-time
  // refresh internally.
  const goalState = useFooterGoalState();
  if (isLiveGoalSnapshot(goalState)) {
    rightItems.push({
      key: 'goal',
      node: <GoalPill snapshot={goalState} />,
    });
  }
  const cronTaskCount = useFooterCronTaskCount();
  if (cronTaskCount > 0) {
    rightItems.push({ key: 'cron', node: <CronPill count={cronTaskCount} /> });
  }

  // Layout matches upstream: left column has status line (top) + hints/mode
  // (bottom), right section has indicators. Status line and hints coexist.
  return (
    <box style={{ flexDirection: isNarrow ? 'column' : 'row', justifyContent: isNarrow ? 'flex-start' : 'space-between', width: "100%", gap: isNarrow ? 0 : 1 }} paddingX={2}>
      {/* Left column — status line on top, hints/mode on bottom */}
      <box style={{ flexDirection: "column", flexGrow: 1, flexShrink: isNarrow ? 0 : 1 }} minWidth={0}>
        {statusLineLines.length > 0 &&
          !uiState.ctrlCPressedOnce &&
          !uiState.ctrlDPressedOnce && (
            <box style={{ flexDirection: "column", width: "100%" }} maxHeight={MAX_STATUS_LINES} overflow="hidden">
              <text
                color={
                  respectUserColors
                    ? undefined
                    : useThemeColors
                      ? theme.text.accent
                      : undefined
                }
                dimColor={respectUserColors ? false : !useThemeColors}
                wrap="wrap"
              >
                {statusLineLines.join('\n')}
              </text>
            </box>
          )}
        {/* Built-in worktree indicator. Shown by default whenever a
            worktree is active so the user always has a UI affordance,
            even when a custom statusline is configured — their script
            may not render `payload.worktree` (written before Phase C,
            ignored by choice, or only rendering some fields), and
            silently hiding the indicator could let the user operate
            in the wrong cwd. Users who want the suppression behaviour
            (e.g. their statusline already renders worktree) can opt
            in via the `ui.hideBuiltinWorktreeIndicator` setting.
            Hidden during ctrl-quit warnings so they take precedence.
            (PR #4174 review #3256241831.) */}
        {uiState.activeWorktree &&
          !settings.merged.ui?.hideBuiltinWorktreeIndicator &&
          !uiState.ctrlCPressedOnce &&
          !uiState.ctrlDPressedOnce && (
            <text dimColor wrap="truncate">
              {`⎇ ${uiState.activeWorktree.branch} (${uiState.activeWorktree.slug})`}
            </text>
          )}
        {/* P7-trigger: the current turn was steered toward the Workflow tool
            by the `workflow` keyword. Hidden during ctrl-quit warnings so they
            take precedence (matches the worktree indicator above). */}
        {uiState.workflowKeywordActive &&
          !uiState.ctrlCPressedOnce &&
          !uiState.ctrlDPressedOnce && (
            <text color={theme.text.accent} wrap="truncate">
              {`▷ ${t('workflow active')}`}
            </text>
          )}
        <box style={{ flexDirection: "row", flexShrink: 1 }}>
          <text wrap="truncate">{leftBottomContent}</text>
          <BackgroundTasksPill />
          <MCPHealthPill />
          {!uiState.isSkillReviewDialogOpen &&
            (uiState.skillReviewPending?.skills.length ?? 0) > 0 && (
              <text color={theme.status.warning}>
                {` ⚠ ${t('{{count}} skill(s) pending review', {
                  count: String(uiState.skillReviewPending!.skills.length),
                })}`}
              </text>
            )}
        </box>
      </box>

      {/* Right Section — never compressed, aligns to top so multi-line
          status lines on the left don't push the indicators to the center. */}
      <box style={{ flexShrink: 0, gap: 1, alignItems: "flex-start" }}>
        {rightItems.map(({ key, node }, index) => (
          <box key={key} style={{ alignItems: "center" }}>
            {index > 0 && <text color={theme.text.secondary}> | </text>}
            {node}
          </box>
        ))}
      </box>
    </box>
  );
};
