/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { HistoryItem, HistoryItemUser } from '../types.js';
import { theme } from '../semantic-colors.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { keyMatchers, Command } from '../keyMatchers.js';
import { truncateText } from '../utils/sessionPickerUtils.js';
import { isRealUserTurn } from '../utils/historyMapping.js';
import { t } from '../../i18n/index.js';
import type { FileHistoryService, DiffStats } from '@qwen-code/qwen-code-core';

export type RestoreOption = 'both' | 'conversation' | 'code' | 'cancel';

export interface RewindSelectorProps {
  history: HistoryItem[];
  onRewind: (userItem: HistoryItem, option: RestoreOption) => void;
  onCancel: () => void;
  fileCheckpointingEnabled: boolean;
  fileHistoryService: FileHistoryService;
}

const MAX_VISIBLE_ITEMS = 7;

function getUserTurns(history: HistoryItem[]): HistoryItem[] {
  return history.filter(isRealUserTurn);
}

interface TurnItemViewProps {
  item: HistoryItem;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  showScrollUp: boolean;
  showScrollDown: boolean;
  maxPromptWidth: number;
  turnNumber: number;
}

function TurnItemView({
  item,
  isSelected,
  isFirst,
  isLast,
  showScrollUp,
  showScrollDown,
  maxPromptWidth,
  turnNumber,
}: TurnItemViewProps): React.JSX.Element {
  const showUpIndicator = isFirst && showScrollUp;
  const showDownIndicator = isLast && showScrollDown;

  const prefix = isSelected
    ? '› '
    : showUpIndicator
      ? '↑ '
      : showDownIndicator
        ? '↓ '
        : '  ';

  const promptText = item.text || '(empty prompt)';
  const truncatedPrompt = truncateText(promptText, maxPromptWidth);

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
          bold={isSelected}
        >
          {prefix}
        </text>
        <text color={theme.text.secondary}>{`#${turnNumber} `}</text>
        <text
          color={isSelected ? theme.text.accent : theme.text.primary}
          bold={isSelected}
        >
          {truncatedPrompt}
        </text>
      </box>
    </box>
  );
}

interface RestoreOptionItem {
  key: RestoreOption;
  label: string;
  detail?: string;
}

function getRestoreOptions(
  diffStats: DiffStats | undefined,
): RestoreOptionItem[] {
  const hasChanges = !!diffStats && diffStats.filesChanged.length > 0;

  const options: RestoreOptionItem[] = [];

  if (hasChanges) {
    const fileCount = diffStats!.filesChanged.length;
    const detail = t(
      fileCount === 1
        ? '(+{{insertions}} -{{deletions}} in {{count}} file)'
        : '(+{{insertions}} -{{deletions}} in {{count}} files)',
      {
        insertions: String(diffStats!.insertions),
        deletions: String(diffStats!.deletions),
        count: String(fileCount),
      },
    );
    options.push({
      key: 'both',
      label: t('Restore code and conversation'),
      detail,
    });
  }

  options.push({
    key: 'conversation',
    label: t('Restore conversation only'),
  });

  if (hasChanges) {
    options.push({
      key: 'code',
      label: t('Restore code only'),
    });
  }

  options.push({
    key: 'cancel',
    label: t('Never mind'),
  });

  return options;
}

/**
 * Multi-phase rewind selector:
 * 1. Pick list — choose which user turn to rewind to
 * 2. Restore options — choose what to restore (when file checkpointing enabled)
 * 3. Confirm — Y/N confirm (when file checkpointing disabled, legacy fallback)
 */
