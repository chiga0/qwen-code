/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DaemonTranscriptStore,
  DaemonUiEvent,
} from '@qwen-code/sdk/daemon';

export function createDaemonWebFixtureEvents(): DaemonUiEvent[] {
  return [
    {
      type: 'user.text.delta',
      text: 'Show me a daemon web UI fixture with tools and approvals.',
      eventId: 1,
    },
    {
      type: 'thought.text.delta',
      text: 'Preparing a compact transcript fixture that exercises chat, terminal, tools, and permissions.',
      eventId: 2,
    },
    {
      type: 'assistant.text.delta',
      text: 'This fixture is rendered entirely from normalized daemon UI events. It should look like a real agent run without requiring a live model response.',
      eventId: 3,
    },
    {
      type: 'assistant.done',
      reason: 'stop',
      eventId: 4,
    },
    {
      type: 'tool.update',
      toolCallId: 'fixture-ask-user',
      title: 'Ask user 1 question',
      toolName: 'AskUserQuestion',
      toolKind: 'ask_user_question',
      status: 'pending',
      rawInput: {
        questions: [
          {
            header: 'City',
            question: 'Which city should the weather check use?',
            options: [
              {
                label: 'Beijing',
                description: 'Check Beijing weather.',
              },
              {
                label: 'Shanghai',
                description: 'Check Shanghai weather.',
              },
              {
                label: 'Hangzhou',
                description: 'Check Hangzhou weather.',
              },
            ],
          },
        ],
      },
      eventId: 5,
    },
    {
      type: 'permission.request',
      requestId: 'fixture-permission',
      title: 'Run shell command',
      options: [
        {
          optionId: 'proceed_once',
          label: 'Allow once',
          description: 'Run this command for the current request.',
          raw: {},
        },
        {
          optionId: 'cancel',
          label: 'Deny',
          description: 'Do not run the command.',
          raw: {},
        },
      ],
      toolCall: {
        name: 'ShellTool',
        command: 'pwd && ls packages/webui/src/daemon',
      },
      eventId: 6,
    },
    {
      type: 'tool.update',
      toolCallId: 'fixture-shell',
      title: 'Run shell command',
      toolName: 'ShellTool',
      toolKind: 'bash',
      status: 'running',
      rawInput: {
        command: 'pwd && ls packages/webui/src/daemon',
        cwd: '/workspace/qwen-code',
      },
      eventId: 7,
    },
    {
      type: 'shell.output',
      stream: 'stdout',
      text: '/workspace/qwen-code\nApp.tsx\ncomponents\nfixtures.ts\n',
      eventId: 8,
    },
    {
      type: 'tool.update',
      toolCallId: 'fixture-shell',
      title: 'Run shell command',
      toolName: 'ShellTool',
      toolKind: 'bash',
      status: 'completed',
      rawOutput: 'Listed daemon web source files.',
      eventId: 9,
    },
    {
      type: 'status',
      text: 'Fixture loaded. Expand inspector rows to see raw transcript blocks.',
      eventId: 10,
    },
  ];
}

export function loadDaemonWebFixture(store: DaemonTranscriptStore): void {
  store.reset();
  store.dispatch(createDaemonWebFixtureEvents());
}
