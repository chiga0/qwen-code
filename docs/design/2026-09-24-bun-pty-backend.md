# PTY backend for the Bun runtime

[English](2026-09-24-bun-pty-backend.md) | [简体中文](2026-09-24-bun-pty-backend.zh-CN.md)

Status: implemented. Every claim below marked as measured was measured on
darwin/arm64; the Linux leg runs in CI.

## Problem statement

The standalone release can be built for the Bun runtime, and Bun is the intended
default for that artifact. Every PTY consumer is nevertheless dead under Bun
today, because `loadPty()` short-circuits on `'bun' in process.versions` and
returns `impl: null` with the reason "the PTY backend is disabled under the Bun
runtime; use the Node runtime" (`packages/core/src/utils/getPty.ts`).

That single short-circuit has three user-visible consequences:

- the shell tool loses its PTY path and falls back to `child_process`, so
  commands run without a controlling terminal — no TTY detection, no line
  editing, no pager, no `SIGWINCH`, and the headless-terminal scrollback model
  that `ShellExecutionService` builds on never engages;
- the web terminal cannot start a shell at all: `WebTerminalRegistry` has no
  `child_process` fallback and returns `{ error: 'Failed to spawn shell' }` when
  `loadPty()` reports no backend;
- the agent-view PTY host, which loads its own copy of the same two backends, is
  equally unavailable.

Making Bun the default standalone runtime therefore requires a working PTY
backend under Bun first. This document scopes that backend.

## Why the existing backends cannot simply be loaded

