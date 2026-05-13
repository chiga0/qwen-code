/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ToolConfirmationOutcome } from '@qwen-code/qwen-code-core';
import { useRichInteraction } from './RichInteractionContext.js';
import type {
  RichWidgetField,
  RichWidgetOption,
  RichWidgetRequestPayload,
  RichWidgetResponse,
} from './types.js';

export interface UseRichSelectWidgetOptions<T> {
  widgetId: string;
  title: string;
  isFocused: boolean;
  items: Array<{
    label: string;
    key: string;
    value: T;
    description?: string;
    disabled?: boolean;
  }>;
  initialIndex?: number;
  onSelect: (value: T) => void | Promise<void>;
}

export interface UseRichFormWidgetOptions {
  widgetId: string;
  title: string;
  isFocused: boolean;
  fields: RichWidgetField[];
  reservedRows?: number;
  metadata?: Record<string, unknown>;
  onSubmit: (
    values: Record<string, unknown>,
    response: RichWidgetResponse,
  ) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

function responseValues(response: RichWidgetResponse): Record<string, unknown> {
  if (response['values']) return response['values'];
  if (
    response['response'] &&
    typeof response['response'] === 'object' &&
    !Array.isArray(response['response'])
  ) {
    const nested = response['response'] as Record<string, unknown>;
    if (
      nested['values'] &&
      typeof nested['values'] === 'object' &&
      !Array.isArray(nested['values'])
    ) {
      return nested['values'] as Record<string, unknown>;
    }
    return nested;
  }
  return {};
}

export function selectIndexFromResponse(response: RichWidgetResponse): number {
  if (typeof response.selectedIndex === 'number') return response.selectedIndex;
  const values = responseValues(response);
  const candidate = values['selectedIndex'] ?? values['index'];
  return typeof candidate === 'number' ? candidate : -1;
}

export function useRichSelectWidget<T>({
  widgetId,
  title,
  isFocused,
  items,
  initialIndex = 0,
  onSelect,
}: UseRichSelectWidgetOptions<T>): boolean {
  const rich = useRichInteraction();
  const onSelectRef = useRef(onSelect);
  const itemsRef = useRef(items);
  const [hasSubmittedResponse, setHasSubmittedResponse] = useState(false);
  onSelectRef.current = onSelect;
  itemsRef.current = items;

  const options = useMemo<RichWidgetOption[]>(
    () =>
      items.map((item, index) => ({
        label: item.label,
        value: item.key || String(index),
        description: item.description,
        disabled: item.disabled,
      })),
    [items],
  );
  const richAvailable = Boolean(rich) && isFocused && options.length >= 2;
  const shouldUseRichWidget = richAvailable && !hasSubmittedResponse;

  useEffect(() => {
    if (!isFocused) {
      setHasSubmittedResponse(false);
    }
  }, [isFocused, widgetId]);

  useLayoutEffect(() => {
    if (!rich || !shouldUseRichWidget) return;
    const requestId = rich.openWidget({
      widget: {
        widget_id: widgetId,
        kind: 'select',
        title,
        anchor: { type: 'cursor', reservedRows: 10 },
        payload: { options, metadata: { selectedIndex: initialIndex } },
      },
      onResponse: async (response) => {
        if (response.action === 'cancel' || response.action === 'dismiss') {
          setHasSubmittedResponse(true);
          return;
        }
        const index = selectIndexFromResponse(response);
        const selected = itemsRef.current[index];
        if (selected && !selected.disabled) {
          setHasSubmittedResponse(true);
          await onSelectRef.current(selected.value);
        }
      },
    });
    return () => rich.closeWidget(requestId);
  }, [initialIndex, options, rich, shouldUseRichWidget, title, widgetId]);

  return richAvailable;
}

export function useRichFormWidget({
  widgetId,
  title,
  isFocused,
  fields,
  reservedRows = 12,
  metadata,
  onSubmit,
  onCancel,
}: UseRichFormWidgetOptions): boolean {
  const rich = useRichInteraction();
  const onSubmitRef = useRef(onSubmit);
  const onCancelRef = useRef(onCancel);
  onSubmitRef.current = onSubmit;
  onCancelRef.current = onCancel;

  const shouldUseRichWidget = Boolean(rich) && isFocused && fields.length > 0;

  useLayoutEffect(() => {
    if (!rich || !shouldUseRichWidget) return;
    const requestId = rich.openWidget({
      widget: {
        widget_id: widgetId,
        kind: 'form',
        title,
        anchor: { type: 'cursor', reservedRows },
        payload: { fields, metadata },
      },
      onResponse: (response) => {
        if (response.action === 'cancel' || response.action === 'dismiss') {
          return onCancelRef.current?.();
        }
        return onSubmitRef.current(responseValues(response), response);
      },
    });
    return () => rich.closeWidget(requestId);
  }, [
    fields,
    metadata,
    reservedRows,
    rich,
    shouldUseRichWidget,
    title,
    widgetId,
  ]);

  return shouldUseRichWidget;
}

export function normalizeAnswersFromResponse(
  response: RichWidgetResponse,
): Record<string, string> {
  const values = responseValues(response);
  const answers = values['answers'];
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    return Object.fromEntries(
      Object.entries(answers as Record<string, unknown>).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : String(value ?? ''),
      ]),
    );
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : String(value ?? ''),
    ]),
  );
}

export function confirmationOutcomeFromResponse(
  response: RichWidgetResponse,
): ToolConfirmationOutcome | 'cancel' | undefined {
  const values = responseValues(response);
  const decision =
    response.decision ??
    (typeof response.value === 'string' ? response.value : undefined) ??
    (typeof values['decision'] === 'string'
      ? (values['decision'] as string)
      : undefined) ??
    (typeof values['outcome'] === 'string'
      ? (values['outcome'] as string)
      : undefined);

  switch (decision) {
    case 'accepted':
    case 'allow':
    case 'proceed_once':
      return 'proceed_once' as ToolConfirmationOutcome;
    case 'always':
    case 'proceed_always':
      return 'proceed_always' as ToolConfirmationOutcome;
    case 'always_project':
    case 'proceed_always_project':
      return 'proceed_always_project' as ToolConfirmationOutcome;
    case 'always_user':
    case 'proceed_always_user':
      return 'proceed_always_user' as ToolConfirmationOutcome;
    case 'restore_previous':
      return 'restore_previous' as ToolConfirmationOutcome;
    case 'modify':
    case 'modify_with_editor':
      return 'modify_with_editor' as ToolConfirmationOutcome;
    case 'rejected':
    case 'deny':
    case 'cancel':
      return 'cancel';
    default:
      return undefined;
  }
}

export function responsePayload(
  response: RichWidgetResponse,
): RichWidgetRequestPayload['metadata'] {
  const values = responseValues(response);
  return values && Object.keys(values).length > 0 ? values : undefined;
}
