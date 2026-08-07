/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { BtwProps } from '../../types.js';
import { Colors } from '../../colors.js';
import { t } from '../../../i18n/index.js';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';

export interface BtwDisplayProps {
  btw: BtwProps;
  /** Width of the parent container. Used to compute Markdown content width.
   *  Falls back to terminal width when not provided. */
  containerWidth?: number;
}

// border(1)*2 + paddingX(1)*2 = 4
const BTW_SELF_CHROME = 4;

/**
 * Ensure code fences (``` or ~~~) start on their own line so that
 * MarkdownDisplay's line-based parser can detect them.  Models sometimes
 * emit the opening fence right after prose text without a preceding newline.
 */
function normalizeCodeFences(text: string): string {
  return text.replace(/([^\n])(```|~~~)/g, '$1\n$2');
}

const BtwMessageInternal: React.FC<BtwDisplayProps> = ({
  btw,
  containerWidth,
}) => {
  const { columns: terminalWidth } = useTerminalSize();
  const baseWidth = containerWidth ?? terminalWidth;
  const contentWidth = Math.max(2, baseWidth - BTW_SELF_CHROME);

  return (
    <box style={{ flexDirection: "column", borderStyle: "round", borderColor: Colors.AccentYellow, width: "100%" }} paddingX={1}>
      <box style={{ flexDirection: "row" }}>
        <text color={Colors.AccentYellow} bold>
          {'/btw '}
        </text>
        <text wrap="wrap" color={Colors.AccentYellow}>
          {btw.question}
        </text>
      </box>
      {btw.isPending ? (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <box>
            <text color={Colors.AccentYellow}>{'+ '}</text>
            <text color={Colors.AccentYellow}>{t('Answering...')}</text>
          </box>
          <box marginTop={1}>
            <text dimColor>
              {t('Press Escape, Ctrl+C, or Ctrl+D to cancel')}
            </text>
          </box>
        </box>
      ) : (
        <box style={{ flexDirection: "column" }} marginTop={1}>
          <MarkdownDisplay
            text={normalizeCodeFences(btw.answer)}
            isPending={false}
            contentWidth={contentWidth}
          />
          <box marginTop={1}>
            <text dimColor>
              {t('Press Space, Enter, or Escape to dismiss')}
            </text>
          </box>
        </box>
      )}
    </box>
  );
};

export const BtwMessage = React.memo(BtwMessageInternal);
