/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MousePress,
  SelectionRange,
  TerminalMouseEvent,
} from './types.js';
import { clamp, maxScrollTop } from './render.js';

export const WHEEL_STEP = 3;

// eslint-disable-next-line no-control-regex
const SGR_MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;
// eslint-disable-next-line no-control-regex
export const SGR_MOUSE_GLOBAL = /\x1b\[<\d+;\d+;\d+[Mm]/g;

/** Decodes an SGR mouse report (`ESC[<b;x;yM/m`) into 0-based cells. */
export function parseMouseSequence(seq: string): TerminalMouseEvent | null {
  const match = SGR_MOUSE.exec(seq);
  if (!match) {
    return null;
  }
  const b = Number(match[1]);
  const col = Number(match[2]) - 1;
  const row = Number(match[3]) - 1;
  const pressed = match[4] === 'M';
  if ((b & 64) !== 0) {
    return {
      kind: (b & 1) !== 0 ? 'wheel-down' : 'wheel-up',
      button: 'left',
      col,
      row,
    };
  }
  const code = b & 3;
  const button: MousePress =
    code === 0 ? 'left' : code === 1 ? 'middle' : 'right';
  if (!pressed) {
    return { kind: 'release', button, col, row };
  }
  if ((b & 32) !== 0) {
    // Code 3 with the motion bit is a button-less hover move.
    return { kind: code === 3 ? 'move' : 'drag', button, col, row };
  }
  return { kind: 'press', button, col, row };
}

export function wheelScroll(
  scrollTop: number,
  kind: 'wheel-up' | 'wheel-down',
  totalRows: number,
  viewRows: number,
): number {
  const delta = kind === 'wheel-up' ? -WHEEL_STEP : WHEEL_STEP;
  return clamp(scrollTop + delta, 0, maxScrollTop(totalRows, viewRows));
}

export interface DocPoint {
  row: number;
  col: number;
}

export function normalizeSelection(
  anchor: DocPoint,
  focus: DocPoint,
): SelectionRange {
  const first =
    anchor.row < focus.row ||
    (anchor.row === focus.row && anchor.col <= focus.col)
      ? anchor
      : focus;
  const last = first === anchor ? focus : anchor;
  return {
    startRow: first.row,
    startCol: first.col,
    endRow: last.row,
    endCol: last.col + 1,
  };
}

/**
 * Copies plain columns as terminal columns, which holds for ASCII content;
 * wide-glyph columns can shift on the edges, acceptable for the skeleton.
 */
export function selectionText(
  range: SelectionRange,
  lineAt: (docRow: number) => string,
): string {
  const parts: string[] = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    const text = lineAt(row) ?? '';
    let slice: string;
    if (row === range.startRow && row === range.endRow) {
      slice = text.slice(range.startCol, range.endCol);
    } else if (row === range.startRow) {
      slice = text.slice(range.startCol);
    } else if (row === range.endRow) {
      slice = text.slice(0, range.endCol);
    } else {
      slice = text;
    }
    parts.push(slice.replace(/\s+$/, ''));
  }
  return parts.join('\n');
}

export function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`;
}
