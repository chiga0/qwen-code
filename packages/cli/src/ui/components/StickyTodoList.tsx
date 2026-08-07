/**
 * @license
 * Copyright 2025 Qwen Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { memo, useMemo } from 'react';
import { Box, Text } from 'ink';
import { t } from '../../i18n/index.js';
import { Colors } from '../colors.js';
import { ICON } from '../constants.js';
import { theme } from '../semantic-colors.js';
import {
  getOrderedStickyTodos,
  getStickyTodosRenderKey,
  STICKY_TODO_MAX_VISIBLE_ITEMS,
} from '../utils/todoSnapshot.js';
import type { TodoItem } from './TodoDisplay.js';

interface StickyTodoListProps {
  todos: TodoItem[];
  width: number;
  maxVisibleItems?: number;
}

const STATUS_ICONS = {
  pending: ICON.CIRCLE_EMPTY,
  in_progress: ICON.CIRCLE_LEFT_HALF,
  completed: ICON.CIRCLE_FILLED,
} as const;

function clampVisibleTodoCount(value: number): number {
  if (!Number.isFinite(value)) {
    return STICKY_TODO_MAX_VISIBLE_ITEMS;
  }

  return Math.max(
    1,
    Math.min(STICKY_TODO_MAX_VISIBLE_ITEMS, Math.floor(value)),
  );
}

const StickyTodoListComponent: React.FC<StickyTodoListProps> = ({
  todos,
  width,
  maxVisibleItems = STICKY_TODO_MAX_VISIBLE_ITEMS,
}) => {
  const orderedOpenTodos = useMemo(
    () =>
      getOrderedStickyTodos(todos).filter(
        (todo) => todo.status !== 'completed',
      ),
    [todos],
  );
  const todoNumberById = useMemo(
    () =>
      new Map(todos.map((todo, index) => [todo.id, `${index + 1}.`] as const)),
    [todos],
  );

  if (orderedOpenTodos.length === 0) {
    return null;
  }

  const visibleTodoCount = clampVisibleTodoCount(maxVisibleItems);
  const visibleTodos = orderedOpenTodos.slice(0, visibleTodoCount);
  const hiddenTodoCount = orderedOpenTodos.length - visibleTodos.length;
  const numberColumnWidth =
    Math.max(
      ...visibleTodos.map(
        (todo, index) =>
          (todoNumberById.get(todo.id) ?? `${index + 1}.`).length,
      ),
    ) + 1;
  // 6 = 2 (status icon column) + 2 (border columns) + 2 (paddingX columns).
  const contentColumnWidth = Math.max(1, width - numberColumnWidth - 6);

  return (
    <box marginX={2} style={{ width: width, flexDirection: "column", borderStyle: "round", borderColor: theme.border.default }} paddingX={1}>
      <text color={theme.text.secondary} bold>
        {t('Current tasks')}
      </text>
      {visibleTodos.map((todo, index) => {
        const todoNumber = todoNumberById.get(todo.id) ?? `${index + 1}.`;
        const itemColor =
          todo.status === 'in_progress'
            ? Colors.AccentGreen
            : Colors.Foreground;

        return (
          <box key={todo.id} style={{ flexDirection: "row", height: 1 }}>
            <box style={{ width: numberColumnWidth }}>
              <text color={theme.text.secondary}>{todoNumber}</text>
            </box>
            <box style={{ width: 2 }}>
              <text color={itemColor}>{STATUS_ICONS[todo.status]}</text>
            </box>
            <box style={{ width: contentColumnWidth }}>
              <text
                color={itemColor}
                strikethrough={todo.status === 'completed'}
                wrap="truncate-end"
              >
                {todo.content}
              </text>
            </box>
          </box>
        );
      })}
      {hiddenTodoCount > 0 && (
        <box style={{ flexDirection: "row", height: 1 }}>
          <box style={{ width: numberColumnWidth }} />
          <box style={{ width: 2 }} />
          <box style={{ width: contentColumnWidth }}>
            <text color={theme.text.secondary} wrap="truncate-end">
              {t('... and {{count}} more', {
                count: String(hiddenTodoCount),
              })}
            </text>
          </box>
        </box>
      )}
    </box>
  );
};

export const StickyTodoList = memo(
  StickyTodoListComponent,
  (previousProps, nextProps) =>
    previousProps.width === nextProps.width &&
    previousProps.maxVisibleItems === nextProps.maxVisibleItems &&
    getStickyTodosRenderKey(previousProps.todos) ===
      getStickyTodosRenderKey(nextProps.todos),
);
