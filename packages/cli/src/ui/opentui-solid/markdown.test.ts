/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { renderInline, renderMarkdown } from './markdown.js';

describe('renderInline', () => {
  it('splits bold, italic and code spans', () => {
    const spans = renderInline('a **bold** b *ital* c `code` d');
    expect(spans.map((span) => span.text)).toEqual([
      'a ',
      'bold',
      ' b ',
      'ital',
      ' c ',
      'code',
      ' d',
    ]);
    expect(spans[1].style.bold).toBe(true);
    expect(spans[3].style.italic).toBe(true);
    expect(spans[5].style.color).toBe('cyan');
  });

  it('keeps lone stars as plain text', () => {
    const spans = renderInline('2 * 3 * 4');
    expect(spans).toEqual([{ text: '2 * 3 * 4', style: {} }]);
  });

  it('applies the base style outside tokens', () => {
    const spans = renderInline('quote **bold**', { dim: true });
    expect(spans[0].style).toEqual({ dim: true });
    expect(spans[1].style).toEqual({ dim: true, bold: true });
  });
});

describe('renderMarkdown', () => {
  it('renders headings bold and strips markers', () => {
    const lines = renderMarkdown('## Title');
    expect(lines).toHaveLength(1);
    expect(lines[0].plain).toBe('Title');
    expect(lines[0].spans[0].style.bold).toBe(true);
  });

  it('renders fenced code without inline parsing', () => {
    const lines = renderMarkdown('```\nlet a = 1 * 2;\n```');
    expect(lines).toHaveLength(1);
    expect(lines[0].plain).toBe('let a = 1 * 2;');
    expect(lines[0].spans[0].style.color).toBe('cyan');
  });

  it('renders blockquotes dim without the marker', () => {
    const lines = renderMarkdown('> quoted');
    expect(lines[0].plain).toBe('quoted');
    expect(lines[0].spans[0].style.dim).toBe(true);
  });

  it('keeps blank lines between paragraphs', () => {
    const lines = renderMarkdown('one\n\ntwo');
    expect(lines.map((line) => line.plain)).toEqual(['one', '', 'two']);
  });

  it('trims trailing blank lines from a partial stream', () => {
    const lines = renderMarkdown('one\n');
    expect(lines.map((line) => line.plain)).toEqual(['one']);
  });
});
