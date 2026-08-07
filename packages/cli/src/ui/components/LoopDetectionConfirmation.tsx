/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type { RadioSelectItem } from './shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';

export type LoopDetectionConfirmationResult = {
  userSelection: 'disable' | 'keep';
};

interface LoopDetectionConfirmationProps {
  onComplete: (result: LoopDetectionConfirmationResult) => void;
}

export function LoopDetectionConfirmation({
  onComplete,
}: LoopDetectionConfirmationProps) {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onComplete({
          userSelection: 'keep',
        });
      }
    },
    { isActive: true },
  );

  const OPTIONS: Array<RadioSelectItem<LoopDetectionConfirmationResult>> = [
    {
      label: 'Keep loop detection enabled (esc)',
      value: {
        userSelection: 'keep',
      },
      key: 'Keep loop detection enabled (esc)',
    },
    {
      label: 'Disable loop detection for this session',
      value: {
        userSelection: 'disable',
      },
      key: 'Disable loop detection for this session',
    },
  ];

  return (
    <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.status.warning, width: "100%" }} marginLeft={1}>
      <box paddingX={1} paddingY={0} style={{ flexDirection: "column" }}>
        <box minHeight={1}>
          <box minWidth={3}>
            <text color={theme.status.warning} aria-label="Loop detected:">
              ?
            </text>
          </box>
          <box>
            <text wrap="truncate-end">
              <text color={theme.text.primary} bold>
                A potential loop was detected
              </text>{' '}
            </text>
          </box>
        </box>
        <box style={{ width: "100%" }} marginTop={1}>
          <box style={{ flexDirection: "column" }}>
            <text color={theme.text.secondary}>
              This can happen due to repetitive tool calls or other model
              behavior. Do you want to keep loop detection enabled or disable it
              for this session?
            </text>
            <box marginTop={1}>
              <RadioButtonSelect items={OPTIONS} onSelect={onComplete} />
            </box>
            <box marginTop={1}>
              <text color={theme.text.secondary}>
                Note: Setting &quot;model.skipLoopDetection&quot; to true in
                your settings.json disables only the heuristic loop checks for
                future sessions; the always-on guards (consecutive identical
                tool calls, repeated shell inspection commands, and the per-turn
                tool-call cap) are not affected by it. The cap is tunable via
                &quot;model.maxToolCallsPerTurn&quot; (0 disables it). Disabling
                for this session above suppresses everything.
              </text>
            </box>
          </box>
        </box>
      </box>
    </box>
  );
}
