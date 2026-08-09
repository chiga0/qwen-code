/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RenderLine, Span, SpanStyle } from './types.js';

const INLINE_TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;

export function renderInline(text: string, base: SpanStyle = {}): Span[] {
  const spans: Span[] = [];
  let cursor = 0;
  INLINE_TOKEN.lastIndex = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      spans.push({ text: text.slice(cursor, index), style: base });
    }
    const token = match[0];
    if (token.startsWith('`')) {
      spans.push({
        text: token.slice(1, -1),
        style: { ...base, color: 'cyan' },
      });
    } else if (token.startsWith('**')) {
      spans.push({ text: token.slice(2, -2), style: { ...base, bold: true } });
    } else {
      spans.push({
        text: token.slice(1, -1),
        style: { ...base, italic: true },
      });
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), style: base });
  }
  return spans.filter((span) => span.text.length > 0);
}

export function lineOf(spans: Span[]): RenderLine {
  return { spans, plain: spans.map((span) => span.text).join('') };
}

/**
 * Renders a streaming markdown fragment into styled lines.
 *
 * Subset intentionally small for the skeleton: headings, fenced code,
 * blockquotes, and inline bold/italic/code. Paragraph reflow happens in the
 * renderer (wrap + viewport), not here, so partial chunks stay append-only.
 */
export function renderMarkdown(text: string): RenderLine[] {
  const lines: RenderLine[] = [];
  let inFence = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      lines.push(lineOf([{ text: line, style: { color: 'cyan' } }]));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      lines.push(lineOf(renderInline(heading[2], { bold: true })));
      continue;
    }
    const quote = /^\s*>\s?/.exec(line);
    if (quote) {
      const body = line.slice(quote[0].length);
      lines.push(lineOf(renderInline(body, { dim: true })));
      continue;
    }
    lines.push(lineOf(renderInline(line)));
  }
  while (lines.length > 0 && lines[lines.length - 1].plain === '') {
    lines.pop();
  }
  return lines;
}
