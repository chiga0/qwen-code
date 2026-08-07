/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { ScreenReaderAppLayout } from './ScreenReaderAppLayout.js';
import { UIStateContext, type UIState } from '../contexts/UIStateContext.js';
import { StreamingState } from '../types.js';

const dialogManagerMockState = vi.hoisted(() => ({ lineCount: 1 }));

vi.mock('../components/Notifications.js', () => ({
  Notifications: () => <text>Notifications</text>,
}));

vi.mock('../components/MainContent.js', () => ({
  MainContent: () => <text>MainContent</text>,
}));

vi.mock('../components/UpdateNotification.js', () => ({
  UpdateNotification: ({ message }: { message: string }) => (
    <text>{`UpdateNotification: ${message}`}</text>
  ),
}));

vi.mock('../components/DialogManager.js', () => ({
  DialogManager: () => (
    <text>
      {Array.from(
        { length: dialogManagerMockState.lineCount },
        (_, i) => `DialogManager ${i + 1}`,
      ).join('\n')}
    </text>
  ),
}));

vi.mock('../components/Composer.js', () => ({
  Composer: () => <text>Composer</text>,
}));

vi.mock('../components/Footer.js', () => ({
  Footer: () => <text>Footer</text>,
}));

vi.mock('../components/ExitWarning.js', () => ({
  ExitWarning: () => <text>ExitWarning</text>,
}));

vi.mock('../components/messages/BtwMessage.js', () => ({
  BtwMessage: () => <text>BtwMessage</text>,
}));

vi.mock('../components/StickyTodoList.js', () => ({
  StickyTodoList: () => <text>StickyTodoList</text>,
}));

const baseUIState: Partial<UIState> = {
  dialogsVisible: false,
  isFeedbackDialogOpen: false,
  mainAreaWidth: 80,
  terminalWidth: 80,
  terminalHeight: 24,
  staticExtraHeight: 0,
  constrainHeight: true,
  streamingState: StreamingState.Responding,
  historyManager: {
    addItem: vi.fn(),
    history: [],
    updateItem: vi.fn(),
    clearItems: vi.fn(),
    loadHistory: vi.fn(),
    truncateToItem: vi.fn(),
    compactOldItems: vi.fn(),
  },
  stickyTodos: [
    {
      id: 'todo-1',
      content: 'Pinned task',
      status: 'pending',
    },
  ],
  btwItem: null,
};

const renderLayout = (uiState: Partial<UIState>) =>
  render(
    <UIStateContext.Provider value={uiState as UIState}>
      <ScreenReaderAppLayout />
    </UIStateContext.Provider>,
  );

function frameHeight(frame: string): number {
  return frame.length === 0 ? 0 : frame.split('\n').length;
}

describe('ScreenReaderAppLayout', () => {
  beforeEach(() => {
    dialogManagerMockState.lineCount = 1;
  });

  it('renders sticky todo list before the composer', () => {
    const { lastFrame } = renderLayout(baseUIState);
    const output = lastFrame() ?? '';

    expect(output).toContain('StickyTodoList');
    expect(output.indexOf('StickyTodoList')).toBeGreaterThan(
      output.indexOf('MainContent'),
    );
    expect(output.indexOf('StickyTodoList')).toBeLessThan(
      output.indexOf('Composer'),
    );
  });

  it('does not render sticky todo list when dialogs are visible', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      dialogsVisible: true,
    });

    const output = lastFrame() ?? '';
    expect(output).not.toContain('StickyTodoList');
    expect(output).toContain('DialogManager 1');
  });

  it('renders update notifications when no dialog is visible', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      updateInfo: {
        message: 'Update successful!',
        update: {
          latest: '0.20.0',
          current: '0.19.12',
          type: 'latest',
          name: '@qwen-code/qwen-code',
        },
      },
    });

    expect(lastFrame() ?? '').toContain(
      'UpdateNotification: Update successful!',
    );
  });

  it('does not render update notifications when dialogs are visible', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      dialogsVisible: true,
      updateInfo: {
        message: 'Update successful!',
        update: {
          latest: '0.20.0',
          current: '0.19.12',
          type: 'latest',
          name: '@qwen-code/qwen-code',
        },
      },
    });

    expect(lastFrame() ?? '').not.toContain('UpdateNotification');
  });

  it('keeps a tall dialog within the terminal frame when constrained', () => {
    dialogManagerMockState.lineCount = 20;
    const terminalHeight = 8;

    const { lastFrame } = renderLayout({
      ...baseUIState,
      dialogsVisible: true,
      terminalHeight,
      staticExtraHeight: 3,
    });

    const output = lastFrame() ?? '';
    expect(frameHeight(output)).toBeLessThanOrEqual(terminalHeight);
    expect(output).toContain('DialogManager 1');
    expect(output).not.toContain('DialogManager 20');
  });

  it('does not cap a tall dialog when height constraints are disabled', () => {
    dialogManagerMockState.lineCount = 20;
    const terminalHeight = 8;

    const { lastFrame } = renderLayout({
      ...baseUIState,
      dialogsVisible: true,
      terminalHeight,
      constrainHeight: false,
    });

    const output = lastFrame() ?? '';
    expect(frameHeight(output)).toBeGreaterThan(terminalHeight);
    expect(output).toContain('DialogManager 20');
  });

  it('does not render sticky todo list while waiting for confirmation', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      streamingState: StreamingState.WaitingForConfirmation,
    });

    const output = lastFrame() ?? '';
    expect(output).not.toContain('StickyTodoList');
    expect(output).toContain('Composer');
  });

  it('does not render sticky todo list when agent is idle', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      streamingState: StreamingState.Idle,
    });

    const output = lastFrame() ?? '';
    expect(output).not.toContain('StickyTodoList');
    expect(output).toContain('Composer');
  });

  it('does not render sticky todo list when feedback dialog is open', () => {
    const { lastFrame } = renderLayout({
      ...baseUIState,
      isFeedbackDialogOpen: true,
    });

    const output = lastFrame() ?? '';
    expect(output).not.toContain('StickyTodoList');
    expect(output).toContain('Composer');
  });
});
