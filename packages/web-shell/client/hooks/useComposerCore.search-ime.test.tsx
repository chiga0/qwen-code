// @vitest-environment jsdom
//
// Regression test for IME (Chinese input method) behavior in the Ctrl-R
// history search. Mounts the real useComposerCore hook and drives its
// searchState handlers, asserting:
//
//   1. Input events fired mid-composition (isComposing) do NOT re-filter the
//      results — only compositionend does. This kills the flicker caused by
//      filtering on every intermediate pinyin keystroke.
//   2. Non-composed (e.g. Latin) input filters immediately.
//   3. Enter pressed mid-composition (committing an IME candidate) does NOT
//      submit/close the search.
//   4. Enter pressed outside composition still submits the active match.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CommandInfo } from '../adapters/types';
import { useComposerCore, type UseComposerCoreReturn } from './useComposerCore';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const HISTORY_KEY = 'qwen-web-shell-history';
const COMMANDS: CommandInfo[] = [{ name: 'help', description: 'Show help' }];

let coreRef: { current: UseComposerCoreReturn | null };
let submitSpy: ReturnType<typeof vi.fn>;
const mounted: Array<{ root: Root; container: HTMLElement }> = [];

function Harness() {
  const core = useComposerCore({
    onSubmit: (text, images) => submitSpy(text, images),
    commands: COMMANDS,
    editorTheme: {},
  });
  coreRef.current = core;
  return <div ref={core.containerRef} />;
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });
  mounted.push({ root, container });
}

function search() {
  const s = coreRef.current?.searchState;
  if (!s) throw new Error('searchState unavailable');
  return s;
}

function changeEvent(value: string, isComposing: boolean) {
  return {
    target: { value },
    nativeEvent: { isComposing },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

beforeEach(() => {
  coreRef = { current: null };
  submitSpy = vi.fn(() => true);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(['hello', '你好world']));
});

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  localStorage.clear();
});

describe('history search IME handling', () => {
  it('does not re-filter results while the IME is composing, only on compositionend', () => {
    mount();
    act(() => search().openHistorySearch());
    expect(search().searchMatches).toHaveLength(2); // all entries initially

    // Intermediate composition input ("你" being composed) must not filter.
    act(() => search().handleSearchInput(changeEvent('你', true)));
    expect(search().searchQuery).toBe('你'); // visible text updates
    expect(search().searchMatches).toHaveLength(2); // …but results unchanged

    // Committing the composition filters to the matching entry.
    act(() =>
      search().handleSearchCompositionEnd({
        currentTarget: { value: '你' },
      } as unknown as React.CompositionEvent<HTMLInputElement>),
    );
    expect(search().searchMatches).toEqual(['你好world']);
  });

  it('filters immediately for non-composed (e.g. Latin) input', () => {
    mount();
    act(() => search().openHistorySearch());

    act(() => search().handleSearchInput(changeEvent('hel', false)));
    expect(search().searchMatches).toEqual(['hello']);
  });

  it('does not submit or close the search when Enter is pressed mid-composition', () => {
    mount();
    act(() => search().openHistorySearch());
    expect(search().searchMode).toBe(true);

    const preventDefault = vi.fn();
    act(() =>
      search().handleSearchKeyDown({
        key: 'Enter',
        nativeEvent: { isComposing: true },
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLInputElement>),
    );

    // The keystroke belonged to the IME — search stays open, nothing submitted.
    expect(search().searchMode).toBe(true);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('submits the active match when Enter is pressed outside composition', () => {
    mount();
    act(() => search().openHistorySearch());
    const active = search().searchMatches[search().searchActiveIndex];

    const preventDefault = vi.fn();
    act(() =>
      search().handleSearchKeyDown({
        key: 'Enter',
        nativeEvent: { isComposing: false },
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLInputElement>),
    );

    expect(preventDefault).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalledWith(active, undefined);
    expect(search().searchMode).toBe(false); // search closed after submit
  });
});
