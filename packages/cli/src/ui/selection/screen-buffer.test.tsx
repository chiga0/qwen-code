/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Box, Text } from 'ink';
import { render } from 'ink-testing-library';
import { getScreenBuffer } from './screen-buffer.js';
import { getSelectedText } from './selection-text.js';

/** The background escape the patched renderer appends to selected cells. */
const SELECTION_BG = '[48;5;240m';

type Rendered = ReturnType<typeof render>;

let current: Rendered | undefined;

afterEach(() => {
  current?.unmount();
  current = undefined;
});

describe('ScreenBuffer (Ink frame-controller M0)', () => {
  it('exposes the composited frame as addressable cells', () => {
    current = render(<text>hello 中文</text>);
    const buffer = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    );

    expect(buffer).toBeDefined();
    expect(buffer!.dimensions.height).toBeGreaterThan(0);
    expect(buffer!.lineText(0)).toBe('hello 中文');
    expect(buffer!.getCellAt(0, 0)?.value).toBe('h');
  });

  it('handles wide characters with a leading cell and a spacer', () => {
    current = render(<text>hello 中文</text>);
    const buffer = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!;

    // "hello " occupies columns 0-5; the first wide glyph starts at column 6.
    const wide = buffer.getCellAt(6, 0);
    expect(wide?.value).toBe('中');
    expect(wide?.fullWidth).toBe(true);
    // The trailing half of a wide glyph is an empty spacer cell.
    expect(buffer.getCellAt(7, 0)?.value).toBe('');
  });

  it('highlights the selected range before serialization and clears it', () => {
    current = render(<text>hello world</text>);
    const buffer = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!;

    expect(current.lastFrame()).not.toContain(SELECTION_BG);

    buffer.setSelection({ sx: 0, sy: 0, ex: 4, ey: 0 });
    expect(current.lastFrame()).toContain(SELECTION_BG);

    buffer.setSelection(null);
    expect(current.lastFrame()).not.toContain(SELECTION_BG);
  });

  it('does not leak the highlight onto identical text elsewhere on screen', () => {
    // "abc" appears twice; selecting the first must not highlight the second.
    current = render(<text>abc{'\n'}abc</text>);
    const buffer = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!;

    buffer.setSelection({ sx: 0, sy: 0, ex: 2, ey: 0 });
    const frame = current.lastFrame() ?? '';
    const [firstLine, secondLine] = frame.split('\n');

    expect(firstLine).toContain(SELECTION_BG);
    expect(secondLine).not.toContain(SELECTION_BG);
  });

  it('publishes exactly one frame per distinct selection change (no loop, deduped)', () => {
    current = render(<text>hello world</text>);
    const buffer = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!;

    let publishes = 0;
    buffer.subscribe(() => {
      publishes++;
    });

    buffer.setSelection({ sx: 0, sy: 0, ex: 2, ey: 0 });
    expect(publishes).toBe(1);

    // Identical selection is deduplicated: no extra render.
    buffer.setSelection({ sx: 0, sy: 0, ex: 2, ey: 0 });
    expect(publishes).toBe(1);

    // A different selection renders once more.
    buffer.setSelection({ sx: 0, sy: 0, ex: 4, ey: 0 });
    expect(publishes).toBe(2);
  });

  it('publishes soft boundaries and preserves omitted whitespace', () => {
    current = render(
      <box style={{ width: 5 }}>
        <text>hello world</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      frame.cells.map((row) =>
        row
          .map((cell) => cell.value)
          .join('')
          .trimEnd(),
      ),
    ).toEqual(['hello', '', 'world']);
    expect(frame.cells[1].every((cell) => !cell.selectable)).toBe(true);
    expect(frame.boundaries[0].find(Boolean)).toMatchObject({
      kind: 'soft',
      joiner: ' ',
    });
    expect(frame.boundaries[1].find(Boolean)).toMatchObject({
      kind: 'soft',
      joiner: '',
    });
    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe('hello world');
  });

  it.each([
    ['multiple spaces', 'hello  world'],
    ['a tab', 'hello\tworld'],
  ])('preserves %s across a direct Ink word wrap', (_name, source) => {
    current = render(
      <box style={{ width: 5 }}>
        <text>{source}</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe(source);
  });

  it.each([
    ['leading indentation', '   hello'],
    ['whitespace-only content', '   '],
  ])('preserves wrapped %s', (_name, source) => {
    current = render(
      <box style={{ width: 2 }}>
        <text>{source}</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe(source);
  });

  it('keeps renderer background fill out of selected text', () => {
    current = render(
      <box style={{ width: 5, backgroundColor: "blue" }}>
        <text>hi</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe('hi');
  });

  it('distinguishes explicit hard newlines from exact-width wraps', () => {
    current = render(
      <box style={{ width: 5 }}>
        <text>{'hello\nworld'}</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(frame.boundaries[0].find(Boolean)).toMatchObject({
      kind: 'hard',
      joiner: '\n',
    });
    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe('hello\nworld');
  });

  it('preserves empty and whitespace-only hard lines', () => {
    const source = 'alpha\n\n   \nomega';
    current = render(<text>{source}</text>);
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe(source);
  });

  it('rejoins styled CJK and emoji text without duplicating wide cells', () => {
    const source = '你好 世界🙂';
    current = render(
      <box style={{ width: 5 }}>
        <text color="cyan">{source}</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe(source);
  });

  it('keeps a newline when sibling flows make a boundary ambiguous', () => {
    current = render(
      <box style={{ flexDirection: "column" }}>
        <box>
          <text selectionFlow="a" selectionBreakAfter="soft">
            A
          </text>
          <text selectionFlow="b" selectionBreakAfter="soft">
            B
          </text>
        </box>
        <box>
          <text selectionFlow="a">C</text>
          <text selectionFlow="b">D</text>
        </box>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe('AB\nCD');
  });

  it('clears a boundary claim when a later write overlaps it', () => {
    current = render(
      <box style={{ width: 3, height: 1 }}>
        <text selectionBreakAfter="soft">abc</text>
        <box position="absolute">
          <text selectable={false}>xyz</text>
        </box>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(
      frame.cells[0]
        .map((cell) => cell.value)
        .join('')
        .trimEnd(),
    ).toBe('xyz');
    expect(frame.boundaries[0].every((claim) => claim === null)).toBe(true);
  });

  it('does not publish a boundary outside a clipping rectangle', () => {
    current = render(
      <box style={{ width: 3, height: 1 }} overflow="hidden">
        <box position="absolute" marginLeft={3}>
          <text selectionBreakAfter="soft">abc</text>
        </box>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(frame.boundaries[0].every((claim) => claim === null)).toBe(true);
  });

  it('covers visible text after left clipping with boundary claims', () => {
    current = render(
      <box style={{ width: 3, height: 2, flexDirection: "column" }}>
        <box style={{ width: 3, height: 1 }} overflow="hidden">
          <box position="absolute" marginLeft={-2}>
            <text
              selectionFlow="flow"
              selectionBreakAfter="soft"
              selectionJoiner=" "
            >
              abcde
            </text>
          </box>
          <box position="absolute">
            <text selectable={false}>X</text>
          </box>
        </box>
        <text selectionFlow="flow">fgh</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(frame.boundaries[0].slice(0, 3).map(Boolean)).toEqual([
      false,
      true,
      true,
    ]);
    expect(
      getSelectedText(frame, {
        sx: 0,
        sy: 0,
        ex: frame.width - 1,
        ey: frame.height - 1,
      }),
    ).toBe('de fgh');
  });

  it('limits boundary claims to the rendered text width', () => {
    current = render(
      <box style={{ width: 5 }}>
        <text selectionBreakAfter="soft">hi</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(frame.boundaries[0].filter(Boolean)).toHaveLength(2);
  });

  it('propagates selectability and producer-supplied boundaries', () => {
    current = render(
      <box style={{ flexDirection: "column" }}>
        <text
          selectionFlow="flow"
          selectionBreakAfter="soft"
          selectionJoiner=" "
        >
          hello
        </text>
        <text selectionFlow="flow">world</text>
        <text selectable={false}> gutter</text>
      </box>,
    );
    const frame = getScreenBuffer(
      current.stdout as unknown as NodeJS.WriteStream,
    )!.frame!;

    expect(frame.boundaries[0].find(Boolean)).toMatchObject({
      kind: 'soft',
      joiner: ' ',
    });
    expect(frame.cells[0][0].flowId).toBe(frame.cells[1][0].flowId);
    expect(frame.cells[2].every((cell) => !cell.selectable)).toBe(true);
  });
});