`@lydell/node-pty` resolves under Bun — the prebuilt native module loads — but
the first spawn never delivers output and never exits. Measured on darwin/arm64
with the shipped Bun pin (1.3.14) and with Bun 1.4.0, a
`spawn('/bin/sh', ['-c', 'echo NODEPTY_OK; tty; exit 0'])` produced no data and
no exit within 6 s, where the same call under Node 24.19.0 completes
immediately with `{exitCode: 0, signal: 0}`. The existing comment in
`getPty.ts` ("Bun can load @lydell/node-pty, but it hangs under Desktop's
runtime") is therefore accurate, and the fallback to `node-pty` is moot: it is
the same native code path.

Bun ships its own pseudo-terminal primitive instead: `Bun.Terminal` creates the
pty and `Bun.spawn({ terminal })` attaches a child to it. That primitive is
available on the pinned Bun version and is the only PTY mechanism Bun offers.

## Goals

1. Under Bun on POSIX, `loadPty()` returns a backend whose `spawn()` produces a
   process object that the existing consumers can drive unchanged.
2. Behavioural parity with `@lydell/node-pty` on the surface those consumers
   actually touch, with every intentional divergence written down.
3. No change to the Node path. Under Node the two existing backends keep their
   current order, semantics, and error reporting.

## Non-goals

- **Windows.** ConPTY under Bun is unmeasured, and the Windows-specific host
  lifecycle work in `conpty-host.ts` and `web-terminal-registry.ts` is written
  against node-pty internals (`_agent._pty`, `_ptyNative.kill`,
  `_conoutSocketWorker`, `_isReady`) that a Bun backend does not have. Bun on
  Windows keeps today's disabled behaviour and its existing reason string.
- **The agent-view PTY host.** `packages/cli/src/agent-view/pty-host.ts` has its
  own loader and its own backend-name union. It is a separate consumer with a
  separate fallback contract, and folding it in would widen this change without
  adding evidence. Tracked as follow-up work.
- **Any change to the shell tool's own logic.** The consumers are not edited.

## Current state: the exact contract a backend must satisfy

Both call sites go through `ptyImpl.module.spawn(file, args, options)` and then
use the returned object directly.

`ShellExecutionService` (`packages/core/src/services/shellExecutionService.ts`)
spawns with `cwd`, `name`, `cols`, `rows`, `env`, `handleFlowControl: true`, and
`useConptyDll`, and then uses:

| Member                                            | Use                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `pid`                                             | `activePtys` key, `isPtyActive`, `windowsKillPid`, result reporting |
| `write(data)`                                     | the command itself, and terminal-query replies                      |
| `onData(cb)`                                      | returns a disposable; feeds the headless `Terminal`                 |
| `onExit(cb)`                                      | returns a disposable; drives finalization and background promotion  |
| `on('error', cb)` / `removeListener('error', cb)` | PTY error handler attach/detach                                     |
| `kill(signal?)`                                   | cancel path and process-exit teardown                               |

`WebTerminalRegistry` (`packages/core/src/services/web-terminal-registry.ts`)
spawns with `name`, `cols`, `rows`, `cwd`, `env`, and `useConptyDll`, and then
uses `pid`, `write`, `resize(cols, rows)`, `kill()`, `onData`, `onExit`. It also
reads `(spawned as { _isReady?: boolean })._isReady` and passes the object to
`noteConPtyHostReleased` / `releaseConPtyHost` / `disposeConoutWorker`; all three
return immediately off Windows, and `releaseConPtyHost` degrades to a warning
when `_agent` is absent, so a Bun object is safe there. The `_isReady` read is
`undefined !== false`, i.e. the same branch a POSIX node-pty object takes.

Nothing writes `'\x13'` or `'\x11'` — `handleFlowControl` is passed but no call
site emits the control strings that node-pty's JS layer intercepts. The option is
still honoured (Decision 7) because it is explicitly requested at the spawn site.

## Proposed solution

Add `packages/core/src/utils/bun-pty.ts` exporting a single `spawn(file, args,
options)` that builds a `Bun.Terminal`, attaches it to a `Bun.spawn` child, and
returns an object shaped like node-pty's `UnixTerminal` for the members listed
above. `loadPty()` gains one branch ahead of the two imports:

```ts
if ('bun' in process.versions) {
  if (process.platform === 'win32') {
    return { impl: null, loadError: <today's reason, unchanged> };
  }
  if (typeof globalThis.Bun?.Terminal !== 'function') {
    return { impl: null, loadError: <reason naming the missing primitive> };
  }
  const { spawn } = await import('./bun-pty.js');
  return { impl: { module: { spawn }, name: 'bun-terminal' }, loadError: null };
}
```

`PtyImplementation['name']` widens to `'lydell-node-pty' | 'node-pty' |
'bun-terminal'`, and so do the parallel unions in `shellExecutionService.ts`.
The dynamic import puts the adapter in its own chunk rather than keeping it out
of the Node bundle: `npm run bundle` emits a separate `dist/chunks/bun-pty-*.js`
whose only importer in the whole of `dist/` is the `await import()` inside the
Bun branch above, and the adapter reads `globalThis.Bun` instead of a bare `Bun`
identifier. So under Node the module is never evaluated, and evaluating it could
not throw a `ReferenceError` even if it were.

`loadPty()` keeps its contract: it never rejects, and a backend that throws on
import collapses to `impl: null` with the reason on the result.

## Design decisions

### 1. `Bun.Terminal` + `Bun.spawn({ terminal })`, not a reimplementation

The child's stdio is attached to the terminal (`stdin/stdout/stderr: 'ignore'`
on the `Bun.spawn` options, so Bun does not open a second pipe), and the pty
master is driven exclusively through the `Bun.Terminal` object. Measured on Bun
1.3.14 and 1.4.0: `cwd`, `cols`, `rows`, and `env` are all honoured (`pwd`,
`stty size`, and a marker variable read back correctly), writes reach the child,
`resize` is visible to the child mid-command, two concurrent ptys stay
independent, and 20 sequential spawns complete without a hang.

### 2. Exit information comes from the subprocess, not the terminal callback

`Bun.Terminal`'s `exit(terminal, code, signal)` callback is unusable: it fires
_after_ `proc.exited` resolves — measured more than 500 ms later, and only once
the event loop had nothing else pending — and it always reports `code=0,
signal=null` regardless of how the child died.