export function RewindSelector({
  history,
  onRewind,
  onCancel,
  fileCheckpointingEnabled,
  fileHistoryService,
}: RewindSelectorProps) {
  const { columns: width, rows: height } = useTerminalSize();
  const userTurns = useMemo(() => getUserTurns(history), [history]);

  const [selectedIndex, setSelectedIndex] = useState(userTurns.length - 1);
  // Legacy confirm (when file checkpointing is off)
  const [confirmItem, setConfirmItem] = useState<HistoryItem | null>(null);
  // Restore option phase (when file checkpointing is on)
  const [restoreItem, setRestoreItem] = useState<HistoryItem | null>(null);
  const [restoreOptionIndex, setRestoreOptionIndex] = useState(0);
  const [diffStats, setDiffStats] = useState<DiffStats | undefined>(undefined);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const boxWidth = width - 4;
  const maxVisibleItems = Math.min(MAX_VISIBLE_ITEMS, userTurns.length);

  const scrollOffset = useMemo(() => {
    if (userTurns.length <= maxVisibleItems) return 0;
    const halfVisible = Math.floor(maxVisibleItems / 2);
    let offset = selectedIndex - halfVisible;
    offset = Math.max(0, offset);
    offset = Math.min(userTurns.length - maxVisibleItems, offset);
    return offset;
  }, [userTurns.length, maxVisibleItems, selectedIndex]);

  const visibleTurns = useMemo(
    () => userTurns.slice(scrollOffset, scrollOffset + maxVisibleItems),
    [userTurns, scrollOffset, maxVisibleItems],
  );
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxVisibleItems < userTurns.length;

  const restoreOptions = useMemo(
    () => getRestoreOptions(diffStats),
    [diffStats],
  );

  // Load diff stats when entering restore option phase
  useEffect(() => {
    if (!restoreItem || !fileCheckpointingEnabled) return;
    const promptId = (restoreItem as HistoryItemUser).promptId;
    if (!promptId) {
      setDiffStats(undefined);
      setLoadingDiff(false);
      return;
    }
    let cancelled = false;
    setLoadingDiff(true);
    fileHistoryService
      .getDiffStats(promptId)
      .then((stats) => {
        if (!cancelled) {
          setDiffStats(stats);
          setRestoreOptionIndex(0);
          setLoadingDiff(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiffStats(undefined);
          setRestoreOptionIndex(0);
          setLoadingDiff(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restoreItem, fileCheckpointingEnabled, fileHistoryService]);

  // Legacy confirm handler
  const handleConfirmSelect = useCallback(
    (confirmed: boolean) => {
      if (confirmed && confirmItem) {
        setIsRestoring(true);
        Promise.resolve(onRewind(confirmItem, 'conversation'))
          .catch(() => {})
          .finally(() => setIsRestoring(false));
      } else {
        setConfirmItem(null);
      }
    },
    [confirmItem, onRewind],
  );

  // Pick-list key handler
  useKeypress(
    (key) => {
      const { name, ctrl } = key;

      if (name === 'escape' || (ctrl && name === 'c')) {
        onCancel();
        return;
      }

      if (name === 'return') {
        const selected = userTurns[selectedIndex];
        if (selected) {
          if (fileCheckpointingEnabled) {
            setRestoreItem(selected);
            setRestoreOptionIndex(0);
          } else {
            setConfirmItem(selected);
          }
        }
        return;
      }

      if (keyMatchers[Command.SELECTION_UP](key)) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (keyMatchers[Command.SELECTION_DOWN](key)) {
        setSelectedIndex((prev) => Math.min(userTurns.length - 1, prev + 1));
        return;
      }
    },
    { isActive: confirmItem === null && restoreItem === null },
  );

  // Restore option key handler
  useKeypress(
    (key) => {
      if (isRestoring) return;

      const { name, ctrl } = key;

      if (name === 'escape' || (ctrl && name === 'c')) {
        setRestoreItem(null);
        setDiffStats(undefined);
        return;
      }

      if (loadingDiff) return;

      if (name === 'return') {
        const option = restoreOptions[restoreOptionIndex];
        if (option) {
          if (option.key === 'cancel') {
            setRestoreItem(null);
            setDiffStats(undefined);
          } else {
            setIsRestoring(true);
            Promise.resolve(onRewind(restoreItem!, option.key))
              .catch(() => {})
              .finally(() => setIsRestoring(false));
          }
        }
        return;
      }

      if (name === 'up' || name === 'k') {
        setRestoreOptionIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (name === 'down' || name === 'j') {
        setRestoreOptionIndex((prev) =>
          Math.min(restoreOptions.length - 1, prev + 1),
        );
        return;
      }
    },
    { isActive: restoreItem !== null },
  );

  // Legacy confirm key handler
  useKeypress(
    (key) => {
      if (isRestoring) return;

      const { name, ctrl, sequence } = key;

      if (name === 'escape' || (ctrl && name === 'c')) {
        setConfirmItem(null);
        return;
      }

      if (name === 'return' || sequence === 'y' || sequence === 'Y') {
        handleConfirmSelect(true);
        return;
      }

      if (sequence === 'n' || sequence === 'N') {
        handleConfirmSelect(false);
        return;
      }
    },
    { isActive: confirmItem !== null },
  );

  if (userTurns.length === 0) {
    return (
      <box style={{ flexDirection: "column", width: boxWidth }}>
        <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth }}>
          <box paddingX={1}>
            <text color={theme.text.secondary}>
              {t('No user turns to rewind to.')}
            </text>
          </box>
        </box>
      </box>
    );
  }

  // Restore option phase
  if (restoreItem) {
    const promptPreview = truncateText(
      restoreItem.text || '(empty)',
      boxWidth - 10,
    );
    return (
      <box style={{ flexDirection: "column", width: boxWidth }}>
        <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth }}>
          <box paddingX={1}>
            <text bold color={theme.text.primary}>
              {t('Rewind Conversation')}
            </text>
          </box>
          <box>
            <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
          </box>
          <box paddingX={1} style={{ flexDirection: "column" }}>
            <box marginBottom={1}>
              <text color={theme.text.primary}>{t('Rewind to: ')}</text>
              <text color={theme.text.accent} bold>
                {promptPreview}
              </text>
            </box>
            {loadingDiff ? (
              <text color={theme.text.secondary}>
                {t('Computing file changes...')}
              </text>
            ) : isRestoring ? (
              <text color={theme.text.secondary}>{t('Restoring...')}</text>
            ) : (
              <box style={{ flexDirection: "column" }}>
                {restoreOptions.map((option, idx) => {
                  const isSelected = idx === restoreOptionIndex;
                  const prefix = isSelected ? '› ' : '  ';
                  return (
                    <box key={option.key}>
                      <text
                        color={
                          isSelected ? theme.text.accent : theme.text.primary
                        }
                        bold={isSelected}
                      >
                        {prefix}
                        {option.label}
                      </text>
                      {option.detail && (
                        <text color={theme.text.secondary}>
                          {' '}
                          {option.detail}
                        </text>
                      )}
                    </box>
                  );
                })}
                {restoreOptions.some(
                  (o) => o.key === 'code' || o.key === 'both',
                ) ? (
                  <box marginTop={1}>
                    <text color={theme.text.secondary} dimColor>
                      {t(
                        'Rewinding does not affect files edited manually or via shell commands.',
                      )}
                    </text>
                  </box>
                ) : (
                  // No file-restore options were offered. Most likely either
                  // (a) the chosen turn has no captured edits, or (b) the
                  // turn predates this process / came from a resumed session
                  // whose snapshots were not rehydrated. Either way the
                  // "Restore code" path is not actionable for this turn —
                  // surface that explicitly so the user is not left
                  // wondering why the option is missing.
                  <box marginTop={1}>
                    <text color={theme.text.secondary} dimColor>
                      {t(
                        'File restore is unavailable for this turn (no captured file changes, or this turn predates the current session).',
                      )}
                    </text>
                  </box>
                )}
              </box>
            )}
          </box>
          <box>
            <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
          </box>
          <box paddingX={1}>
            <text color={theme.text.secondary}>
              {t('↑↓ to navigate · Enter to select · Esc to go back')}
            </text>
          </box>
        </box>
      </box>
    );
  }

  // Legacy confirm phase (when file checkpointing is off)
  if (confirmItem) {
    const promptPreview = truncateText(
      confirmItem.text || '(empty)',
      boxWidth - 10,
    );
    return (
      <box style={{ flexDirection: "column", width: boxWidth }}>
        <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth }}>
          <box paddingX={1}>
            <text bold color={theme.text.primary}>
              {t('Rewind Conversation')}
            </text>
          </box>
          <box>
            <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
          </box>
          <box paddingX={1} style={{ flexDirection: "column" }}>
            <box marginBottom={1}>
              <text color={theme.text.primary}>{t('Rewind to: ')}</text>
              <text color={theme.text.accent} bold>
                {promptPreview}
              </text>
            </box>
            <text color={theme.status.warning}>
              {t(
                'This will remove all conversation after this turn. The prompt will be pre-populated in the input for editing.',
              )}
            </text>
          </box>
          <box>
            <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
          </box>
          <box paddingX={1}>
            <text color={theme.text.secondary}>
              {t('Enter/Y to confirm · Esc/N to go back')}
            </text>
          </box>
        </box>
      </box>
    );
  }

  // Pick-list phase
  return (
    <box style={{ flexDirection: "column", width: boxWidth, height: height - 1 }} overflow="hidden">
      <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.border.default, width: boxWidth, height: height - 1 }} overflow="hidden">
        {/* Header */}
        <box paddingX={1}>
          <text bold color={theme.text.primary}>
            {t('Rewind Conversation')}
          </text>
          <text color={theme.text.secondary}>
            {' '}
            {t('({{count}} turns)', { count: String(userTurns.length) })}
          </text>
        </box>

        {/* Separator */}
        <box>
          <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
        </box>

        {/* Turn list */}
        <box style={{ flexDirection: "column", flexGrow: 1 }} paddingX={1} overflow="hidden">
          {visibleTurns.map((item, visibleIndex) => {
            const actualIndex = scrollOffset + visibleIndex;
            return (
              <TurnItemView
                key={item.id}
                item={item}
                isSelected={actualIndex === selectedIndex}
                isFirst={visibleIndex === 0}
                isLast={visibleIndex === visibleTurns.length - 1}
                showScrollUp={showScrollUp}
                showScrollDown={showScrollDown}
                maxPromptWidth={boxWidth - 10}
                turnNumber={actualIndex + 1}
              />
            );
          })}
        </box>

        {/* Separator */}
        <box>
          <text color={theme.border.default}>{'─'.repeat(boxWidth - 2)}</text>
        </box>

        {/* Footer */}
        <box paddingX={1}>
          <text color={theme.text.secondary}>
            {t('↑↓ to navigate · Enter to select · Esc to cancel')}
          </text>
        </box>
      </box>
    </box>
  );
}
