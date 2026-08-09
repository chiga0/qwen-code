/**
 * @license
 * Copyright 2026 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionBlock, SessionChunk, ToolBlock } from './types.js';

export type ModelListener = () => void;

/**
 * Renderer-agnostic session model that folds stream chunks into blocks.
 *
 * This is the neutral model layer the renderer binds to; the SolidJS view
 * observes it through `subscribe`, so the streaming semantics stay testable
 * without a terminal or @opentui runtime.
 */
export class StreamingSessionModel {
  private blocks: SessionBlock[] = [];
  private streaming = true;
  private listeners = new Set<ModelListener>();

  append(chunk: SessionChunk): void {
    switch (chunk.kind) {
      case 'thinking':
        this.appendText('thinking', chunk.text);
        break;
      case 'markdown':
        this.appendText('markdown', chunk.text);
        break;
      case 'tool-start':
        this.blocks.push({
          kind: 'tool',
          id: chunk.id,
          name: chunk.name,
          state: 'running',
          detail: chunk.detail ?? '',
          result: '',
        });
        break;
      case 'tool-update': {
        const tool = this.findTool(chunk.id);
        if (tool) {
          if (chunk.detail !== undefined) {
            tool.detail = chunk.detail;
          }
          if (chunk.state) {
            tool.state = chunk.state;
          }
        }
        break;
      }
      case 'tool-result': {
        const tool = this.findTool(chunk.id);
        if (tool) {
          tool.result = chunk.result;
          if (tool.state === 'running') {
            tool.state = 'done';
          }
        }
        break;
      }
      default:
        break;
    }
    this.notify();
  }

  finish(): void {
    if (!this.streaming) {
      return;
    }
    this.streaming = false;
    this.notify();
  }

  getBlocks(): readonly SessionBlock[] {
    return this.blocks;
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  subscribe(listener: ModelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private appendText(kind: 'thinking' | 'markdown', text: string): void {
    if (text.length === 0) {
      return;
    }
    const last = this.blocks[this.blocks.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      this.blocks.push({ kind, text });
    }
  }

  private findTool(id: string): ToolBlock | undefined {
    const block = this.blocks.find((b) => b.kind === 'tool' && b.id === id);
    return block && block.kind === 'tool' ? block : undefined;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
