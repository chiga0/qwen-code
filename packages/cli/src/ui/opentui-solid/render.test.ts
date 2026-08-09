/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  layoutSession,
  maxScrollTop,
  renderBlock,
  wrapSpans,
} from './render.js';
import type { SessionBlock, Span } from './types.js';

const plain = (text: string): Span[] => [{ text, style: {} }];

describe('wrapSpans', () => {
  it('returns one empty line for empty input', () => {
    expect(wrapSpans([], 10)).toEqual([{ spans: [], plain: '' }]);
  });

  it('breaks at word boundaries', () => {
    const lines = wrapSpans(plain('hello world foo'), 11);
    expect(lines.map((line) => line.plain)).toEqual(['hello world', 'foo']);
  });

  it('hard breaks words wider than the viewport', () => {
    const lines = wrapSpans(plain('abcdef'), 4);
    expect(lines.map((line) => line.plain)).toEqual(['abcd', 'ef']);
  });

  it('accounts for wide characters', () => {
    const lines = wrapSpans(plain('中文中文'), 4);
    expect(lines.map((line) => line.plain)).toEqual(['中文', '中文']);
  });

  it('keeps styles on wrapped segments', () => {
    const spans: Span[] = [{ text: 'ab cd', style: { bold: true } }];
    const lines = wrapSpans(spans, 2);
    expect(lines.map((line) => line.plain)).toEqual(['ab', 'cd']);
    expect(lines[1].spans[0].style.bold).toBe(true);
  });
});

describe('renderBlock', () => {
  it('renders tool header glyphs by state', () => {
    const running = renderBlock(
      {
        kind: 'tool',
        id: 't',
        name: 'ls',
        state: 'running',
        detail: '',
        result: '',
      },
      80,
    );
    expect(running[0].plain).toBe('● ls');
    expect(running[0].spans[0].style.color).toBe('yellow');
    const done = renderBlock(
      {
        kind: 'tool',
        id: 't',
        name: 'ls',
        state: 'done',
        detail: 'ok',
        result: 'file\nfile2',
      },
      80,
    );
    expect(done[0].plain).toBe('✓ ls ok');
    expect(done[1].plain).toBe('file');
    expect(done[2].plain).toBe('file2');
    const failed = renderBlock(
      {
        kind: 'tool',
        id: 't',
        name: 'ls',
        state: 'error',
        detail: '',
        result: '',
      },
      80,
    );
    expect(failed[0].plain).toBe('✗ ls');
  });

  it('renders empty text blocks as no lines', () => {
    expect(renderBlock({ kind: 'markdown', text: '' }, 80)).toEqual([]);
    expect(renderBlock({ kind: 'thinking', text: '' }, 80)).toEqual([]);
  });

  it('renders thinking dim and italic', () => {
    const lines = renderBlock({ kind: 'thinking', text: 'ponder' }, 80);
    expect(lines[0].plain).toBe('ponder');
    expect(lines[0].spans[0].style.italic).toBe(true);
    expect(lines[0].spans[0].style.dim).toBe(true);
  });
});

describe('layoutSession', () => {
  const blocks: SessionBlock[] = [
    { kind: 'markdown', text: 'one' },
    { kind: 'markdown', text: 'two' },
  ];

  it('separates blocks with one blank line and reports refs', () => {
    const layout = layoutSession(blocks, { rows: 10, cols: 80 }, 0);
    expect(layout.totalRows).toBe(3);
    expect(layout.rows.map((line) => line.plain)).toEqual(['one', '', 'two']);
    expect(layout.refs.map((ref) => ref.blockIndex)).toEqual([0, -1, 1]);
  });

  it('windows the rows at the requested scroll top', () => {
    const tall: SessionBlock[] = [
      { kind: 'markdown', text: 'a\nb\nc\nd\ne\nf' },
    ];
    const layout = layoutSession(tall, { rows: 2, cols: 80 }, 1);
    expect(layout.scrollTop).toBe(1);
    expect(layout.rows.map((line) => line.plain)).toEqual(['b', 'c']);
  });

  it('clamps the scroll top to the bottom of the document', () => {
    const tall: SessionBlock[] = [{ kind: 'markdown', text: 'a\nb\nc\nd' }];
    const layout = layoutSession(tall, { rows: 2, cols: 80 }, 999);
    expect(layout.scrollTop).toBe(maxScrollTop(4, 2));
    expect(layout.scrollTop).toBe(2);
    expect(layout.rows.map((line) => line.plain)).toEqual(['c', 'd']);
  });

  it('exposes the whole document for selection lookups', () => {
    const layout = layoutSession(blocks, { rows: 1, cols: 80 }, 2);
    expect(layout.allRows.map((line) => line.plain)).toEqual([
      'one',
      '',
      'two',
    ]);
  });
});
