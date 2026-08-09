/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { lineOf } from './markdown.js';
import { EraseFreePainter, inverseRange, paintLine } from './screen.js';

describe('paintLine', () => {
  it('styles spans and resets after each styled span', () => {
    const encoded = paintLine(
      lineOf([
        { text: 'hi ', style: {} },
        { text: 'bold', style: { bold: true, color: 'green' } },
      ]),
    );
    expect(encoded).toBe('hi \x1b[1;32mbold\x1b[0m');
  });

  it('emits no escapes for unstyled text', () => {
    expect(paintLine(lineOf([{ text: 'plain', style: {} }]))).toBe('plain');
  });
});

describe('inverseRange', () => {
  it('wraps only the visible range', () => {
    expect(inverseRange('abcdef', 2, 4)).toBe('ab\x1b[7mcd\x1b[27mef');
  });

  it('reopens inverse after embedded resets', () => {
    const encoded = 'a\x1b[0mb';
    expect(inverseRange(encoded, 0, 2)).toBe('\x1b[7ma\x1b[0m\x1b[7mb\x1b[27m');
  });

  it('returns the input untouched for an empty range', () => {
    expect(inverseRange('abc', 2, 2)).toBe('abc');
  });
});

describe('EraseFreePainter', () => {
  it('writes every row on the first paint with cursor addressing', () => {
    const writes: string[] = [];
    const painter = new EraseFreePainter((data) => writes.push(data));
    painter.paint(['aaa', 'bbb']);
    expect(writes).toEqual(['\x1b[1;1Haaa\x1b[K\x1b[2;1Hbbb\x1b[K']);
  });

  it('never clears the screen', () => {
    const writes: string[] = [];
    const painter = new EraseFreePainter((data) => writes.push(data));
    painter.paint(['a', 'b']);
    painter.paint(['x', 'b']);
    painter.paint(['x']);
    painter.paint([]);
    const output = writes.join('');
    expect(output).not.toContain('\x1b[2J');
    expect(output).not.toContain('\x1b[J');
  });

  it('rewrites only changed rows', () => {
    const writes: string[] = [];
    const painter = new EraseFreePainter((data) => writes.push(data));
    painter.paint(['aaa', 'bbb', 'ccc']);
    painter.paint(['aaa', 'xxx', 'ccc']);
    expect(writes[1]).toBe('\x1b[2;1Hxxx\x1b[K');
  });

  it('writes nothing when nothing changed', () => {
    const writes: string[] = [];
    const painter = new EraseFreePainter((data) => writes.push(data));
    painter.paint(['same']);
    painter.paint(['same']);
    expect(writes).toHaveLength(1);
  });

  it('clears rows that disappeared once', () => {
    const writes: string[] = [];
    const painter = new EraseFreePainter((data) => writes.push(data));
    painter.paint(['aaa', 'bbb']);
    painter.paint(['aaa']);
    expect(writes[1]).toBe('\x1b[2;1H\x1b[K');
    painter.paint(['aaa']);
    expect(writes).toHaveLength(2);
  });
});
