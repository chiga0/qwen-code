/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

// Real-runtime gate for the Bun PTY backend. The vitest suite drives
// packages/core/src/utils/bun-pty.ts through an injected fake runtime, so it
// cannot notice a Bun release changing Bun.Terminal or Bun.spawn semantics.
// This script runs the adapter against actual ptys under an actual Bun and
// asserts absolute expectations. It needs no dependencies: run it with
// `bun scripts/check-bun-pty.mjs` from the repository root.

// Read through globalThis, not the bare identifier: this file is linted with the
// repo's Node-script globals, where `Bun` is not defined.
const Bun = globalThis.Bun;
if (!Bun) {
  console.error('check-bun-pty: this gate must run under bun');
  process.exit(1);
}

const { spawn } = await import('../packages/core/src/utils/bun-pty.ts');

console.log(`RUNTIME bun ${Bun.version}`);

const ENV = { PATH: process.env.PATH, HOME: '/tmp', TERM: 'xterm-256color' };
const SPAWN_OPTIONS = {
  cwd: '/tmp',
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  env: ENV,
};

// Values the child printed as `echo "TAG=$(stty size)"`, oldest first. Tagged
// rather than matched as a bare line: the shell's prompt and its echo of the
// command can share a line with the value, which hides it from a line scan.
const tagged = (output, tag) =>
  [...output.matchAll(new RegExp(`${tag}=(\\d+) (\\d+)`, 'g'))].map(
    (m) => `${m[1]} ${m[2]}`,
  );

