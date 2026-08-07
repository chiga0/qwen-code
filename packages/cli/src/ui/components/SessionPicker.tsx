/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type {
  SessionListItem as SessionData,
  SessionService,
} from '@qwen-code/qwen-code-core';
import { theme } from '../semantic-colors.js';
import { useSessionPicker } from '../hooks/useSessionPicker.js';
import { formatRelativeTime } from '../utils/formatters.js';
import {
  formatMessageCount,
  truncateText,
} from '../utils/sessionPickerUtils.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { t } from '../../i18n/index.js';
import { SessionPreview } from './SessionPreview.js';

export interface SessionPickerProps {
  sessionService: SessionService | null;
  onSelect: (sessionId: string) => void;
  onCancel: () => void;
  currentBranch?: string;

  /**
   * Custom title for the picker header. Defaults to "Resume Session".
   */
  title?: string;

  /**
   * Scroll mode. When true, keep selection centered (fullscreen-style).
   * Defaults to true so dialog + standalone behave identically.
   */
  centerSelection?: boolean;

  /**
   * Pre-filtered sessions to display instead of loading all sessions.
   * When provided, skips initial load and disables pagination.
   */
  initialSessions?: SessionData[];

  /**
   * Enable Space-to-preview. Off by default — preview's Enter shortcut
   * forwards to `onSelect`, which for resume flows is "resume", but for
   * destructive flows (e.g. delete) would commit the action. Only opt in
   * for non-destructive selection flows.
   */
  enablePreview?: boolean;

  /**
   * Enable multi-select mode. Space toggles a checkbox on the cursor item;
   * Enter commits the checked set via {@link onConfirmMulti}. With nothing
   * checked, Enter falls back to single-select via {@link onSelect}.
   */
  enableMultiSelect?: boolean;

  /**
   * Receives the list of session IDs the user committed when in
   * multi-select mode. Required when {@link enableMultiSelect} is true.
   */
  onConfirmMulti?: (sessionIds: string[]) => void;

  /**
   * Session IDs the user is not allowed to check (e.g. the current
   * active session can't be batch-deleted). They render dimmed with a
   * hint and Space is a no-op while the cursor is on them. Enter is also
   * suppressed on disabled rows when multi-select falls back to single-select.
   *
   * Callers that need to forbid selecting a specific session outside this
   * picker behavior should filter `initialSessions` instead.
   */
  disabledIds?: readonly string[];
}

const PREFIX_CHARS = {
  selected: '› ',
  scrollUp: '↑ ',
  scrollDown: '↓ ',
  normal: '  ',
};

interface SessionListItemViewProps {
  session: SessionData;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  showScrollUp: boolean;
  showScrollDown: boolean;
  maxPromptWidth: number;
  prefixChars?: {
    selected: string;
    scrollUp: string;
    scrollDown: string;
    normal: string;
  };
  boldSelectedPrefix?: boolean;
  /** When defined, render a leading `[x]`/`[ ]` checkbox. */
  isChecked?: boolean;
  /** Item cannot be checked — render dim and append a hint. */
  isDisabled?: boolean;
  /** Reason text shown beside disabled rows (e.g. "current"). */
  disabledHint?: string;
}

