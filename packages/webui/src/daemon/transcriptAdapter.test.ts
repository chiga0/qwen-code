/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { DaemonTranscriptBlock } from '@qwen-code/sdk/daemon';
import { daemonTranscriptToUnifiedMessages } from './transcriptAdapter.js';

describe('daemonTranscriptToUnifiedMessages', () => {
  it('keeps system errors separate from assistant messages', () => {
    const [message] = daemonTranscriptToUnifiedMessages([
      {
        id: 'error-1',
        kind: 'error',
        text: 'SSE stream error',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(message).toMatchObject({
      type: 'tool_call',
      toolCall: {
        kind: 'system_error',
        status: 'failed',
        rawOutput: 'SSE stream error',
      },
    });
  });

  it('preserves cancelled and unknown daemon tool statuses', () => {
    const messages = daemonTranscriptToUnifiedMessages([
      createToolBlock('cancelled-tool', 'cancelled'),
      createToolBlock('future-tool', 'waiting_for_input'),
    ]);

    expect(messages.map((message) => message.toolCall?.status)).toEqual([
      'cancelled',
      'in_progress',
    ]);
  });

  it('computes grouping after filtering debug and status blocks', () => {
    const messages = daemonTranscriptToUnifiedMessages([
      {
        id: 'user-1',
        kind: 'user',
        text: 'hi',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'status-1',
        kind: 'status',
        text: 'connecting',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'assistant-1',
        kind: 'assistant',
        text: 'hello',
        createdAt: 3,
        updatedAt: 3,
      },
    ]);

    expect(messages).toMatchObject([
      { id: 'user-1', isFirst: true, isLast: false },
      { id: 'assistant-1', isFirst: true, isLast: true },
    ]);
  });
});

function createToolBlock(
  toolCallId: string,
  status: string,
): Extract<DaemonTranscriptBlock, { kind: 'tool' }> {
  return {
    id: toolCallId,
    kind: 'tool',
    toolCallId,
    title: 'Tool',
    status,
    preview: { kind: 'generic' },
    createdAt: 1,
    updatedAt: 1,
  };
}
