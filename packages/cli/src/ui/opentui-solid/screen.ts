/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ColorName, RenderLine, SpanStyle } from './types.js';

const SGR_COLORS: Record<ColorName, number> = {
  gray: 90,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
};

export function styleToSgr(style: SpanStyle): string {
  const codes: number[] = [];
  if (style.bold) {
    codes.push(1);
  }
  if (style.dim) {
    codes.push(2);
  }
  if (style.italic) {
    codes.push(3);
  }
  if (style.inverse) {
    codes.push(7);
  }
  if (style.color) {
    codes.push(SGR_COLORS[style.color]);
  }
  return codes.length > 0 ? `\x1b[${codes.join(';')}m` : '';
}

export function paintLine(line: RenderLine): string {
  let out = '';
  for (const span of line.spans) {
    const sgr = styleToSgr(span.style);
    out += sgr ? `${sgr}${span.text}\x1b[0m` : span.text;
  }
  return out;
}

/** Toggles inverse video on the visible cell range [startCol, endCol). */
export function inverseRange(
  encoded: string,
  startCol: number,
  endCol: number,
): string {
  if (endCol <= startCol) {
    return encoded;
  }
  let out = '';
  let col = 0;
  let inside = false;
  let i = 0;
  while (i < encoded.length) {
    const ch = encoded[i];
    if (ch === '\x1b') {
      // eslint-disable-next-line no-control-regex
      const csi = /^\x1b\[[0-9;]*m/.exec(encoded.slice(i));
      const seq = csi ? csi[0] : encoded[i];
      out += seq;
      // A full reset drops the inverse we opened, so reopen it after.
      if (inside && (seq === '\x1b[0m' || seq === '\x1b[m')) {
        out += '\x1b[7m';
      }
      i += seq.length;
      continue;
    }
    const entering = col === startCol && !inside;
    const leaving = col === endCol && inside;
    if (entering) {
      out += '\x1b[7m';
      inside = true;
    } else if (leaving) {
      out += '\x1b[27m';
      inside = false;
    }
    out += ch;
    i++;
    col++;
  }
  if (inside) {
    out += '\x1b[27m';
  }
  return out;
}

/**
 * Erase-free compositor: never clears the screen and only rewrites rows that
 * changed, so unchanged content keeps its cells between frames (no `\x1b[2J`
 * flicker pass). Rows that disappear are wiped once with a line clear.
 */
export class EraseFreePainter {
  private prev: string[] = [];

  constructor(private readonly write: (data: string) => void) {}

  paint(rows: string[]): void {
    let out = '';
    for (let i = 0; i < rows.length; i++) {
      if (this.prev[i] === rows[i]) {
        continue;
      }
      out += `\x1b[${i + 1};1H${rows[i]}\x1b[K`;
    }
    for (let i = rows.length; i < this.prev.length; i++) {
      out += `\x1b[${i + 1};1H\x1b[K`;
    }
    if (out.length > 0) {
      this.write(out);
    }
    this.prev = rows.slice();
  }

  clear(): void {
    this.prev = [];
  }
}