function SessionListItemView({
  session,
  isSelected,
  isFirst,
  isLast,
  showScrollUp,
  showScrollDown,
  maxPromptWidth,
  prefixChars = PREFIX_CHARS,
  boldSelectedPrefix = true,
  isChecked,
  isDisabled = false,
  disabledHint,
}: SessionListItemViewProps): React.JSX.Element {
  const timeAgo = formatRelativeTime(session.mtime);
  // `messageCount` is now optional on `SessionListItem` because counting
  // requires a full readline pass over the JSONL — far too expensive to do
  // in the listing path. The row simply omits the "N messages" segment
  // when the count isn't available; preview-style consumers that care can
  // call `SessionService.countSessionMessages(sessionId)` lazily.
  const messageText =
    typeof session.messageCount === 'number'
      ? formatMessageCount(session.messageCount)
      : undefined;

  const showUpIndicator = isFirst && showScrollUp;
  const showDownIndicator = isLast && showScrollDown;

  const prefix = isSelected
    ? prefixChars.selected
    : showUpIndicator
      ? prefixChars.scrollUp
      : showDownIndicator
        ? prefixChars.scrollDown
        : prefixChars.normal;

  const promptText = session.customTitle || session.prompt || '(empty prompt)';
  // Reserve space for the checkbox when multi-select is active so the
  // prompt column doesn't shift between modes.
  const checkboxWidth = isChecked === undefined ? 0 : 4; // "[x] "
  const truncatedPrompt = truncateText(
    promptText,
    Math.max(1, maxPromptWidth - checkboxWidth),
  );
  // Dim auto-generated titles so users can distinguish a model guess from
  // a title they chose themselves with `/rename`. Selected row keeps the
  // accent color — legibility of the focused row wins over source hinting.
  const isAutoTitle =
    session.titleSource === 'auto' && Boolean(session.customTitle);

  return (
    <box style={{ flexDirection: "column" }} marginBottom={isLast ? 0 : 1}>
      <box>
        <text
          color={
            isSelected
              ? theme.text.accent
              : showUpIndicator || showDownIndicator
                ? theme.text.secondary
                : undefined
          }
          bold={isSelected && boldSelectedPrefix}
        >
          {prefix}
        </text>
        {isChecked !== undefined && (
          <text
            color={
              isDisabled
                ? theme.text.secondary
                : isChecked
                  ? theme.text.accent
                  : isSelected
                    ? theme.text.accent
                    : theme.text.secondary
            }
            bold={isChecked}
          >
            {isChecked ? '[x] ' : '[ ] '}
          </text>
        )}
        <text
          color={
            isDisabled
              ? theme.text.secondary
              : isSelected
                ? theme.text.accent
                : isAutoTitle
                  ? theme.text.secondary
                  : theme.text.primary
          }
          bold={isSelected && !isDisabled}
        >
          {truncatedPrompt}
        </text>
      </box>
      <box paddingLeft={2}>
        <text color={theme.text.secondary}>
          {timeAgo}
          {messageText !== undefined && ` · ${messageText}`}
          {session.gitBranch && ` · ${session.gitBranch}`}
          {isDisabled && disabledHint ? ` · ${disabledHint}` : ''}
        </text>
      </box>
    </box>
  );
}

