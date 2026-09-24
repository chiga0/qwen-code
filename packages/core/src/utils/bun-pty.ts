/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_NAME = 'xterm';
const FLOW_CONTROL_PAUSE = '\x13';
const FLOW_CONTROL_RESUME = '\x11';

interface BunTerminalInit {
  cols: number;
  rows: number;
  data?: (terminal: unknown, chunk: string | Uint8Array) => void;
}

interface BunTerminal {
  write(data: string): unknown;
  resize(cols: number, rows: number): void;
  close(): void;
}

interface BunPtySubprocess {
  readonly pid: number;
  readonly exited: Promise<number>;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
  kill(signal?: string | number): void;
}

/**
 * The two Bun globals this backend drives. Injectable so the mapping, flow
 * control and validation below can be tested under vitest on Node, where
 * `Bun.Terminal` does not exist.
 */
export interface BunPtyRuntime {
  Terminal: new (init: BunTerminalInit) => BunTerminal;
  spawn(
    cmd: string[],
    options: {
      terminal: BunTerminal;
      cwd: string;
      env: Record<string, string | undefined>;
      detached: boolean;
      stdin: 'ignore';
      stdout: 'ignore';
      stderr: 'ignore';
    },
  ): BunPtySubprocess;
}

export interface BunPtySpawnOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string | undefined>;
  handleFlowControl?: boolean;
}

export interface BunPtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string) => void): { dispose(): void };
  onExit(callback: (e: { exitCode: number; signal?: number }) => void): {
    dispose(): void;
  };
  on(event: 'error', callback: (error: unknown) => void): BunPtyProcess;
  removeListener(
    event: 'error',
    callback: (error: unknown) => void,
  ): BunPtyProcess;
}

const defaultRuntime = (): BunPtyRuntime => {
  const bun = (globalThis as { Bun?: BunPtyRuntime }).Bun;
  if (!bun?.Terminal) {
    throw new Error('this runtime has no Bun.Terminal primitive');
  }
  return bun;
};

/**
 * Bun reports a signal death as `exitCode: null` plus a signal NAME, while
 * node-pty reports it as `exitCode: 0` plus the signal NUMBER — the shape
 * `ShellExecutionService.isSignalTermination` tests. A signal name outside
 * `os.constants.signals` falls back to the code `exited` resolved to, which is
 * the shell-style 128+n rather than a false "exited 0".
 */
export const toExitInfo = (
  exitCode: number | null,
  signalCode: string | null,
  waited: number,
): { exitCode: number; signal: number } => {
  const signal = signalCode
    ? (os.constants.signals as Record<string, number | undefined>)[signalCode]
    : undefined;
  if (signal) {
    return { exitCode: 0, signal };
  }
  return { exitCode: exitCode ?? waited, signal: 0 };
};

export const spawn = (
  file: string,
  args?: string[],
  options: BunPtySpawnOptions = {},
  runtime: BunPtyRuntime = defaultRuntime(),
): BunPtyProcess => {
  const cols = options.cols || DEFAULT_COLS;
  const rows = options.rows || DEFAULT_ROWS;
  const cwd = options.cwd || process.cwd();
  const env: Record<string, string | undefined> = {
    ...(options.env ?? process.env),
  };
  env['PWD'] = cwd;
  env['TERM'] = options.name || env['TERM'] || DEFAULT_NAME;

  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<
    (e: { exitCode: number; signal?: number }) => void
  >();
  const errorListeners = new Set<(error: unknown) => void>();
  const emitError = (error: unknown) => {
    for (const callback of [...errorListeners]) {
      callback(error);
    }
  };

  // node-pty intercepts these in JS and never forwards them, so the pty's own
  // IXON never sees them; Bun.Terminal has no pause()/resume() to delegate to.
  let paused = false;
  let buffered: string[] = [];
  const deliver = (chunk: string) => {
    if (paused) {
      buffered.push(chunk);
      return;
    }
    for (const callback of [...dataListeners]) {
      callback(chunk);
    }
  };

  const terminal = new runtime.Terminal({
    cols,
    rows,
    data: (_terminal, chunk) => {
      deliver(
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'),
      );
    },
  });

  const proc = runtime.spawn([file, ...(args ?? [])], {
    terminal,
    cwd,
    env,
    // Without this the child inherits Bun's process group, and the cancel path's
    // `process.kill(-pid, 'SIGTERM')` then fails with ESRCH and orphans every
    // grandchild. node-pty's POSIX spawn puts the child in its own group.
    detached: true,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  });

  let closed = false;
  const closeTerminal = () => {
    if (closed) {
      return;
    }
    closed = true;
    try {
      terminal.close();
    } catch (error) {
      emitError(error);
    }
  };

  // The terminal's own exit callback is not consulted: it fires after
  // `proc.exited` resolves and always reports code 0 with no signal. All output
  // has already been delivered by the time `exited` resolves, so this is also
  // the point to notify listeners rather than an earlier or later one.
  proc.exited.then(
    (waited) => {
      const info = toExitInfo(proc.exitCode, proc.signalCode, waited);
      for (const callback of [...exitListeners]) {
        callback(info);
      }
      closeTerminal();
    },
    (error) => {
      emitError(error);
      closeTerminal();
    },
  );

  const self: BunPtyProcess = {
    get pid() {
      return proc.pid;
    },
    write(data: string) {
      if (options.handleFlowControl) {
        if (data === FLOW_CONTROL_PAUSE) {
          paused = true;
          return;
        }
        if (data === FLOW_CONTROL_RESUME) {
          paused = false;
          const queued = buffered;
          buffered = [];
          for (const chunk of queued) {
            deliver(chunk);
          }
          return;
        }
      }
      try {
        terminal.write(data);
      } catch (error) {
        emitError(error);
      }
    },
    resize(nextCols: number, nextRows: number) {
      if (
        nextCols <= 0 ||
        nextRows <= 0 ||
        Number.isNaN(nextCols) ||
        Number.isNaN(nextRows) ||
        nextCols === Infinity ||
        nextRows === Infinity
      ) {
        throw new Error('resizing must be done using positive cols and rows');
      }
      terminal.resize(nextCols, nextRows);
    },
    // node-pty's UnixTerminal.kill() defaults to SIGHUP; Bun defaults to
    // SIGTERM, and the teardown paths call kill() bare.
    kill(signal?: string) {
      try {
        proc.kill(signal ?? 'SIGHUP');
      } catch {
        // Swallowed exactly like node-pty: the child may already be gone.
      }
    },
    onData(callback) {
      dataListeners.add(callback);
      return {
        dispose: () => {
          dataListeners.delete(callback);
        },
      };
    },
    onExit(callback) {
      exitListeners.add(callback);
      return {
        dispose: () => {
          exitListeners.delete(callback);
        },
      };
    },
    on(event, callback) {
      errorListeners.add(callback);
      return self;
    },
    removeListener(event, callback) {
      errorListeners.delete(callback);
      return self;
    },
  };
  return self;
};