`proc.exited` resolving is the authoritative moment. At that point
`proc.exitCode` holds the exit status, or `null` when the child died on a
signal, and `proc.signalCode` holds the signal name (`'SIGTERM'`, `'SIGKILL'`,
`'SIGHUP'`) or `null`. `proc.killed` is `true` even after a natural exit and is
therefore not consulted.

### 3. Signal deaths are mapped onto node-pty's `{exitCode: 0, signal: n}` shape

node-pty reports a natural exit as `{exitCode: 7, signal: 0}`, `SIGTERM` as
`{exitCode: 0, signal: 15}`, and `SIGKILL` as `{exitCode: 0, signal: 9}`
(measured control arm, Node 24.19.0). `ShellExecutionService.isSignalTermination`
tests `signal !== null && signal !== 0`, and its documented PTY contract expects
a signal kill to carry `exitCode: 0` with a non-zero signal.

Bun's raw fields would break that: a cancelled command dies on `SIGTERM` with
`exitCode: null`, while `proc.exited` itself resolves to the shell-style 143.
Passed through unmapped, a cancelled command would be classified as a natural
exit 143 rather than a signal termination. The adapter therefore converts
`signalCode` to its number and reports `{exitCode: 0, signal: n}`, and reports
`{exitCode: proc.exitCode, signal: 0}` otherwise.

### 4. `onExit` fires when `proc.exited` resolves; no extra drain wait

node-pty defers its `exit` event until the read socket closes, and still
documents that data can arrive afterwards. Bun needs no such deferral: with a
5000-line burst from the child, every line had already been delivered to the
`data` callback when `proc.exited` resolved (`seen=5000` at that instant, on both
Bun 1.3.14 and 1.4.0). The adapter fires `onExit` synchronously in that
resolution, then closes the terminal. Adding a speculative extra tick would
delay every command's finalization for a race that measurement does not show.

The terminal is closed after the exit listeners run, so a late `data` callback
cannot outlive the object the consumers are holding.

### 5. `kill()` defaults to `SIGHUP`, not Bun's `SIGTERM`

`UnixTerminal.prototype.kill` is `process.kill(this.pid, signal || 'SIGHUP')`
inside a swallowed `try`. Callers rely on the default: the teardown path calls
`ptyProcess.kill()` bare. Bun's `proc.kill()` with no argument sends `SIGTERM`.
The adapter passes `signal ?? 'SIGHUP'` through to `proc.kill` so a bare `kill()`
means the same thing under both backends, and swallows the throw the same way.

### 6. Environment preparation mirrors node-pty's two mutations, and nothing else

`UnixTerminal` sets `env.PWD = cwd` and `env.TERM = opt.name || env.TERM ||
'xterm'` on its own copy of the options env before forking. Both are replicated:
the shell tool passes `name: launch?.env['TERM'] ?? 'xterm'` and the web terminal
passes `name: 'xterm-256color'`, so `TERM` in the child comes from `name`, not
from `env.TERM`.

node-pty's `_sanitizeEnv` (deleting `TMUX`, `TMUX_PANE`, `STY`, `WINDOW`,
`WINDOWID`, `TERMCAP`, `COLUMNS`, `LINES`) runs only when `opt.env ===
process.env` by identity. Neither call site does that — both pass a freshly
spread object — so replicating it would add unreachable code. It is deliberately
not replicated.

### 7. `handleFlowControl` is emulated in JS, and termios is left alone

node-pty's flow control is entirely in its JS layer: `Terminal.prototype.write`
compares the whole string against `'\x13'` / `'\x11'`, calls `pause()` /
`resume()` on the read socket, and does **not** forward the control string to the
pty. `Bun.Terminal` has no `pause`/`resume`, so the adapter keeps a `paused`
flag, buffers delivered chunks while paused, and flushes on resume. The
comparison is whole-string, exactly like node-pty's, so a control byte embedded
in a larger write still reaches the child under both backends.

