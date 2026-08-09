/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  MemoryBackend,
  SolidSessionRenderer,
  STATUS_ROWS,
} from './renderer.js';
import { StreamingSessionModel } from './streaming-model.js';

function setup(rows = 24, cols = 80) {
  const backend = new MemoryBackend(rows, cols);
  const model = new StreamingSessionModel();
  const renderer = new SolidSessionRenderer({ model, backend });
  return { backend, model, renderer };
}

function fill(model: StreamingSessionModel, count: number, offset = 0): void {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(`line-${i + offset}`);
  }
  const text = offset > 0 ? `\n${lines.join('\n')}` : lines.join('\n');
  model.append({ kind: 'markdown', text });
}

function osc52Payloads(backend: MemoryBackend): string[] {
  return backend.writes
    .filter((write) => write.startsWith('\x1b]52;c;'))
    .map((write) =>
      Buffer.from(
        write.slice('\x1b]52;c;'.length, write.length - 1),
        'base64',
      ).toString('utf8'),
    );
}

describe('SolidSessionRenderer', () => {
  it('renders streamed content without erasing the screen', () => {
    const { backend, model } = setup();
    fill(model, 3);
    model.finish();
    const output = backend.output;
    expect(output).toContain('line-0');
    expect(output).toContain('line-2');
    expect(output).toContain('\x1b[32m✓');
    expect(output).not.toContain('\x1b[2J');
    expect(output).not.toContain('\x1b[J');
  });

  it('shows streaming status until the model finishes', () => {
    const { backend, model } = setup();
    fill(model, 1);
    expect(backend.writes.join('')).toContain('streaming');
    model.finish();
    expect(backend.output).toContain('idle');
  });

  it('pins the viewport to the tail while streaming', () => {
    const { model, renderer } = setup();
    fill(model, 30);
    expect(renderer.getScrollTop()).toBe(30 - (24 - STATUS_ROWS));
  });

  it('stops following the tail after wheel-up and resumes on return', () => {
    const { backend, model, renderer } = setup();
    fill(model, 30);
    const viewRows = backend.rows - STATUS_ROWS;
    const wheelDown = () =>
      renderer.handleMouse({
        kind: 'wheel-down',
        button: 'left',
        col: 0,
        row: 0,
      });
    renderer.handleMouse({ kind: 'wheel-up', button: 'left', col: 0, row: 0 });
    expect(renderer.getScrollTop()).toBe(30 - viewRows - 3);
    fill(model, 5, 100);
    expect(renderer.getScrollTop()).toBe(30 - viewRows - 3);
    wheelDown();
    wheelDown();
    wheelDown();
    expect(renderer.getScrollTop()).toBe(35 - viewRows);
    fill(model, 1, 200);
    expect(renderer.getScrollTop()).toBe(36 - viewRows);
  });

  it('parses SGR wheel sequences from raw input', () => {
    const { model, renderer } = setup();
    fill(model, 30);
    const before = renderer.getScrollTop();
    renderer.handleData('junk\x1b[<64;1;1Mmore');
    expect(renderer.getScrollTop()).toBe(before - 3);
  });

  it('selects by drag and copies on release via OSC 52', () => {
    const { backend, model, renderer } = setup();
    fill(model, 30);
    const top = renderer.getScrollTop();
    renderer.handleData('\x1b[<0;1;1M');
    renderer.handleData('\x1b[<32;6;1M');
    expect(renderer.selection).toEqual({
      startRow: top,
      startCol: 0,
      endRow: top,
      endCol: 6,
    });
    expect(backend.output).toContain('\x1b[7m');
    renderer.handleData('\x1b[<0;6;1m');
    expect(osc52Payloads(backend)).toEqual([`line-${top}`.slice(0, 6)]);
  });

  it('clears the selection on a plain click without copying', () => {
    const { backend, model, renderer } = setup();
    fill(model, 30);
    renderer.handleData('\x1b[<0;4;2M');
    renderer.handleData('\x1b[<32;9;2M');
    expect(renderer.selection).not.toBeNull();
    const writesBefore = backend.writes.length;
    renderer.handleData('\x1b[<0;4;2m\x1b[<0;4;3M\x1b[<0;4;3m');
    expect(renderer.selection).toBeNull();
    expect(backend.writes.slice(writesBefore)).not.toContainEqual(
      expect.stringContaining('\x1b]52;c;'),
    );
  });

  it('ignores mouse events over the status line', () => {
    const { backend, model, renderer } = setup();
    fill(model, 30);
    const top = renderer.getScrollTop();
    renderer.handleData(`\x1b[<0;1;${backend.rows}M`);
    renderer.handleData(`\x1b[<0;5;${backend.rows}m`);
    expect(renderer.selection).toBeNull();
    expect(renderer.getScrollTop()).toBe(top);
  });

  it('repaints only changed rows on streaming updates', () => {
    const { backend, model } = setup();
    fill(model, 3);
    const writesBefore = backend.writes.length;
    model.append({ kind: 'markdown', text: '\nline-3' });
    const repaint = backend.writes.slice(writesBefore).join('');
    expect(repaint).toContain('line-3');
    expect(repaint).not.toContain('line-0');
  });
});
