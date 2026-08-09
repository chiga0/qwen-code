/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import stringWidth from 'string-width';

import { renderMarkdown, lineOf } from './markdown.js';
import type {
  RenderLine,
  SessionBlock,
  Size,
  Span,
  SpanStyle,
  ToolBlock,
} from './types.js';

export interface LineRef {
  /** -1 marks a blank separator line between blocks. */
  blockIndex: number;
  line: number;
}

export interface Layout {
  rows: RenderLine[];
  refs: LineRef[];
  /** The fully laid-out document, for selection text and hit-testing. */
  allRows: RenderLine[];
  totalRows: number;
  scrollTop: number;
}

export const EMPTY_LINE: RenderLine = { spans: [], plain: '' };

interface Cell {
  ch: string;
  width: number;
  style: SpanStyle;
}

function cellsFrom(spans: Span[]): Cell[] {
  const cells: Cell[] = [];
  for (const span of spans) {
    for (const ch of span.text) {
      cells.push({ ch, width: stringWidth(ch), style: span.style });
    }
  }
  return cells;
}

function lineFrom(cells: Cell[]): RenderLine {
  const spans: Span[] = [];
  for (const cell of cells) {
    const last = spans[spans.length - 1];
    if (last && sameStyle(last.style, cell.style)) {
      last.text += cell.ch;
    } else {
      spans.push({ text: cell.ch, style: cell.style });
    }
  }
  return lineOf(spans);
}

function sameStyle(a: SpanStyle, b: SpanStyle): boolean {
  return (
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.inverse === b.inverse &&
    a.color === b.color
  );
}

/** Greedy word wrap aware of terminal cell widths (wide glyphs included). */
export function wrapSpans(spans: Span[], cols: number): RenderLine[] {
  const cells = cellsFrom(spans);
  if (cells.length === 0) {
    return [EMPTY_LINE];
  }
  const limit = Math.max(1, cols);
  const out: RenderLine[] = [];
  let start = 0;
  while (start < cells.length) {
    let width = 0;
    let end = start;
    let lastSpace = -1;
    while (end < cells.length && width + cells[end].width <= limit) {
      if (cells[end].ch === ' ') {
        lastSpace = end;
      }
      width += cells[end].width;
      end++;
    }
    if (end === start) {
      out.push(lineFrom(cells.slice(start, start + 1)));
      start++;
      continue;
    }
    // Prefer a hard break at a boundary that lands exactly on the limit;
    // otherwise break at the last space to avoid splitting words.
    const nextIsSpace = end < cells.length && cells[end].ch === ' ';
    if (end < cells.length && lastSpace > start && !nextIsSpace) {
      out.push(lineFrom(cells.slice(start, lastSpace)));
      start = lastSpace + 1;
    } else {
      out.push(lineFrom(cells.slice(start, end)));
      start = end;
      while (start < cells.length && cells[start].ch === ' ') {
        start++;
      }
    }
  }
  return out;
}

function wrapPlainText(
  text: string,
  cols: number,
  style: SpanStyle,
): RenderLine[] {
  const out: RenderLine[] = [];
  for (const segment of text.split('\n')) {
    out.push(...wrapSpans([{ text: segment, style }], cols));
  }
  return out;
}

function renderToolHeader(tool: ToolBlock): Span[] {
  const glyph =
    tool.state === 'running' ? '●' : tool.state === 'done' ? '✓' : '✗';
  const color =
    tool.state === 'running'
      ? 'yellow'
      : tool.state === 'done'
        ? 'green'
        : 'red';
  const spans: Span[] = [
    { text: glyph, style: { color } },
    { text: ` ${tool.name}`, style: { bold: true } },
  ];
  if (tool.detail.length > 0) {
    spans.push({ text: ` ${tool.detail}`, style: { dim: true } });
  }
  return spans;
}

export function renderBlock(block: SessionBlock, cols: number): RenderLine[] {
  switch (block.kind) {
    case 'thinking':
      if (block.text.length === 0) {
        return [];
      }
      return wrapPlainText(block.text, cols, {
        italic: true,
        dim: true,
        color: 'gray',
      });
    case 'markdown': {
      const out: RenderLine[] = [];
      for (const line of renderMarkdown(block.text)) {
        out.push(...wrapSpans(line.spans, cols));
      }
      return out;
    }
    case 'tool': {
      const out = wrapSpans(renderToolHeader(block), cols);
      if (block.result.length > 0) {
        out.push(...wrapPlainText(block.result, cols, { dim: true }));
      }
      return out;
    }
    default:
      return [];
  }
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function maxScrollTop(totalRows: number, viewRows: number): number {
  return Math.max(0, totalRows - Math.max(1, viewRows));
}

/**
 * Lays the whole session out (blocks separated by one blank line) and
 * returns the visible window for `scrollTop`.
 */
export function layoutSession(
  blocks: readonly SessionBlock[],
  size: Size,
  scrollTop: number,
): Layout {
  const all: Array<{ row: RenderLine; ref: LineRef }> = [];
  blocks.forEach((block, blockIndex) => {
    const lines = renderBlock(block, size.cols);
    if (lines.length === 0) {
      return;
    }
    if (all.length > 0) {
      all.push({ row: EMPTY_LINE, ref: { blockIndex: -1, line: -1 } });
    }
    lines.forEach((row, line) => all.push({ row, ref: { blockIndex, line } }));
  });
  const totalRows = all.length;
  const top = clamp(scrollTop, 0, maxScrollTop(totalRows, size.rows));
  const slice = all.slice(top, top + Math.max(1, size.rows));
  return {
    rows: slice.map((entry) => entry.row),
    refs: slice.map((entry) => entry.ref),
    allRows: all.map((entry) => entry.row),
    totalRows,
    scrollTop: top,
  };
}