export function SessionPicker(props: SessionPickerProps) {
  const {
    sessionService,
    onSelect,
    onCancel,
    currentBranch,
    title,
    centerSelection = true,
    initialSessions,
    enablePreview = false,
    enableMultiSelect = false,
    onConfirmMulti,
    disabledIds,
  } = props;

  const { columns: width, rows: height } = useTerminalSize();

  // Calculate box width (marginX={2})
  const boxWidth = width - 4;
  // Calculate visible items.
  // Reserved space: header (1), search row (1), footer (1), separators (2),
  // borders (2). The search row is rendered as a thin "Press / to search"
  // hint in list mode and a live query in search mode — same height in
  // both, so the visible-item count doesn't shift between modes.
  const reservedLines = 7;
  // Each item takes 2 lines (prompt + metadata) + 1 line margin between items
  const itemHeight = 3;
  const maxVisibleItems = Math.max(
    1,
    Math.floor((height - reservedLines) / itemHeight),
  );

  const picker = useSessionPicker({
    sessionService,
    currentBranch,
    onSelect,
    onCancel,
    maxVisibleItems,
    centerSelection,
    initialSessions,
    isActive: true,
    enablePreview,
    enableMultiSelect,
    onConfirmMulti,
    disabledIds,
  });

  if (
    enablePreview &&
    picker.viewMode === 'preview' &&
    picker.previewSessionId &&
    sessionService
  ) {
    const previewed = picker.filteredSessions.find(
      (s) => s.sessionId === picker.previewSessionId,
    );
    return (
      <SessionPreview
        sessionService={sessionService}
        sessionId={picker.previewSessionId}
        sessionTitle={previewed?.customTitle ?? previewed?.prompt ?? undefined}
        messageCount={previewed?.messageCount}
        mtime={previewed?.mtime}
        gitBranch={previewed?.gitBranch}
        onExit={picker.exitPreview}
        onResume={onSelect}
      />
    );
  }

  return (
    <box style={{ flexDirection: "column", width: boxWidth, height: height - 1 }} overflow="hidden">
      <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, height: height - 1 }} overflow="hidden">
        {/* Header row */}
        <box paddingX={1}>
          <text bold color={theme.text.primary}>
            {title ?? t('Resume Session')}
          </text>
          {picker.filterByBranch && currentBranch && (
            <text color={theme.text.secondary}>
              {' '}
              {t('(branch: {{branch}})', { branch: currentBranch })}
            </text>
          )}
          {picker.searchQuery !== '' && (
            <text color={theme.text.secondary}>
              {' '}
              {t('({{count}} matches)', {
                count: String(picker.filteredSessions.length),
              })}
            </text>
          )}
        </box>

        {/* Search row — three states share this row at constant height so
            the visible-item count doesn't shift between them:
              - search: "Search: <query>▌" (live editing, caret visible)
              - list + non-empty query: "Filter: <query>" (read-only,
                no caret — user has stopped typing but the filter sticks)
              - list + empty query: "Press / to search" hint */}
        <box paddingX={1}>
          {picker.isSearchActive ? (
            <>
              <text color={theme.text.secondary}>{t('Search: ')}</text>
              <text color={theme.text.primary}>
                {picker.searchQuery}
                <text color={theme.text.secondary}>▌</text>
              </text>
            </>
          ) : picker.searchQuery !== '' ? (
            <>
              <text color={theme.text.secondary}>{t('Filter: ')}</text>
              <text color={theme.text.primary}>{picker.searchQuery}</text>
            </>
          ) : (
            <text color={theme.text.secondary}>{t('Press / to search')}</text>
          )}
        </box>

        {/* Separator */}
        <box>
          <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
        </box>

        {/* Session list */}
        <box style={{ flexDirection: "column", flexGrow: 1 }} paddingX={1} overflow="hidden">
          {!sessionService || picker.isLoading ? (
            <box paddingY={1} style={{ justifyContent: "center" }}>
              <text color={theme.text.secondary}>
                {t('Loading sessions...')}
              </text>
            </box>
          ) : picker.filteredSessions.length === 0 ? (
            <box paddingY={1} style={{ justifyContent: "center" }}>
              <text color={theme.text.secondary}>
                {picker.searchQuery !== ''
                  ? t('No sessions match "{{query}}"', {
                      query: picker.searchQuery,
                    })
                  : picker.filterByBranch
                    ? t('No sessions found for branch "{{branch}}"', {
                        branch: currentBranch ?? '',
                      })
                    : t('No sessions found')}
              </text>
            </box>
          ) : (
            picker.visibleSessions.map((session, visibleIndex) => {
              const actualIndex = picker.scrollOffset + visibleIndex;
              const isDisabled = picker.disabledIdSet.has(session.sessionId);
              return (
                <SessionListItemView
                  key={session.sessionId}
                  session={session}
                  isSelected={
                    !picker.isSearchActive &&
                    actualIndex === picker.selectedIndex
                  }
                  isFirst={visibleIndex === 0}
                  isLast={visibleIndex === picker.visibleSessions.length - 1}
                  showScrollUp={picker.showScrollUp}
                  showScrollDown={picker.showScrollDown}
                  maxPromptWidth={boxWidth - 6}
                  prefixChars={PREFIX_CHARS}
                  boldSelectedPrefix={false}
                  isChecked={
                    enableMultiSelect
                      ? picker.checkedIds.has(session.sessionId)
                      : undefined
                  }
                  isDisabled={enableMultiSelect && isDisabled}
                  disabledHint={
                    enableMultiSelect && isDisabled
                      ? t('current — cannot delete')
                      : undefined
                  }
                />
              );
            })
          )}
        </box>

        {/* Separator */}
        <box>
          <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
        </box>

        {/* Footer */}
        <box paddingX={1}>
          <box style={{ flexDirection: "row" }}>
            {picker.isSearchActive ? (
              <text color={theme.text.secondary}>
                {t('Type to search · Enter to commit · Esc to clear')}
              </text>
            ) : (
              <>
                {currentBranch && (
                  <text color={theme.text.secondary}>
                    <text
                      bold={picker.filterByBranch}
                      color={
                        picker.filterByBranch ? theme.text.accent : undefined
                      }
                    >
                      Ctrl+B
                    </text>
                    {t(' to toggle branch · ')}
                  </text>
                )}
                {enablePreview && (
                  <text color={theme.text.secondary}>
                    {t('Space to preview · ')}
                  </text>
                )}
                {enableMultiSelect &&
                  (() => {
                    // Count every checked id that's also committable
                    // (not disabled) — regardless of whether the current
                    // filter happens to hide it. This is the exact set
                    // Enter will commit, so the footer can't drift from
                    // it (no more "0 selected" while the user has 3
                    // checks hidden by a search).
                    let committableCheckedCount = 0;
                    for (const id of picker.checkedIds) {
                      if (!picker.disabledIdSet.has(id)) {
                        committableCheckedCount++;
                      }
                    }
                    return (
                      <text color={theme.text.secondary}>
                        {committableCheckedCount > 0
                          ? t('Space to toggle · {{count}} selected · ', {
                              count: String(committableCheckedCount),
                            })
                          : t('Space to select multiple · ')}
                      </text>
                    );
                  })()}
                <text color={theme.text.secondary}>
                  {t('↑↓ to navigate · Type to search · Esc to cancel')}
                </text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
