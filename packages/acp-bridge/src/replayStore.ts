/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BridgeEvent } from './eventBus.js';

export interface ReplayStore {
  append(event: BridgeEvent): void;
  snapshot(): BridgeEvent[];
  close(): void;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly events: BridgeEvent[] = [];
  private closed = false;

  append(event: BridgeEvent): void {
    if (this.closed) return;
    this.events.push(event);
  }

  snapshot(): BridgeEvent[] {
    return this.events.slice();
  }

  close(): void {
    this.closed = true;
    this.events.length = 0;
  }
}

export interface FileReplayStoreOptions {
  dir: string;
  sessionId: string;
  deleteOnClose?: boolean;
}

export function fileReplayStorePath(dir: string, sessionId: string): string {
  return path.join(dir, `${safeFileSegment(sessionId)}.jsonl`);
}

export function deleteFileReplayStore(dir: string, sessionId: string): void {
  try {
    fs.rmSync(fileReplayStorePath(dir, sessionId), { force: true });
  } catch {
    // Best-effort cleanup for runtime cache. A failure should not turn a
    // successful session close/delete into a user-visible error.
  }
}

/**
 * Append-only replay store for daemon UI events.
 *
 * Chat history JSONL stores semantic conversation records; this store keeps
 * the exact daemon event projection used by web clients. That lets live
 * `/load` recover pending tools, permission requests, subagent updates, and
 * turn sentinels without retaining an unbounded in-memory replay array.
 */
export class FileReplayStore implements ReplayStore {
  private readonly dir: string;
  private readonly sessionId: string;
  private readonly filePath: string;
  private readonly deleteOnClose: boolean;
  private readonly fallbackEvents: BridgeEvent[] = [];
  private failed = false;
  private closed = false;

  constructor(opts: FileReplayStoreOptions) {
    this.dir = opts.dir;
    this.sessionId = opts.sessionId;
    this.filePath = fileReplayStorePath(this.dir, this.sessionId);
    this.deleteOnClose = opts.deleteOnClose ?? true;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  append(event: BridgeEvent): void {
    if (this.closed) return;
    if (this.failed) {
      this.fallbackEvents.push(event);
      return;
    }
    try {
      fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
    } catch {
      // `EventBus.publish()` is a never-throw hot path. If the temporary
      // replay file becomes unavailable, preserve correctness for the current
      // process by falling back to memory for events after the failure.
      this.failed = true;
      this.fallbackEvents.push(event);
    }
  }

  snapshot(): BridgeEvent[] {
    const events: BridgeEvent[] = [];
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        for (const line of raw.split('\n')) {
          if (!line) continue;
          try {
            events.push(JSON.parse(line) as BridgeEvent);
          } catch {
            // A malformed temp replay line should not make `/load` fail.
            // The store is best-effort runtime state; later valid lines still
            // carry useful UI history.
          }
        }
      }
    } catch {
      // Fall through to whatever fallback events we still have in memory.
    }
    return events.concat(this.fallbackEvents);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.deleteOnClose) {
      deleteFileReplayStore(this.dir, this.sessionId);
    }
    this.fallbackEvents.length = 0;
  }
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}
