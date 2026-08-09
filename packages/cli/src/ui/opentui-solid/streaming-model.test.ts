/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';

import { StreamingSessionModel } from './streaming-model.js';
import type { ToolBlock } from './types.js';

describe('StreamingSessionModel', () => {
  it('coalesces consecutive chunks of the same kind', () => {
    const model = new StreamingSessionModel();
    model.append({ kind: 'markdown', text: 'Hello ' });
    model.append({ kind: 'markdown', text: 'world' });
    expect(model.getBlocks()).toEqual([
      { kind: 'markdown', text: 'Hello world' },
    ]);
  });

  it('starts a new block when the kind changes', () => {
    const model = new StreamingSessionModel();
    model.append({ kind: 'thinking', text: 'hmm' });
    model.append({ kind: 'markdown', text: 'answer' });
    model.append({ kind: 'thinking', text: 'more' });
    expect(model.getBlocks().map((block) => block.kind)).toEqual([
      'thinking',
      'markdown',
      'thinking',
    ]);
  });

  it('tracks the tool lifecycle', () => {
    const model = new StreamingSessionModel();
    model.append({
      kind: 'tool-start',
      id: 't1',
      name: 'read_file',
      detail: 'a.ts',
    });
    model.append({ kind: 'tool-update', id: 't1', detail: 'a.ts (10 lines)' });
    let tool = model.getBlocks()[0] as ToolBlock;
    expect(tool.state).toBe('running');
    model.append({ kind: 'tool-result', id: 't1', result: 'contents' });
    tool = model.getBlocks()[0] as ToolBlock;
    expect(tool.state).toBe('done');
    expect(tool.result).toBe('contents');
    expect(tool.detail).toBe('a.ts (10 lines)');
  });

  it('keeps an error state set via update after the result arrives', () => {
    const model = new StreamingSessionModel();
    model.append({ kind: 'tool-start', id: 't1', name: 'shell' });
    model.append({ kind: 'tool-update', id: 't1', state: 'error' });
    model.append({ kind: 'tool-result', id: 't1', result: 'exit 1' });
    const tool = model.getBlocks()[0] as ToolBlock;
    expect(tool.state).toBe('error');
  });

  it('ignores updates for unknown tool ids and empty text', () => {
    const model = new StreamingSessionModel();
    model.append({ kind: 'tool-update', id: 'missing', detail: 'x' });
    model.append({ kind: 'markdown', text: '' });
    expect(model.getBlocks()).toEqual([]);
  });

  it('notifies listeners on every mutation and supports unsubscribe', () => {
    const model = new StreamingSessionModel();
    const listener = vi.fn();
    const unsubscribe = model.subscribe(listener);
    model.append({ kind: 'markdown', text: 'a' });
    model.finish();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    model.append({ kind: 'markdown', text: 'b' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('finishes only once', () => {
    const model = new StreamingSessionModel();
    const listener = vi.fn();
    model.subscribe(listener);
    model.finish();
    model.finish();
    expect(model.isStreaming()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
