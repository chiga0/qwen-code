/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  normalizeSelection,
  osc52,
  parseMouseSequence,
  selectionText,
  wheelScroll,
} from './mouse.js';

describe('parseMouseSequence', () => {
  it('parses a left press with 0-based coordinates', () => {
    expect(parseMouseSequence('\x1b[<0;5;3M')).toEqual({
      kind: 'press',
      button: 'left',
      col: 4,
      row: 2,
    });
  });

  it('parses a release', () => {
    expect(parseMouseSequence('\x1b[<0;5;3m')).toMatchObject({
      kind: 'release',
      button: 'left',
    });
  });

  it('parses drag motion events', () => {
    expect(parseMouseSequence('\x1b[<32;5;3M')).toMatchObject({
      kind: 'drag',
      button: 'left',
    });
  });

  it('parses button-less hover moves', () => {
    expect(parseMouseSequence('\x1b[<35;5;3M')).toMatchObject({
      kind: 'move',
    });
  });

  it('parses wheel events from the high button bits', () => {
    expect(parseMouseSequence('\x1b[<64;1;1M')).toMatchObject({
      kind: 'wheel-up',
    });
    expect(parseMouseSequence('\x1b[<65;1;1M')).toMatchObject({
      kind: 'wheel-down',
    });
  });

  it('rejects non-mouse sequences', () => {
    expect(parseMouseSequence('\x1b[<garbage')).toBeNull();
    expect(parseMouseSequence('hello')).toBeNull();
  });
});

describe('wheelScroll', () => {
  it('steps by three rows and clamps to the document', () => {
    expect(wheelScroll(10, 'wheel-up', 30, 10)).toBe(7);
    expect(wheelScroll(1, 'wheel-up', 30, 10)).toBe(0);
    expect(wheelScroll(18, 'wheel-down', 30, 10)).toBe(20);
  });

  it('stays at zero for short documents', () => {
    expect(wheelScroll(0, 'wheel-up', 3, 10)).toBe(0);
    expect(wheelScroll(0, 'wheel-down', 3, 10)).toBe(0);
  });
});

describe('normalizeSelection', () => {
  it('orders anchor and focus and makes endCol exclusive', () => {
    expect(normalizeSelection({ row: 4, col: 9 }, { row: 2, col: 3 })).toEqual({
      startRow: 2,
      startCol: 3,
      endRow: 4,
      endCol: 10,
    });
  });
});

describe('selectionText', () => {
  const lines = ['first line', 'second line', 'third line'];
  const lineAt = (row: number) => lines[row];

  it('extracts a multi-line range and trims trailing blanks', () => {
    const text = selectionText(
      { startRow: 0, startCol: 6, endRow: 2, endCol: 5 },
      lineAt,
    );
    expect(text).toBe('line\nsecond line\nthird');
  });

  it('extracts a single-line range', () => {
    const text = selectionText(
      { startRow: 1, startCol: 0, endRow: 1, endCol: 6 },
      lineAt,
    );
    expect(text).toBe('second');
  });

  it('treats missing rows as empty', () => {
    const text = selectionText(
      { startRow: 5, startCol: 0, endRow: 5, endCol: 3 },
      lineAt,
    );
    expect(text).toBe('');
  });
});

describe('osc52', () => {
  it('encodes the payload so terminals can copy it', () => {
    const data = osc52('copy me');
    // eslint-disable-next-line no-control-regex
    expect(data).toMatch(/^\x1b\]52;c;[A-Za-z0-9+/=]+\x07$/);
    const payload = data.slice('\x1b]52;c;'.length, -1);
    expect(Buffer.from(payload, 'base64').toString('utf8')).toBe('copy me');
  });
});
