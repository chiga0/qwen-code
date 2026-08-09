/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

export type ColorName =
  | 'gray'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white';

export interface SpanStyle {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  inverse?: boolean;
  color?: ColorName;
}

export interface Span {
  text: string;
  style: SpanStyle;
}

export interface RenderLine {
  spans: Span[];
  plain: string;
}

export interface ThinkingBlock {
  kind: 'thinking';
  text: string;
}

export interface MarkdownBlock {
  kind: 'markdown';
  text: string;
}

export type ToolState = 'running' | 'done' | 'error';

export interface ToolBlock {
  kind: 'tool';
  id: string;
  name: string;
  state: ToolState;
  detail: string;
  result: string;
}

export type SessionBlock = ThinkingBlock | MarkdownBlock | ToolBlock;

export type SessionChunk =
  | { kind: 'thinking'; text: string }
  | { kind: 'markdown'; text: string }
  | { kind: 'tool-start'; id: string; name: string; detail?: string }
  | { kind: 'tool-update'; id: string; detail?: string; state?: ToolState }
  | { kind: 'tool-result'; id: string; result: string };

export interface Size {
  rows: number;
  cols: number;
}

export interface TerminalBackend {
  write(data: string): void;
  getSize(): Size;
}

export type MousePress = 'left' | 'middle' | 'right';

export type MouseEventKind =
  | 'press'
  | 'drag'
  | 'release'
  | 'move'
  | 'wheel-up'
  | 'wheel-down';

export interface TerminalMouseEvent {
  kind: MouseEventKind;
  button: MousePress;
  col: number;
  row: number;
}

/** Normalized selection in document (fully laid-out) coordinates. */
export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  /** Exclusive. */
  endCol: number;
}
