// @vitest-environment jsdom
//
// Integration regression test for the composer arrow-key arbitration between
// the slash-command menu and input-history navigation. Mounts the real
// useComposerCore hook (no providers — its contexts have safe defaults),
// drives the real CodeMirror EditorView with real key events, and asserts:
//
//   1. Freshly typing "/" then ArrowUp navigates the menu (wraps), never
//      history — the original bug.
//   2. After browsing history earlier in the same composition, typing "/"
//      again still lets ArrowUp drive the menu — guards the sticky-flag
//      regression (history.isNavigating() never resets until submit).
//   3. While actually paging through history, a recalled slash command (which
//      pops its own menu) does NOT trap ArrowUp inside that menu — the edge
//      case: ArrowUp keeps walking history.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CommandInfo } from '../adapters/types';
import { useComposerCore, type UseComposerCoreReturn } from './useComposerCore';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const HISTORY_KEY = 'qwen-web-shell-history';
const COMMANDS: CommandInfo[] = [
  { name: 'theme', description: 'Change theme' },
  { name: 'thread', description: 'Manage thread' },
  { name: 'help', description: 'Show help' },
];

let coreRef: { current: UseComposerCoreReturn | null };
const mounted: Array<{ root: Root; container: HTMLElement }> = [];

function Harness() {
  const core = useComposerCore({
    onSubmit: () => true,
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

function view() {
  const v = coreRef.current?.viewRef.current;
  if (!v) throw new Error('EditorView not mounted');
  return v;
}

/** Simulate a genuine user edit (carries a userEvent, like real typing). */
function typeText(text: string) {
  act(() => {
    const v = view();
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: text },
      selection: { anchor: text.length },
      userEvent: 'input.type',
    });
  });
}

function pressArrow(direction: 'ArrowUp' | 'ArrowDown') {
  act(() => {
    view().contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: direction,
        code: direction,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

beforeEach(() => {
  coreRef = { current: null };
  // Newest entry last. navigateUp recalls "/the" first, then "hello world".
  localStorage.setItem(HISTORY_KEY, JSON.stringify(['hello world', '/the']));
});

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  localStorage.clear();
});

describe('composer arrow-key arbitration (slash menu vs history)', () => {
  it('navigates the slash menu (wrapping) on ArrowUp after typing "/", never history', () => {
    mount();
    typeText('/');
    const menu = coreRef.current?.slashMenu;
    expect(menu).not.toBeNull();
    expect(menu!.items.length).toBeGreaterThan(1);
    expect(menu!.selectedIndex).toBe(0);

    pressArrow('ArrowUp');

    // Wrapped to the last item; text untouched (history not recalled).
    expect(coreRef.current?.slashMenu?.selectedIndex).toBe(
      menu!.items.length - 1,
    );
    expect(coreRef.current?.getText()).toBe('/');
  });

  it('lets ArrowUp drive the menu after history was browsed earlier in the same composition', () => {
    mount();
    // Browse history first — this sets the (sticky) history index.
    pressArrow('ArrowUp');
    expect(coreRef.current?.getText()).toBe('/the');

    // Now the user types a fresh "/" — a genuine edit must re-arm the menu.
    typeText('/');
    const menu = coreRef.current?.slashMenu;
    expect(menu).not.toBeNull();

    pressArrow('ArrowUp');

    // Menu moved; text stayed "/", i.e. history was NOT recalled.
    expect(coreRef.current?.getText()).toBe('/');
    expect(coreRef.current?.slashMenu?.selectedIndex).toBe(
      menu!.items.length - 1,
    );
  });

  it('keeps paging history on ArrowUp even when a recalled slash command opens its menu', () => {
    mount();
    // First ArrowUp recalls the newest entry, a slash command that pops a menu.
    pressArrow('ArrowUp');
    expect(coreRef.current?.getText()).toBe('/the');
    expect(coreRef.current?.slashMenu).not.toBeNull();

    // Second ArrowUp must continue history, not get trapped in the menu.
    pressArrow('ArrowUp');
    expect(coreRef.current?.getText()).toBe('hello world');
  });
});
