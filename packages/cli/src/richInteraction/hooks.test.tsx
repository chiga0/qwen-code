/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RichInteractionBridge } from './RichInteractionBridge.js';
import { RichInteractionContext } from './RichInteractionContext.js';
import { useRichFormWidget, useRichSelectWidget } from './hooks.js';
import type { RichWidgetResponse } from './types.js';

describe('rich interaction hooks', () => {
  it('keeps select suppression active without reopening after a response', async () => {
    let respond:
      | ((response: RichWidgetResponse) => void | Promise<void>)
      | undefined;
    const closeWidget = vi.fn();
    const openWidget = vi.fn((request) => {
      respond = request.onResponse;
      return 'rich-select-request-1';
    });
    const bridge = {
      openWidget,
      closeWidget,
    } as unknown as RichInteractionBridge;
    const onSelect = vi.fn(async () => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RichInteractionContext.Provider value={bridge}>
        {children}
      </RichInteractionContext.Provider>
    );

    const { result, rerender, unmount } = renderHook(
      ({ initialIndex }) =>
        useRichSelectWidget({
          widgetId: 'model-dialog',
          title: 'Select Model',
          isFocused: true,
          initialIndex,
          items: [
            { key: 'glm', label: 'GLM', value: 'glm' },
            { key: 'qwen', label: 'Qwen', value: 'qwen' },
          ],
          onSelect,
        }),
      { initialProps: { initialIndex: 0 }, wrapper },
    );

    expect(result.current).toBe(true);
    expect(openWidget).toHaveBeenCalledTimes(1);

    await act(async () => {
      await respond?.({
        request_id: 'rich-select-request-1',
        widget_id: 'model-dialog',
        action: 'submit',
        selectedIndex: 1,
      });
    });

    expect(onSelect).toHaveBeenCalledWith('qwen');
    expect(result.current).toBe(true);
    expect(closeWidget).toHaveBeenCalledWith('rich-select-request-1');

    rerender({ initialIndex: 1 });

    expect(result.current).toBe(true);
    expect(openWidget).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('opens a form widget and routes responses to the submit callback', () => {
    let respond: ((response: RichWidgetResponse) => void) | undefined;
    const closeWidget = vi.fn();
    const openWidget = vi.fn((request) => {
      respond = request.onResponse;
      return 'rich-request-1';
    });
    const bridge = {
      openWidget,
      closeWidget,
    } as unknown as RichInteractionBridge;
    const onSubmit = vi.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RichInteractionContext.Provider value={bridge}>
        {children}
      </RichInteractionContext.Provider>
    );

    const { result, unmount } = renderHook(
      () =>
        useRichFormWidget({
          widgetId: 'theme-dialog',
          title: 'Select Theme',
          isFocused: true,
          fields: [
            {
              id: 'themeName',
              label: 'Theme',
              type: 'select',
              value: 'qwen-dark',
              options: [{ label: 'Qwen Dark', value: 'qwen-dark' }],
            },
          ],
          onSubmit,
        }),
      { wrapper },
    );

    expect(result.current).toBe(true);
    expect(openWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: expect.objectContaining({
          widget_id: 'theme-dialog',
          kind: 'form',
          title: 'Select Theme',
          payload: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({ id: 'themeName' }),
            ]),
          }),
        }),
      }),
    );

    act(() => {
      respond?.({
        request_id: 'rich-request-1',
        widget_id: 'theme-dialog',
        action: 'submit',
        values: { themeName: 'qwen-dark' },
      });
    });

    expect(onSubmit).toHaveBeenCalledWith(
      { themeName: 'qwen-dark' },
      expect.objectContaining({ request_id: 'rich-request-1' }),
    );

    unmount();

    expect(closeWidget).toHaveBeenCalledWith('rich-request-1');
  });

  it('stays inactive without a rich interaction bridge', () => {
    const { result } = renderHook(() =>
      useRichFormWidget({
        widgetId: 'theme-dialog',
        title: 'Select Theme',
        isFocused: true,
        fields: [{ id: 'themeName', label: 'Theme', type: 'text' }],
        onSubmit: vi.fn(),
      }),
    );

    expect(result.current).toBe(false);
  });
});