The terminal flags need no adjustment. A matched-pair `stty -a` run inside the
pty — same child command, same `cols`/`rows`, same minimal env, only the backend
differing — produced identical `lflags`, `iflags`, `oflags`, and `cflags` on both
sides, including `ixon` being set on both. The earlier hypothesis that Bun's
default `IXON` was a divergence was wrong; the stall it caused in probing came
from writing a bare `'\x13'` straight to the pty, which node-pty's JS layer would
have intercepted.

### 8. One accepted divergence: `VEOL`

The same matched-pair `stty -a` differs in exactly one field. node-pty leaves
`eol = <undef>` (the field is set to `_POSIX_VDISABLE`); Bun's terminal reports
`eol = ^@`, i.e. `VEOL == NUL`, because Bun initializes the secondary end-of-line
character to 0 rather than to the disable value. `Bun.Terminal` exposes
`inputFlags`, `outputFlags`, `controlFlags`, and `localFlags` but no control
character array, so this cannot be corrected from JS.

Assessed as benign for both consumers: the shell tool writes a command string
followed by a newline and the web terminal forwards keystrokes from a browser
`xterm.js`, neither of which produces a NUL byte in input. Recorded here rather
than fixed.

### 9. `resize` keeps node-pty's validation

`UnixTerminal.prototype.resize` throws `resizing must be done using positive
cols and rows` for non-positive, `NaN`, or `Infinity` values. `WebTerminalRegistry`
calls `resize` from a route handler on client-supplied dimensions, so the throw is
part of the observable contract. The adapter performs the same check with the
same message before calling `term.resize`.

### 10. The error surface is a shim, not an event emitter

Consumers call `on('error', cb)` and `removeListener('error', cb)`; nothing else
on the `EventEmitter` surface is used. The adapter keeps a `Set` of error
listeners and reports spawn/write failures through it, and implements only those
two methods. It does not extend `EventEmitter`, because no consumer subscribes to
any other event and node-pty's `'close'`/`'data'`/`'exit'` events are internal to
its own JS layer.

### 11. Windows-only spawn options are ignored, and the branch is POSIX-gated

`useConptyDll` is inert off Windows — the option appears nowhere in the POSIX
prebuilds — so the Bun backend accepts and ignores it. The `loadPty()` branch is
gated on `process.platform !== 'win32'` so Bun on Windows keeps returning
`impl: null` with today's reason, which is the honest answer until ConPTY under
Bun has been measured.

### 12. The child must lead its own process group, so `Bun.spawn` gets `detached: true`

Found by measurement, not by reading: with the default `Bun.spawn` options the
child inherits Bun's process group, and `ShellExecutionService`'s POSIX cancel
path signals the _group_ — `process.kill(-pid, 'SIGTERM')`, then `SIGKILL` after
`SIGKILL_TIMEOUT_MS` — falling back to `ptyProcess.kill()` only when that throws.
With the group inherited, the group signal fails with `ESRCH`, the fallback runs,
and the fallback is a bare `SIGHUP` to the shell alone. A cancelled
`sleep 30 & sleep 31 & wait` was measured leaving both grandchildren alive and
reporting `{exitCode: 0, signal: 1}` where node-pty reports
`{exitCode: 0, signal: 15}`.

`detached: true` puts the child in its own group (`pgid == pid`), which is what
node-pty's POSIX spawn does, and both halves then match the reference backend.
Neither `setsid: true` nor `processGroup: 0` had any measurable effect. The option
is effectively undocumented in Bun, so it is pinned twice: a unit case asserts the
adapter passes it, and the real-runtime gate asserts the observable consequence —
`pgid == pid`, the group signal lands, and no grandchild survives it.

### 13. Where this can be tested, and where it cannot

`Bun.Terminal` is a native primitive, and the repo's unit tests run under vitest
on Node, so no unit test can drive a real Bun pty. The split is therefore:

- **Unit-testable under vitest**, by injecting a fake terminal/subprocess pair:
  the signal-to-exit-info mapping (Decision 3), the flow-control interception and
  buffering (Decision 7), the env mutations (Decision 6), the `resize`
  validation (Decision 9), the `SIGHUP` default (Decision 5), the `detached`
  spawn option (Decision 12), and listener disposal. The adapter takes its
  `Terminal` constructor and `spawn` function as parameters with the real Bun
  globals as defaults, so the fake can be supplied without a module mock.
