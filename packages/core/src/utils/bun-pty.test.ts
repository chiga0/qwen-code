/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { spawn, toExitInfo } from './bun-pty.js';

type TerminalInit = {
  cols: number;
  rows: number;
  data?: (terminal: unknown, chunk: string | Uint8Array) => void;
};

type SpawnOptions = {
  terminal: unknown;
  cwd: string;
  env: Record<string, string | undefined>;
  detached: boolean;
  stdin: 'ignore';
  stdout: 'ignore';
  stderr: 'ignore';
};

class FakeTerminal {
  readonly cols: number;
  readonly rows: number;
  readonly writes: string[] = [];
  readonly resizes: Array<[number, number]> = [];
  closeCount = 0;
  private readonly data?: (
    terminal: unknown,
    chunk: string | Uint8Array,
  ) => void;

  constructor(init: TerminalInit) {
    this.cols = init.cols;
    this.rows = init.rows;
    this.data = init.data;
  }

  write(data: string): number {
    this.writes.push(data);
    return data.length;
  }

  resize(cols: number, rows: number): void {
    this.resizes.push([cols, rows]);
  }

  close(): void {
    this.closeCount++;
  }

  emit(chunk: string | Uint8Array): void {
    this.data?.(this, chunk);
  }
}

class FakeProc {
  readonly pid = 4242;
  exitCode: number | null = 0;
  signalCode: string | null = null;
  readonly kills: Array<string | number> = [];
  readonly exited: Promise<number>;
  private settle!: (code: number) => void;
  private fail!: (error: unknown) => void;

  constructor() {
    this.exited = new Promise<number>((resolve, reject) => {
      this.settle = resolve;
      this.fail = reject;
    });
    // Rejections are always observed by the adapter, but a test that never
    // settles would leave an unhandled rejection behind.
    this.exited.catch(() => {});
  }

  kill(signal?: string | number): void {
    this.kills.push(signal ?? 'SIGTERM');
  }

  exit(code: number, exitCode: number | null, signalCode: string | null): void {
    this.exitCode = exitCode;
    this.signalCode = signalCode;
    this.settle(code);
  }

  errorWith(error: unknown): void {
    this.fail(error);
  }
}

