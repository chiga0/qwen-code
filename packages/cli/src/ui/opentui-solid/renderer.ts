/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { layoutSession, maxScrollTop, type Layout } from './render.js';
import {
  SGR_MOUSE_GLOBAL,
  normalizeSelection,
  osc52,
  parseMouseSequence,
  selectionText,
  wheelScroll,
  type DocPoint,
} from './mouse.js';
import { EraseFreePainter, inverseRange, paintLine } from './screen.js';
import type { StreamingSessionModel } from './streaming-model.js';
import type {
  RenderLine,
  SelectionRange,
  Size,
  Span,
  TerminalBackend,
  TerminalMouseEvent,
} from './types.js';

/** Rows kept below the session viewport for the status line. */
export const STATUS_ROWS = 1;

export class MemoryBackend implements TerminalBackend {
  writes: string[] = [];

  constructor(
    public rows = 24,
    public cols = 80,
  ) {}

  write(data: string): void {
    this.writes.push(data);
  }

  getSize(): Size {
    return { rows: this.rows, cols: this.cols };
  }

  get output(): string {
    return this.writes.join('');
  }
}

export interface SolidRendererOptions {
  model: StreamingSessionModel;
  backend: TerminalBackend;
}

/**
 * Imperative reference renderer for the session skeleton.
 *
 * Later PRs swap the pipeline inside `paint` for @opentui/solid components
 * driven by the same model; mouse, scroll, selection and the erase-free
 * compositor semantics defined here stay the contract.
 */
export class SolidSessionRenderer {
  selection: SelectionRange | null = null;

  private scrollTop = 0;
  private sticky = true;
  private anchor: DocPoint | null = null;
  private lastLayout: Layout | null = null;
  private painter: EraseFreePainter;
  private unsubscribe: () => void;

  constructor(private readonly options: SolidRendererOptions) {
    this.painter = new EraseFreePainter((data) => options.backend.write(data));
    this.unsubscribe = options.model.subscribe(() => this.paint());
    this.paint();
  }

  getScrollTop(): number {
    return this.scrollTop;
  }

  getLayout(): Layout | null {
    return this.lastLayout;
  }

  paint(): void {
    const size = this.options.backend.getSize();
    const viewRows = Math.max(1, size.rows - STATUS_ROWS);
    const requested = this.sticky ? Number.MAX_SAFE_INTEGER : this.scrollTop;
    const layout = layoutSession(
      this.options.model.getBlocks(),
      { rows: viewRows, cols: size.cols },
      requested,
    );
    this.scrollTop = layout.scrollTop;
    this.lastLayout = layout;

    const rows: string[] = [];
    for (let i = 0; i < layout.rows.length; i++) {
      let encoded = paintLine(layout.rows[i]);
      const docRow = layout.scrollTop + i;
      if (
        this.selection &&
        docRow >= this.selection.startRow &&
        docRow <= this.selection.endRow
      ) {
        const startCol =
          docRow === this.selection.startRow ? this.selection.startCol : 0;
        const endCol =
          docRow === this.selection.endRow
            ? this.selection.endCol
            : Number.MAX_SAFE_INTEGER;
        encoded = inverseRange(encoded, startCol, endCol);
      }
      rows.push(encoded);
    }
    while (rows.length < viewRows) {
      rows.push('');
    }
    rows.push(paintLine(this.statusLine(layout, size)));
    this.painter.paint(rows);
  }

  handleData(data: string): void {
    for (const match of data.matchAll(SGR_MOUSE_GLOBAL)) {
      const event = parseMouseSequence(match[0]);
      if (event) {
        this.handleMouse(event);
      }
    }
  }

  handleMouse(event: TerminalMouseEvent): void {
    const size = this.options.backend.getSize();
    const viewRows = Math.max(1, size.rows - STATUS_ROWS);
    if (event.kind === 'wheel-up' || event.kind === 'wheel-down') {
      const layout = this.lastLayout;
      const total = layout ? layout.totalRows : 0;
      this.scrollTop = wheelScroll(this.scrollTop, event.kind, total, viewRows);
      this.sticky = this.scrollTop >= maxScrollTop(total, viewRows);
      this.paint();
      return;
    }
    if (event.row >= viewRows || event.button !== 'left') {
      return;
    }
    const doc: DocPoint = { row: this.scrollTop + event.row, col: event.col };
    if (event.kind === 'press') {
      this.anchor = doc;
      this.selection = null;
      this.paint();
    } else if (event.kind === 'drag' && this.anchor) {
      this.selection = normalizeSelection(this.anchor, doc);
      this.paint();
    } else if (event.kind === 'release' && this.anchor) {
      const anchor = this.anchor;
      this.anchor = null;
      if (anchor.row !== doc.row || anchor.col !== doc.col) {
        this.selection = normalizeSelection(anchor, doc);
        this.copy(this.selection);
      } else {
        this.selection = null;
      }
      this.paint();
    }
  }

  dispose(): void {
    this.unsubscribe();
  }

  private copy(range: SelectionRange): void {
    const layout = this.lastLayout;
    if (!layout) {
      return;
    }
    const text = selectionText(
      range,
      (row) => layout.allRows[row]?.plain ?? '',
    );
    if (text.replace(/\s/g, '').length > 0) {
      this.options.backend.write(osc52(text));
    }
  }

  private statusLine(layout: Layout, size: Size): RenderLine {
    const streaming = this.options.model.isStreaming();
    const spans: Span[] = streaming
      ? [
          { text: '● ', style: { color: 'yellow' } },
          { text: 'streaming', style: {} },
        ]
      : [
          { text: '✓ ', style: { color: 'green' } },
          { text: 'idle', style: {} },
        ];
    if (this.selection) {
      const text = selectionText(
        this.selection,
        (row) => layout.allRows[row]?.plain ?? '',
      );
      spans.push({ text: ` [${text.length} selected]`, style: { dim: true } });
    }
    const viewRows = Math.max(1, size.rows - STATUS_ROWS);
    if (layout.totalRows > viewRows) {
      const top = layout.scrollTop + 1;
      const bottom = Math.min(layout.scrollTop + viewRows, layout.totalRows);
      spans.push({
        text: ` [${top}-${bottom}/${layout.totalRows}]`,
        style: { dim: true },
      });
    }
    return { spans, plain: spans.map((span) => span.text).join('') };
  }
}