- **Only under a real Bun**: the end-to-end behaviours — actual spawn, output
  delivery, resize visibility, exit and signal reporting, process-group teardown,
  and repeated spawns without a leak. These run as
  `scripts/check-bun-pty.mjs`, gated by a dedicated workflow
  (`.github/workflows/bun-pty.yml`) on ubuntu with Bun pinned to the release's
  `DEFAULT_BUN_VERSION`. The script imports the backend's TypeScript source
  directly and needs no install or build step. `tui-parity.yml` was rejected as
  the vehicle: its `paths` filter covers `packages/cli/**` only, so this change
  would not trigger it, and widening that filter would run both TUI jobs on every
  core PR.

The existing `getPty.test.ts` cases that pin the Bun short-circuit ("falls back
when running under Bun", "records why the Bun runtime has no backend") must be
rewritten: under Bun on POSIX the answer becomes a backend, and two distinct
reason strings survive — one for Bun on Windows, one for a Bun build with no
`Terminal` primitive. The remaining cases — that a failure reason never leaks
between concurrent `loadPty()` calls — keep their meaning and stay, with their
negative assertions widened to `/Bun/` so they exclude either Bun explanation,
not just the one that names the primitive.

## Constraints

- `packages/core/src/**` is core infrastructure under AGENTS.md's two-tier gate.
  This is a small-scope change (one new module, one branch in `loadPty()`, plus
  type-union widening), so Tier 2 applies: every downstream consumer is named
  above — `shellExecutionService.ts` (spawn site and teardown paths),
  `web-terminal-registry.ts` (spawn, resize, kill, host-release helpers), and
  `conpty-host.ts` (no-op off Windows). `packages/cli/src/agent-view/pty-host.ts`
  is a consumer that is explicitly left on its current behaviour.
- `loadPty()` must keep resolving rather than rejecting, and `getPty()` must keep
  its `PtyImplementation` return type, so `ShellExecutionService`'s graceful
  `childProcessFallback` still engages when the Bun primitive is missing.
- ESM only, no `any`, `kebab-case.ts` filenames — hence `bunPty.ts` needs a
  legacy-filename allowlist entry or a kebab-case name (`bun-pty.ts`). The
  kebab-case name is used.
- Bun version floor: `Bun.Terminal` must exist. The release pins 1.3.14, which
  has it. A runtime without it falls into the same `impl: null` path as an
  unloadable backend, with the reason naming the missing primitive.

## Risks

- **`Bun.Terminal` is a young API.** Its exit-callback semantics are already odd
  (Decision 2). A Bun bump could move `exitCode`/`signalCode` semantics. The
  mitigation is that the real-Bun CI leg asserts the exit and signal shapes
  directly, so a bump that changes them fails the lane rather than silently
  reclassifying cancelled commands.
- **Process-group teardown was the real difference, and it is now closed on
  POSIX.** `Bun.spawn` inherits the parent's group unless told otherwise, which
  broke the shell tool's group-signal cancel path (Decision 12). `detached: true`
  restores node-pty's shape and the gate pins it. The residual risk is that the
  option is barely documented, so a Bun bump could silently stop honouring it —
  which is exactly why the gate asserts the observable consequence (`pgid == pid`,
  group signal lands, no surviving grandchild) rather than the option value alone.
  Windows teardown (`taskkill` / ConPTY host release) is untouched and unmeasured.
- **`VEOL` divergence** (Decision 8) is unfixable from JS and is accepted.
- **Coverage asymmetry**: darwin is measured locally, Linux only through CI,
  Windows not at all. This is stated in the acceptance criteria rather than
  papered over.

## Validation plan

Steps 1–6 were measured locally on darwin; 7–8 are the gates that run elsewhere.

1. Local end-to-end leg (`scripts/check-bun-pty.mjs`, 14 checks: initial geometry
   via `stty size`, write-through, resize visibility, resize validation, natural
   exit code, `SIGTERM`/`SIGKILL`/`SIGHUP` shapes, the bare `kill()` default, live
   pid, two concurrent ptys with no cross-talk, 20 sequential spawns,
   process-group cancel, no stray children): **14/14 PASS under Bun 1.3.14 and
   under Bun 1.4.0, ten consecutive runs on each with zero failures.** Six
   mutations confirm the gate is not vacuously green, each reverted before the
   next and each re-run against the final script on a clean process table:
   `detached: false` fails `process-group-cancel` (`pgid 67909` vs `pid 67957`,
   group `SIGTERM` returns `ESRCH`, both grandchildren survive) and, because those
   grandchildren outlive the run, `no-stray-children` with it; deleting
   `toExitInfo`'s signal branch fails `sigterm`/`sigkill`/`sighup`/
   `bare-kill-sighup` together, at exit codes 143/137/129/129; flipping the
   `kill()` default to `SIGTERM` fails `bare-kill-sighup` alone, at signal 15;
   forcing the initial `cols` to 100 fails `geometry-and-output` alone, at
   `24 100`; dropping the `terminal.resize()` call fails `resize-visible` — 20
   re-asks all reading `24 80` — while `resize-validation` stays green; and
   removing the validation fails `resize-validation` alone, which then reports
   Bun's own message (`resize() requires valid cols argument`) instead of
   node-pty's. After the script's last edit — a comment correction, no behaviour
   change — both legs were run once more against it: 14/14 under Bun 1.3.14 and
   14/14 under Bun 1.4.0.
2. Matched pair, one variable per comparison (the backend): the same checks
   against `@lydell/node-pty` on Node 24.19.0 — **14/14 on all three arms** (Bun
   1.3.14, Bun 1.4.0, Node), and the Bun and Node logs are line-identical once
   pids and the runtime label are normalised; the only line that still differs is
   the `SUMMARY`, which names the backend. The control arm is what turns Decision
   12 into a measurement rather than a reading of node-pty's source: under
   node-pty the same probe reports `pgid == pid`, a group `SIGTERM` that lands,
   and zero surviving grandchildren. `stty -a` tokenises to 113 tokens
   under both backends and differs in exactly one: `eol` reads `^@` under Bun and
   `<undef>` under node-pty (Decision 8). The child's `TERM` is the `name` option
   under both even when the environment passed in sets `TERM` to something else,
   and `PWD` is the `cwd` under both. Drain ordering was measured with a
   5000-line burst: every line is delivered before `proc.exited` resolves, which
   is what Decision 4 relies on; the terminal's own exit callback fires later and
   reports code 0 with no signal, confirming Decision 2.
3. Production path, both arms: `ShellExecutionService.execute` driving a real tty.
   Under Bun 1.3.14 and Bun 1.4.0 it reports
   `executionMethod: "bun-terminal"`, a real `/dev/ttys00N`, the configured
   `30 100` geometry honoured by the child, and a cancel returning
   `aborted: true` with `{exitCode: 0, signal: 15}`; the Node control arm reports
   the same values with `executionMethod: "lydell-node-pty"`. Neither leaves a
   stray `sleep`. This is the leg that found Decision 12 — before `detached`, the
   same cancel returned `{exitCode: 0, signal: 1}` under Bun while the Node arm
   returned `signal: 15`.
4. Process-tree probe, both arms: `sh -c 'sleep 30 & sleep 31 & wait'` inside a
   pty, then the shell tool's own cancel sequence. Both report `pgid == pid`,
   `leadsOwnGroup=true`, a group `SIGTERM` that lands, zero surviving
   grandchildren, and `{exitCode: 0, signal: 15}`.
5. `cd packages/core && npx vitest run src/utils/getPty.test.ts
src/utils/bun-pty.test.ts src/services/shellExecutionService.test.ts
src/services/web-terminal-registry.test.ts` under Node: **245 tests pass**
   across the four files (20 adapter, 6 loader, 175 shell service, 44 web
   terminal). Mutations of the adapter — the `kill()` default, the `TERM`
   precedence, the flow-control buffering block, `toExitInfo`'s signal branch and
   the `detached` option — each fail at least one case, so the suite is not
   vacuously green.
6. `npm run build && npm run typecheck` exit 0; scoped ESLint on every changed
   file reports no findings; `actionlint` 1.7.12 (the version `scripts/lint.js`
   pins) reports none on the new workflow. `npm run bundle` was inspected the
   same way: the adapter is emitted as its own chunk reached only through the
   dynamic import in the Bun branch, and it reads `globalThis.Bun`, so no Node
   path evaluates Bun-specific code. The literal string `Bun.Terminal` does
   appear in the bundle — in the loader's `typeof` guard and in the adapter's
   own missing-primitive error — which is why the criterion below is about
   evaluation, not about the string being absent.
7. CI: the ubuntu Bun 1.3.14 leg runs the end-to-end script; the ordinary Node
   lanes must stay green unchanged.
8. Manual: a Bun-built CLI bundle running a shell-tool command that needs a TTY
   (`tty`, a pager, an interactive prompt), and a web terminal session.

The gate needed hardening before it could be trusted as evidence, and the reason
is worth recording because it initially looked like a backend defect. Two checks
wrote to the pty immediately after spawn, and a write that lands before the shell
installs its line discipline is echoed and then dropped, so the command never
runs. Measured under both backends with the identical probe: node-pty lost 6 of 6
such writes and Bun lost 5 of 6, so this is a shell-startup race, not a
difference between them. The gate now waits for the prompt before the first
write, parses values the child prints behind a tag (`echo "GEOMETRY=$(stty
size)"`) so neither the prompt nor the echoed command can glue to them, and
re-asks after a resize instead of sleeping once, since `SIGWINCH` is
asynchronous, and counts only the `sleep 30`/`sleep 31` processes it spawns
rather than every `sleep` on the machine — an unrelated one was observed running
on the development host during a gate run. A positive control (a `sleep 30`
started outside the gate) makes `no-stray-children` report `sleepProcs=1` and
fail, so the narrowed pattern still sees a real leak.

## Acceptance criteria

- Under Bun on darwin and on ubuntu, `loadPty()` returns the `bun-terminal`
  backend and the shell tool takes its PTY path rather than
  `childProcessFallback`.
- A cancelled command under Bun is classified as a signal termination, with the
  same `{exitCode: 0, signal: n}` shape node-pty produces, not as a natural exit
  143/137.
- A cancelled command's whole process group dies with it: the child leads its own
  group (`pgid == pid`), the shell tool's group `SIGTERM` lands rather than
  throwing `ESRCH` into the `SIGHUP` fallback, and no grandchild survives.
- A bare `kill()` under Bun sends `SIGHUP`, matching node-pty.
- The child's `TERM` equals the `name` option under both backends, and the
  child's `stty -a` differs only in the documented `VEOL` field.
- Under Bun on Windows, `loadPty()` still returns `impl: null` with the existing
  reason, and no consumer's behaviour changes.
- Under Node, every existing test passes unchanged, and the Bun-only adapter
  stays in a chunk no Node path evaluates.
- Every dimension not verified is named in the PR description: Windows ConPTY and
  Windows teardown, and the agent-view PTY host.

## Open questions

- Should the agent-view PTY host adopt the same backend in this change or in a
  follow-up? Current answer: follow-up, because it has its own loader and its own
  injected-backend contract.

Resolved during implementation:

- A Bun-built standalone does get its own reason string ("this Bun runtime has no
  `Bun.Terminal` primitive"), separate from the Windows one ("the PTY backend is
  disabled under the Bun runtime"), because the two call for different user
  action: bump Bun versus run the Node build.
- The real-Bun leg lives in a dedicated workflow rather than in `tui-parity.yml`
  or `ci.yml` — see Decision 13 for why the existing vehicles do not fit.