function fakeRuntime() {
  const terminals: FakeTerminal[] = [];
  const procs: FakeProc[] = [];
  const calls: Array<{ cmd: string[]; options: SpawnOptions }> = [];
  const events: string[] = [];
  return {
    terminals,
    procs,
    calls,
    events,
    runtime: {
      Terminal: class extends FakeTerminal {
        constructor(init: TerminalInit) {
          super(init);
          terminals.push(this);
        }
      },
      spawn(cmd: string[], options: SpawnOptions) {
        const proc = new FakeProc();
        calls.push({ cmd, options });
        procs.push(proc);
        return proc;
      },
    },
  };
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

describe('toExitInfo', () => {
  it('reports a natural exit with no signal', () => {
    expect(toExitInfo(7, null, 7)).toEqual({ exitCode: 7, signal: 0 });
  });

  it('maps a signal death onto node-pty’s exitCode 0 shape', () => {
    // Measured node-pty control arm: SIGTERM {0,15}, SIGKILL {0,9}, SIGHUP {0,1}.
    expect(toExitInfo(null, 'SIGTERM', 143)).toEqual({
      exitCode: 0,
      signal: 15,
    });
    expect(toExitInfo(null, 'SIGKILL', 137)).toEqual({
      exitCode: 0,
      signal: 9,
    });
    expect(toExitInfo(null, 'SIGHUP', 129)).toEqual({ exitCode: 0, signal: 1 });
  });

  it('falls back to the awaited code for a signal name os.constants does not know', () => {
    // Reporting 0 here would claim success for a killed command; the awaited
    // code is the shell-style 128+n.
    expect(toExitInfo(null, 'SIGMadeUp', 143)).toEqual({
      exitCode: 143,
      signal: 0,
    });
  });
});

describe('spawn', () => {
  it('prepends the file to the argument list', () => {
    const { runtime, calls } = fakeRuntime();
    spawn('/bin/sh', ['-c', 'true'], {}, runtime);
    expect(calls[0]?.cmd).toEqual(['/bin/sh', '-c', 'true']);
  });

  it('spawns the child into its own process group', () => {
    const { runtime, calls } = fakeRuntime();
    spawn('/bin/sh', [], {}, runtime);
    expect(calls[0]?.options.detached).toBe(true);
  });

  it('derives TERM from the name option and PWD from cwd, like node-pty', () => {
    const { runtime, calls } = fakeRuntime();
    spawn(
      '/bin/sh',
      [],
      {
        name: 'xterm-256color',
        cwd: '/tmp/work',
        env: { TERM: 'screen', PATH: '/bin' },
      },
      runtime,
    );
    const env = calls[0]!.options.env;
    // `name` wins over env.TERM: that is where both consumers' TERM comes from.
    expect(env['TERM']).toBe('xterm-256color');
    expect(env['PWD']).toBe('/tmp/work');
    expect(env['PATH']).toBe('/bin');
  });

  it('falls back to env.TERM then to xterm, and defaults the geometry', () => {
    const { runtime, calls, terminals } = fakeRuntime();
    spawn('/bin/sh', [], { env: { TERM: 'vt100' } }, runtime);
    expect(calls[0]!.options.env['TERM']).toBe('vt100');
    expect(terminals[0]!.cols).toBe(80);
    expect(terminals[0]!.rows).toBe(24);

    const bare = fakeRuntime();
    spawn('/bin/sh', [], { env: {} }, bare.runtime);
    expect(bare.calls[0]!.options.env['TERM']).toBe('xterm');
  });

  it('delivers terminal data to listeners, decoding byte chunks', async () => {
    const { runtime, terminals } = fakeRuntime();
    const seen: string[] = [];
    const pty = spawn('/bin/sh', [], {}, runtime);
    pty.onData((data) => seen.push(data));

    terminals[0]!.emit('hello');
    terminals[0]!.emit(Buffer.from('bytes', 'utf8'));
    expect(seen).toEqual(['hello', 'bytes']);
  });

  it('stops delivering once the data disposable runs', () => {
    const { runtime, terminals } = fakeRuntime();
    const seen: string[] = [];
    const pty = spawn('/bin/sh', [], {}, runtime);
    const disposable = pty.onData((data) => seen.push(data));

    terminals[0]!.emit('first');
    disposable.dispose();
    terminals[0]!.emit('second');
    expect(seen).toEqual(['first']);
  });

  it('forwards writes, and reports a throwing terminal through the error listeners', () => {
    const { runtime, terminals } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    pty.write('ls -l\n');
    expect(terminals[0]!.writes).toEqual(['ls -l\n']);

    const errors: unknown[] = [];
    const onError = (e: unknown) => errors.push(e);
    pty.on('error', onError);
    terminals[0]!.write = () => {
      throw new Error('EIO');
    };
    pty.write('more');
    expect(errors).toHaveLength(1);

    pty.removeListener('error', onError);
    pty.write('again');
    expect(errors).toHaveLength(1);
  });

  it('intercepts the flow-control strings only when asked, and buffers while paused', () => {
    const { runtime, terminals } = fakeRuntime();
    const seen: string[] = [];
    const pty = spawn('/bin/sh', [], { handleFlowControl: true }, runtime);
    pty.onData((data) => seen.push(data));

    pty.write('a\x13b');
    expect(terminals[0]!.writes).toEqual(['a\x13b']);

    pty.write('\x13');
    expect(terminals[0]!.writes).toEqual(['a\x13b']);
    terminals[0]!.emit('held');
    expect(seen).toEqual([]);

    pty.write('\x11');
    expect(terminals[0]!.writes).toEqual(['a\x13b']);
    expect(seen).toEqual(['held']);
    terminals[0]!.emit('live');
    expect(seen).toEqual(['held', 'live']);
  });

  it('forwards a bare control string when flow control was not requested', () => {
    const { runtime, terminals } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    pty.write('\x13');
    expect(terminals[0]!.writes).toEqual(['\x13']);
  });

  it('validates resize the way node-pty does', () => {
    const { runtime, terminals } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    expect(() => pty.resize(0, 24)).toThrow(
      'resizing must be done using positive cols and rows',
    );
    expect(() => pty.resize(80, Number.NaN)).toThrow(
      'resizing must be done using positive cols and rows',
    );
    expect(() => pty.resize(Infinity, 24)).toThrow(
      'resizing must be done using positive cols and rows',
    );
    expect(terminals[0]!.resizes).toEqual([]);

    pty.resize(132, 43);
    expect(terminals[0]!.resizes).toEqual([[132, 43]]);
  });

  it('defaults kill to SIGHUP and passes an explicit signal through', () => {
    const { runtime, procs } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    pty.kill();
    pty.kill('SIGKILL');
    expect(procs[0]!.kills).toEqual(['SIGHUP', 'SIGKILL']);
  });

  it('swallows a kill that throws because the child is already gone', () => {
    const { runtime, procs } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    procs[0]!.kill = () => {
      throw new Error('ESRCH');
    };
    expect(() => pty.kill()).not.toThrow();
  });

  it('exposes the subprocess pid', () => {
    const { runtime } = fakeRuntime();
    expect(spawn('/bin/sh', [], {}, runtime).pid).toBe(4242);
  });

  it('reports the exit after the subprocess settles, then closes the terminal', async () => {
    const { runtime, terminals, procs, events } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    pty.onExit((info) => {
      events.push(`exit:${info.exitCode}:${info.signal}`);
      events.push(`closedAtExit:${terminals[0]!.closeCount}`);
    });

    procs[0]!.exit(7, 7, null);
    await settled();

    expect(events).toEqual(['exit:7:0', 'closedAtExit:0']);
    expect(terminals[0]!.closeCount).toBe(1);
  });

  it('reports a cancelled command as a signal termination, not exit 143', async () => {
    const { runtime, procs } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    const infos: Array<{ exitCode: number; signal?: number }> = [];
    pty.onExit((info) => infos.push(info));

    procs[0]!.exit(143, null, 'SIGTERM');
    await settled();

    expect(infos).toEqual([{ exitCode: 0, signal: 15 }]);
  });

  it('closes the terminal exactly once when the subprocess rejects', async () => {
    const { runtime, terminals, procs } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    const errors: unknown[] = [];
    pty.on('error', (e) => errors.push(e));
    pty.onExit(() => errors.push('exit fired'));

    procs[0]!.errorWith(new Error('spawn failed'));
    await settled();

    expect(errors).toHaveLength(1);
    expect(terminals[0]!.closeCount).toBe(1);
  });

  it('stops notifying a disposed exit listener', async () => {
    const { runtime, procs } = fakeRuntime();
    const pty = spawn('/bin/sh', [], {}, runtime);
    const infos: unknown[] = [];
    const disposable = pty.onExit((info) => infos.push(info));
    disposable.dispose();

    procs[0]!.exit(0, 0, null);
    await settled();

    expect(infos).toEqual([]);
  });
});
