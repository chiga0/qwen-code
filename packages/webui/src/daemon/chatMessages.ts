/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DaemonTranscriptBlock,
  DaemonTranscriptQuestion,
  DaemonToolTranscriptBlock,
} from '@qwen-code/sdk/daemon';
import type {
  ChatMessageData,
  ToolCallData as ChatViewerToolCallData,
} from '../components/ChatViewer/index.js';

export function daemonBlocksToChatMessages(
  blocks: readonly DaemonTranscriptBlock[],
): ChatMessageData[] {
  const visibleBlocks = blocks.filter(
    (block) => block.kind !== 'debug' && block.kind !== 'status',
  );

  return visibleBlocks.flatMap((block, index, allBlocks): ChatMessageData[] => {
    const timestamp = new Date(block.createdAt).toISOString();
    const base = {
      uuid: block.id,
      timestamp,
      sessionId: undefined,
    };

    switch (block.kind) {
      case 'user':
        return [
          {
            ...base,
            type: 'user' as const,
            message: {
              role: 'user',
              parts: [{ text: block.text }],
            },
          },
        ];
      case 'assistant':
        return [
          {
            ...base,
            type: 'assistant' as const,
            message: {
              role: 'assistant',
              parts: [{ text: block.text }],
            },
          },
        ];
      case 'thought':
        return [
          {
            ...base,
            type: 'assistant' as const,
            message: {
              role: 'thinking',
              parts: [{ text: block.text }],
            },
          },
        ];
      case 'tool':
        return [
          {
            ...base,
            type: 'tool_call' as const,
            toolCall: daemonToolBlockToToolCall(block),
          },
        ];
      case 'permission':
        return [
          {
            ...base,
            type: 'tool_call' as const,
            toolCall: {
              toolCallId: block.requestId,
              kind: 'permission',
              title: block.title,
              status: block.resolved ? 'completed' : 'pending',
              rawInput: {
                options: block.options,
                toolCall: block.toolCall,
              },
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'text',
                    text: permissionSummary(block),
                  },
                },
              ],
            },
          },
        ];
      case 'shell':
        return [
          {
            ...base,
            type: 'tool_call' as const,
            toolCall: {
              toolCallId: block.id,
              kind: 'bash',
              title: block.stream ? `Shell ${block.stream}` : 'Shell output',
              status: 'completed',
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'text',
                    text: block.text,
                  },
                },
              ],
            },
          },
        ];
      case 'error':
        return [
          {
            ...base,
            type: 'assistant' as const,
            message: {
              role: 'assistant',
              parts: [{ text: `Error: ${block.text}` }],
            },
          },
        ];
      default:
        return index < allBlocks.length ? [] : [];
    }
  });
}

function daemonToolBlockToToolCall(
  block: DaemonToolTranscriptBlock,
): ChatViewerToolCallData {
  const outputText =
    block.rawOutput === undefined
      ? undefined
      : typeof block.rawOutput === 'string'
        ? block.rawOutput
        : stringifyDaemonChatJson(block.rawOutput);

  return {
    toolCallId: block.toolCallId,
    kind:
      block.preview.kind === 'ask_user_question'
        ? 'ask_user_question'
        : (block.toolKind ?? block.toolName ?? 'tool'),
    title: block.title,
    status: normalizeStatus(block.status),
    rawInput:
      block.preview.kind === 'ask_user_question'
        ? undefined
        : normalizeRawInput(block.rawInput),
    rawOutput: block.rawOutput,
    content:
      block.preview.kind === 'ask_user_question'
        ? [
            {
              type: 'content',
              content: {
                type: 'text',
                text: formatAskUserQuestions(block.preview.questions),
              },
            },
          ]
        : outputText
          ? [
              {
                type: 'content',
                content: {
                  type:
                    normalizeStatus(block.status) === 'failed'
                      ? 'error'
                      : 'text',
                  text: outputText,
                },
              },
            ]
          : undefined,
  };
}

function normalizeRawInput(rawInput: unknown): string | object | undefined {
  if (rawInput === undefined) return undefined;
  if (typeof rawInput === 'string') return rawInput;
  if (rawInput && typeof rawInput === 'object') return rawInput;
  return stringifyDaemonChatJson(rawInput);
}

function normalizeStatus(status: string): ChatViewerToolCallData['status'] {
  switch (status) {
    case 'pending':
    case 'confirming':
      return 'pending';
    case 'running':
    case 'in_progress':
      return 'in_progress';
    case 'success':
    case 'completed':
    case 'cancelled':
    case 'canceled':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

function permissionSummary(
  block: Extract<DaemonTranscriptBlock, { kind: 'permission' }>,
): string {
  if (block.resolved) {
    return `Resolved: ${block.resolved}`;
  }
  const labels = block.options
    .map((option) =>
      option.description
        ? `${option.label}: ${option.description}`
        : option.label,
    )
    .join('\n');
  return labels ? `Waiting for approval:\n${labels}` : 'Waiting for approval';
}

function formatAskUserQuestions(
  questions: readonly DaemonTranscriptQuestion[],
): string {
  return questions
    .map((question, index) => {
      const header = question.header ? `${question.header}: ` : '';
      const options =
        question.options.length > 0
          ? question.options
              .map((option) =>
                option.description
                  ? `- ${option.label}: ${option.description}`
                  : `- ${option.label}`,
              )
              .join('\n')
          : '- Free-form answer';
      return `${index + 1}. ${header}${question.question}\n${options}`;
    })
    .join('\n\n');
}

function stringifyDaemonChatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
