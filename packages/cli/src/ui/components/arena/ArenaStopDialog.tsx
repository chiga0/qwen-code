/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  ArenaSessionStatus,
  createDebugLogger,
  type Config,
} from '@qwen-code/qwen-code-core';
import { theme } from '../../semantic-colors.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import { MessageType, type HistoryItemWithoutId } from '../../types.js';
import type { UseHistoryManagerReturn } from '../../hooks/useHistoryManager.js';
import { DescriptiveRadioButtonSelect } from '../shared/DescriptiveRadioButtonSelect.js';
import type { DescriptiveRadioSelectItem } from '../shared/DescriptiveRadioButtonSelect.js';

const debugLogger = createDebugLogger('ARENA_STOP_DIALOG');

type StopAction = 'cleanup' | 'preserve';

interface ArenaStopDialogProps {
  config: Config;
  addItem: UseHistoryManagerReturn['addItem'];
  closeArenaDialog: () => void;
}

export function ArenaStopDialog({
  config,
  addItem,
  closeArenaDialog,
}: ArenaStopDialogProps): React.JSX.Element {
  const [isProcessing, setIsProcessing] = useState(false);

  const pushMessage = useCallback(
    (result: { messageType: 'info' | 'error'; content: string }) => {
      const item: HistoryItemWithoutId = {
        type:
          result.messageType === 'info' ? MessageType.INFO : MessageType.ERROR,
        text: result.content,
      };
      addItem(item, Date.now());

      try {
        const chatRecorder = config.getChatRecordingService();
        chatRecorder?.recordSlashCommand({
          phase: 'result',
          rawCommand: '/arena stop',
          outputHistoryItems: [{ ...item } as Record<string, unknown>],
        });
      } catch {
        // Best-effort recording
      }
    },
    [addItem, config],
  );

  const onStop = useCallback(
    async (action: StopAction) => {
      if (isProcessing) return;
      setIsProcessing(true);
      closeArenaDialog();

      const mgr = config.getArenaManager();
      if (!mgr) {
        pushMessage({
          messageType: 'error',
          content: 'No running Arena session found.',
        });
        return;
      }

      try {
        const sessionStatus = mgr.getSessionStatus();
        if (
          sessionStatus === ArenaSessionStatus.RUNNING ||
          sessionStatus === ArenaSessionStatus.INITIALIZING
        ) {
          pushMessage({
            messageType: 'info',
            content: 'Stopping Arena agents…',
          });
          await mgr.cancel();
        }
        await mgr.waitForSettled();
        pushMessage({
          messageType: 'info',
          content: 'Cleaning up Arena resources…',
        });

        if (action === 'preserve') {
          await mgr.cleanupRuntime();
        } else {
          await mgr.cleanup();
        }
        config.setArenaManager(null);

        if (action === 'preserve') {
          pushMessage({
            messageType: 'info',
            content:
              'Arena session stopped. Worktrees and session files were preserved. ' +
              'Use /arena select --discard to manually clean up later.',
          });
        } else {
          pushMessage({
            messageType: 'info',
            content:
              'Arena session stopped. All Arena resources (including Git worktrees) were cleaned up.',
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        debugLogger.error('Failed to stop Arena session:', error);
        pushMessage({
          messageType: 'error',
          content: `Failed to stop Arena session: ${message}`,
        });
      }
    },
    [isProcessing, closeArenaDialog, config, pushMessage],
  );

  const configPreserve =
    config.getAgentsSettings().arena?.preserveArtifacts ?? false;

  const items: Array<DescriptiveRadioSelectItem<StopAction>> = useMemo(
    () => [
      {
        key: 'cleanup',
        value: 'cleanup' as StopAction,
        title: <text>Stop and clean up</text>,
        description: (
          <text color={theme.text.secondary}>
            Remove all worktrees and session files
          </text>
        ),
      },
      {
        key: 'preserve',
        value: 'preserve' as StopAction,
        title: <text>Stop and preserve artifacts</text>,
        description: (
          <text color={theme.text.secondary}>
            Keep worktrees and session files for later inspection
          </text>
        ),
      },
    ],
    [],
  );

  const defaultIndex = configPreserve ? 1 : 0;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        closeArenaDialog();
      }
    },
    { isActive: !isProcessing },
  );

  return (
    <box style={{ borderStyle: "round", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
      <text bold color={theme.text.primary}>
        Stop Arena Session
      </text>

      <box marginTop={1}>
        <text color={theme.text.secondary}>
          Choose what to do with Arena artifacts:
        </text>
      </box>

      <box marginTop={1} style={{ flexDirection: "column" }}>
        <DescriptiveRadioButtonSelect
          items={items}
          initialIndex={defaultIndex}
          onSelect={(action: StopAction) => {
            onStop(action);
          }}
          isFocused={!isProcessing}
          showNumbers={false}
        />
      </box>

      {configPreserve && (
        <box marginTop={1}>
          <text color={theme.text.secondary} dimColor>
            Default: preserve (agents.arena.preserveArtifacts is enabled)
          </text>
        </box>
      )}

      <box marginTop={1}>
        <text color={theme.text.secondary}>
          Enter to confirm, Esc to cancel
        </text>
      </box>
    </box>
  );
}
