/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DaemonTranscriptBlock,
  DaemonToolTranscriptBlock,
} from '@qwen-code/sdk/daemon';
import type { UnifiedMessage } from '../adapters/types.js';
import type {
  ToolCallData,
  ToolCallStatus,
} from '../components/toolcalls/shared/index.js';

export function daemonTranscriptToUnifiedMessages(
  blocks: readonly DaemonTranscriptBlock[],
): UnifiedMessage[] {
  const visibleBlocks = blocks.filter(
    (block) => block.kind !== 'debug' && block.kind !== 'status',
  );
  return visibleBlocks.flatMap((block, index, arr): UnifiedMessage[] => {
    const prev = arr[index - 1];
    const next = arr[index + 1];
    const isFirst = !prev || prev.kind === 'user';
    const isLast = !next || next.kind === 'user';
    const timestamp = block.createdAt;

    switch (block.kind) {
      case 'user':
        return [
          {
            id: block.id,
            type: 'user',
            timestamp,
            content: block.text,
            isFirst,
            isLast,
          },
        ];
      case 'assistant':
        return [
          {
            id: block.id,
            type: 'assistant',
            timestamp,
            content: block.text,
            isFirst,
            isLast,
          },
        ];
      case 'thought':
        return [
          {
            id: block.id,
            type: 'thinking',
            timestamp,
            content: block.text,
            isFirst,
            isLast,
          },
        ];
      case 'tool':
        return [
          {
            id: block.id,
            type: 'tool_call',
            timestamp,
            toolCall: daemonToolBlockToToolCallData(block),
            isFirst,
            isLast,
          },
        ];
      case 'permission':
        return [
          {
            id: block.id,
            type: 'tool_call',
            timestamp,
            toolCall: {
              toolCallId: block.requestId,
              kind: 'permission',
              title: block.title,
              status: block.resolved ? 'completed' : 'pending',
              rawInput: block.toolCall as object | undefined,
            },
            isFirst,
            isLast,
          },
        ];
      case 'shell':
        return [
          {
            id: block.id,
            type: 'tool_call',
            timestamp,
            toolCall: {
              toolCallId: block.id,
              kind: 'bash',
              title: 'Shell output',
              status: 'completed',
              rawOutput: block.text,
            },
            isFirst,
            isLast,
          },
        ];
      case 'error':
        return [
          {
            id: block.id,
            type: 'tool_call',
            timestamp,
            toolCall: {
              toolCallId: block.id,
              kind: 'system_error',
              title: 'System error',
              status: 'failed',
              rawOutput: block.text,
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'error',
                    text: block.text,
                    error: block.text,
                  },
                },
              ],
            },
            isFirst,
            isLast,
          },
        ];
      default:
        return [];
    }
  });
}

function daemonToolBlockToToolCallData(
  block: DaemonToolTranscriptBlock,
): ToolCallData {
  return {
    toolCallId: block.toolCallId,
    kind: block.toolKind ?? block.toolName ?? 'tool',
    title: block.title,
    status: normalizeToolStatus(block.status),
    rawInput: block.rawInput as object | string | undefined,
    rawOutput: block.rawOutput,
  };
}

function normalizeToolStatus(status: string): ToolCallStatus {
  switch (status) {
    case 'pending':
    case 'confirming':
      return 'pending';
    case 'in_progress':
    case 'running':
      return 'in_progress';
    case 'completed':
    case 'success':
      return 'completed';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'in_progress';
  }
}