// Poll until the child has printed at least one `TAG=rows cols` and return
// every value seen. A substring marker cannot serve here: the shell echoes the
// command line back, so the marker is in the stream before the value is.
const waitForTagged = async (shell, tag, timeout = 8000) => {
  const deadline = Date.now() + timeout;
  let values = [];
  while (Date.now() < deadline) {
    values = tagged(shell.output(), tag);
    if (values.length) {
      return values;
    }
    await sleep(25);
  }
  return values;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

const report = (name, ok, detail) => {
  if (!ok) {
    failures.push(name);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const startShell = () => {
  const pty = spawn('/bin/sh', [], SPAWN_OPTIONS);
  let output = '';
  const exits = [];
  const errors = [];
  pty.onData((data) => {
    output += data;
  });
  pty.onExit((e) => exits.push(e));
  pty.on('error', (e) => errors.push(String(e?.message ?? e)));
  const waitFor = async (marker, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (output.includes(marker)) {
        return true;
      }
      await sleep(25);
    }
    return false;
  };
  const waitForExit = async (timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (!exits.length && Date.now() < deadline) {
      await sleep(25);
    }
    return exits[0];
  };
  return { pty, waitFor, waitForExit, errors, output: () => output };
};

{
  // The prompt must be up before the first write: bytes written earlier are
  // echoed by the line discipline and then lost, so the command never runs.
  // Measured identical under node-pty (6/6 immediate writes echoed, none
  // executed), so this is a shell-startup race, not a backend difference.
  const shell = startShell();
  await shell.waitFor('$');
  shell.pty.write('echo "GEOMETRY=$(stty size)"\n');
  const sizes = await waitForTagged(shell, 'GEOMETRY');
  report(
    'geometry-and-output',
    sizes.at(-1) === '24 80',
    `geometry=${sizes.join('|')}`,
  );
  shell.pty.write('exit 0\n');
  await sleep(300);
}

{
  const shell = startShell();
  await shell.waitFor('$');
  shell.pty.write('echo $((6*7))\n');
  const saw = await shell.waitFor('42');
  report('write-through', saw, `saw42=${saw}`);
  shell.pty.write('exit 0\n');
  await sleep(300);
}

{
  const shell = startShell();
  await shell.waitFor('$');
  shell.pty.resize(120, 40);
  // SIGWINCH reaches the child asynchronously, so re-ask instead of sleeping
  // once: a single fixed wait was observed reading the pre-resize geometry.
  let sizes = [];
  let attempts = 0;
  const deadline = Date.now() + 5000;
  while (!sizes.includes('40 120') && Date.now() < deadline) {
    shell.pty.write('echo "RESIZE=$(stty size)"\n');
    attempts++;
    await sleep(250);
    sizes = tagged(shell.output(), 'RESIZE');
  }
  report(
    'resize-visible',
    sizes.includes('40 120'),
    `sizes=${sizes.join('|')} attempts=${attempts}`,
  );
  shell.pty.write('exit 0\n');
  await sleep(300);
}

{
  const shell = startShell();
  await shell.waitFor('$');
  let message = '';
  try {
    shell.pty.resize(0, 24);
  } catch (e) {
    message = e.message;
  }
  report(
    'resize-validation',
    message === 'resizing must be done using positive cols and rows',
    `msg=${JSON.stringify(message)}`,
  );
  shell.pty.write('exit 0\n');
  await sleep(300);
}

{
  const shell = startShell();
  await shell.waitFor('$');
  shell.pty.write('exit 7\n');
  const exit = await shell.waitForExit();
  report(
    'natural-exit',
    exit?.exitCode === 7 &&
      (exit?.signal ?? 0) === 0 &&
      shell.errors.length === 0,
    `exit=${JSON.stringify(exit)} errors=${JSON.stringify(shell.errors)}`,
  );
}

for (const [name, signal, want] of [
  ['sigterm', 'SIGTERM', 15],
  ['sigkill', 'SIGKILL', 9],
  ['sighup', 'SIGHUP', 1],
]) {
  const pty = spawn('/bin/sh', ['-c', 'sleep 30'], SPAWN_OPTIONS);
  const exits = [];
  pty.onExit((e) => exits.push(e));
  await sleep(400);
  pty.kill(signal);
  const deadline = Date.now() + 5000;
  while (!exits.length && Date.now() < deadline) {
    await sleep(25);
  }
  const exit = exits[0];
  report(
    name,
    exit?.exitCode === 0 && exit?.signal === want,
    `exit=${JSON.stringify(exit)} want=${want}`,
  );
  await sleep(100);
}

{
  // The teardown paths call kill() bare; node-pty's default there is SIGHUP.
  const pty = spawn('/bin/sh', ['-c', 'sleep 30'], SPAWN_OPTIONS);
  const exits = [];
  pty.onExit((e) => exits.push(e));
  await sleep(400);
  pty.kill();
  const deadline = Date.now() + 5000;
  while (!exits.length && Date.now() < deadline) {
    await sleep(25);
  }
  const exit = exits[0];
  report(
    'bare-kill-sighup',
    exit?.exitCode === 0 && exit?.signal === 1,
    `exit=${JSON.stringify(exit)}`,
  );
}

{
  const shell = startShell();
  await shell.waitFor('$');
  let live = false;
  try {
    process.kill(shell.pty.pid, 0);
    live = true;
  } catch {
    live = false;
  }
  report(
    'pid-live',
    live && Number.isInteger(shell.pty.pid),
    `pid=${shell.pty.pid} live=${live}`,
  );
  shell.pty.write('exit 0\n');
  await sleep(300);
}

{
  const a = startShell();
  const b = startShell();
  await Promise.all([a.waitFor('$'), b.waitFor('$')]);
  a.pty.write('echo AAA_CONCURRENT\n');
  b.pty.write('echo BBB_CONCURRENT\n');
  const sawA = await a.waitFor('AAA_CONCURRENT');
  const sawB = await b.waitFor('BBB_CONCURRENT');
  report(
    'concurrent',
    sawA &&
      sawB &&
      a.pty.pid !== b.pty.pid &&
      !a.output().includes('BBB_CONCURRENT') &&
      !b.output().includes('AAA_CONCURRENT'),
    `a=${sawA} b=${sawB} pids=${a.pty.pid},${b.pty.pid}`,
  );
  a.pty.write('exit 0\n');
  b.pty.write('exit 0\n');
  await sleep(400);
}

{
  let delivered = 0;
  let cleanExits = 0;
  const started = Date.now();
  for (let i = 0; i < 20; i++) {
    const shell = startShell();
    await shell.waitFor('$');
    shell.pty.write(`echo SEQ${i}; exit 3\n`);
    if (await shell.waitFor(`SEQ${i}`, 5000)) {
      delivered++;
    }
    const exit = await shell.waitForExit();
    if (exit?.exitCode === 3 && (exit?.signal ?? 0) === 0) {
      cleanExits++;
    }
  }
  report(
    'sequential-20',
    delivered === 20 && cleanExits === 20,
    `delivered=${delivered} cleanExits=${cleanExits} ms=${Date.now() - started}`,
  );
}

{
  // ShellExecutionService's POSIX cancel path signals the process GROUP
  // (`process.kill(-pid, 'SIGTERM')`) and only falls back to pty.kill() when
  // that throws. If the child inherits Bun's group the fallback runs instead
  // and every grandchild is orphaned, so assert both halves here.
  const pty = spawn(
    '/bin/sh',
    ['-c', 'sleep 30 & sleep 31 & echo GROUP_READY; wait'],
    SPAWN_OPTIONS,
  );
  let output = '';
  pty.onData((data) => {
    output += data;
  });
  const readyDeadline = Date.now() + 8000;
  while (!output.includes('GROUP_READY') && Date.now() < readyDeadline) {
    await sleep(25);
  }
  const ps = (script) =>
    Bun.spawnSync(['/bin/sh', '-c', script]).stdout.toString().trim();
  const pid = pty.pid;
  const pgid = ps(`ps -o pgid= -p ${pid}`);
  const kids = ps(
    `ps -o pid=,ppid= -ax | awk '$2==${pid} && $1!=${pid} {print $1}'`,
  )
    .split('\n')
    .filter(Boolean);
  let groupTermLanded = true;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    groupTermLanded = false;
  }
  await sleep(1000);
  const alive = kids.filter((kid) => ps(`ps -o pid= -p ${kid}`) === kid);
  report(
    'process-group-cancel',
    output.includes('GROUP_READY') &&
      pgid === String(pid) &&
      groupTermLanded &&
      kids.length >= 2 &&
      alive.length === 0,
    `pgid=${pgid} pid=${pid} groupTerm=${groupTermLanded} kids=${kids.length} survivors=${alive.length}`,
  );
}

await sleep(500);
// Count exactly the sleeps this gate spawns, not every sleep on the machine: an
// unrelated one makes the check flake. `ps -o args=` also lists this probe's own
// command line, which contains the pattern text, so the `^…$` anchors are what
// keep it from matching itself; the `[s]leep` spelling is the same guard restated
// for a probe run without them.
const strays = Bun.spawnSync([
  '/bin/sh',
  '-c',
  "ps -o args= -ax | grep -cE '^[s]leep 3[01]$' || true",
])
  .stdout.toString()
  .trim();
report('no-stray-children', strays === '0', `sleepProcs=${strays}`);

console.log(
  `SUMMARY runtime=bun ${Bun.version} failed=${failures.length} names=${failures.join(',') || 'none'}`,
);
process.exit(failures.length ? 1 : 0);
