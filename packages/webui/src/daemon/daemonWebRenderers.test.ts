/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  createDaemonTranscriptStore,
  transcriptBlockToTerminalText,
  type DaemonTranscriptBlock,
} from '../../../sdk-typescript/src/daemon/index.js';
import { createDaemonWebFixtureEvents } from './fixtures.js';
import { daemonBlocksToChatMessages } from './chatMessages.js';

describe('daemon web shared dependencies', () => {
  it('uses the shared daemon UI core and React adapter packages', () => {
    const store = createDaemonTranscriptStore();
    store.dispatch({ type: 'assistant.text.delta', text: 'hello' });

    const [block] = store.getSnapshot().blocks;

    expect(block?.kind).toBe('assistant');
    expect(block ? transcriptBlockToTerminalText(block) : '').toContain(
      'hello',
    );
  });

  it('maps AskUserQuestion tools to readable chat content instead of raw JSON', () => {
    const [message] = daemonBlocksToChatMessages([
      {
        id: 'tool-1',
        kind: 'tool',
        toolCallId: 'call-1',
        title: 'Ask user 1 question',
        status: 'pending',
        preview: {
          kind: 'ask_user_question',
          questions: [
            {
              header: 'City',
              question: 'Which city should I check?',
              options: [
                {
                  label: 'Beijing',
                  description: 'Check Beijing weather',
                  raw: {},
                },
                { label: 'Shanghai', raw: {} },
              ],
              raw: {},
            },
          ],
        },
        rawInput: {
          questions: [{ question: 'Which city should I check?' }],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ] satisfies DaemonTranscriptBlock[]);

    expect(message?.type).toBe('tool_call');
    expect(message?.toolCall?.kind).toBe('ask_user_question');
    expect(message?.toolCall?.rawInput).toBeUndefined();
    const text = getFirstToolContentText(message?.toolCall?.content);
    expect(text).toContain('City: Which city should I check?');
    expect(text).toContain('- Beijing: Check Beijing weather');
  });

  it('keeps permission requests compact and actionable for the renderer', () => {
    const [message] = daemonBlocksToChatMessages([
      {
        id: 'permission-1',
        kind: 'permission',
        requestId: 'request-1',
        title: 'Run shell command',
        options: [
          {
            optionId: 'allow_once',
            label: 'Allow once',
            description: 'Run only this command',
            raw: {},
          },
        ],
        preview: { kind: 'command', command: 'pwd' },
        createdAt: 1,
        updatedAt: 1,
      },
    ] satisfies DaemonTranscriptBlock[]);

    expect(message?.type).toBe('tool_call');
    expect(message?.toolCall?.status).toBe('pending');
    expect(getFirstToolContentText(message?.toolCall?.content)).toContain(
      'Allow once: Run only this command',
    );
  });

  it('loads a representative fixture through the shared transcript store', () => {
    const store = createDaemonTranscriptStore();
    store.dispatch(createDaemonWebFixtureEvents());

    const kinds = store.getSnapshot().blocks.map((block) => block.kind);

    expect(kinds).toContain('user');
    expect(kinds).toContain('assistant');
    expect(kinds).toContain('thought');
    expect(kinds).toContain('tool');
    expect(kinds).toContain('permission');
    expect(kinds).toContain('shell');
  });
});

function getFirstToolContentText(
  content:
    | NonNullable<
        NonNullable<
          ReturnType<typeof daemonBlocksToChatMessages>[number]['toolCall']
        >['content']
      >
    | undefined,
): string | undefined {
  const first = content?.[0]?.content;
  return first && 'text' in first ? first.text : undefined;
}
