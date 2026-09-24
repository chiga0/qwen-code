# Bun 运行时下的 PTY 后端

[English](2026-09-24-bun-pty-backend.md) | [简体中文](2026-09-24-bun-pty-backend.zh-CN.md)

状态：已实现。下文所有标注为"实测"的结论均在 darwin/arm64 上测得；Linux 腿在 CI
中运行。

## 问题陈述

独立发布产物可以按 Bun 运行时构建，而 Bun 正是该产物的目标默认运行时。但今天
所有 PTY 消费方在 Bun 下都是死代码，因为 `loadPty()` 在
`'bun' in process.versions` 上直接短路，返回 `impl: null`，理由是 "the PTY
backend is disabled under the Bun runtime; use the Node runtime"
（`packages/core/src/utils/getPty.ts`）。

这一处短路有三个用户可见后果：

- shell 工具失去 PTY 路径，退回 `child_process`，于是命令在没有控制终端的环境
  下运行——没有 TTY 探测、没有行编辑、没有 pager、没有 `SIGWINCH`，
  `ShellExecutionService` 赖以为继的无头终端 scrollback 模型也完全不参与；
- web 终端根本无法启动 shell：`WebTerminalRegistry` 没有 `child_process`
  兜底，`loadPty()` 报告无后端时直接返回
  `{ error: 'Failed to spawn shell' }`；
- agent-view 的 PTY host 自己加载同样的两个后端，同样不可用。

因此要让 Bun 成为独立发布的默认运行时，必须先让 PTY 在 Bun 下可用。本文档界定
这个后端的范围。

## 为什么不能直接加载现有后端

`@lydell/node-pty` 在 Bun 下能解析——预编译的原生模块能加载——但第一次 spawn
既不产出输出也不退出。在 darwin/arm64 上，用发布所钉住的 Bun 版本（1.3.14）
和 Bun 1.4.0 实测：
`spawn('/bin/sh', ['-c', 'echo NODEPTY_OK; tty; exit 0'])` 在 6 秒内没有任何
数据、也没有退出事件；而同一个调用在 Node 24.19.0 下立刻以
`{exitCode: 0, signal: 0}` 完成。所以 `getPty.ts` 里现有的注释（"Bun can load
@lydell/node-pty, but it hangs under Desktop's runtime"）是准确的，而退到
`node-pty` 也没有意义：那是同一条原生代码路径。

Bun 自己提供了伪终端原语：`Bun.Terminal` 创建 pty，`Bun.spawn({ terminal })`
把子进程挂上去。该原语在所钉住的 Bun 版本上可用，也是 Bun 唯一提供的 PTY 机制。

## 目标

1. 在 POSIX 上的 Bun 下，`loadPty()` 返回一个后端，其 `spawn()` 产出的进程对象
   能被现有消费方原样驱动。
2. 在这些消费方真正触及的接口面上与 `@lydell/node-pty` 行为对等，并把每一处
   有意为之的分歧写下来。
3. 不改动 Node 路径。在 Node 下，现有两个后端保持当前的顺序、语义与错误上报。

## 非目标

- **Windows。** Bun 下的 ConPTY 未经实测，而 `conpty-host.ts` 与
  `web-terminal-registry.ts` 里的 Windows 专属宿主生命周期处理是针对 node-pty
  内部结构写的（`_agent._pty`、`_ptyNative.kill`、`_conoutSocketWorker`、
  `_isReady`），Bun 后端没有这些字段。Windows 上的 Bun 保持今天的禁用行为与
  现有理由串。
- **agent-view 的 PTY host。** `packages/cli/src/agent-view/pty-host.ts` 有自己的
  加载器和自己的后端名联合类型。它是另一个消费方、另一套兜底契约，并进来只会
  扩大本次改动而不增加任何证据。作为后续工作跟踪。
- **任何对 shell 工具自身逻辑的修改。** 消费方不改。

## 现状：后端必须满足的确切契约

两个调用点都走 `ptyImpl.module.spawn(file, args, options)`，然后直接使用返回
对象。

`ShellExecutionService`（`packages/core/src/services/shellExecutionService.ts`）
以 `cwd`、`name`、`cols`、`rows`、`env`、`handleFlowControl: true`、
`useConptyDll` 来 spawn，随后使用：

| 成员                                              | 用途                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `pid`                                             | `activePtys` 的键、`isPtyActive`、`windowsKillPid`、结果上报 |
| `write(data)`                                     | 命令本身，以及终端查询的应答                                 |
| `onData(cb)`                                      | 返回 disposable；喂给无头 `Terminal`                         |
| `onExit(cb)`                                      | 返回 disposable；驱动结算与后台提升                          |
| `on('error', cb)` / `removeListener('error', cb)` | PTY 错误处理器的挂载/摘除                                    |
| `kill(signal?)`                                   | 取消路径与进程退出时的清理                                   |

`WebTerminalRegistry`（`packages/core/src/services/web-terminal-registry.ts`）
以 `name`、`cols`、`rows`、`cwd`、`env`、`useConptyDll` 来 spawn，随后使用
`pid`、`write`、`resize(cols, rows)`、`kill()`、`onData`、`onExit`。它还会读
`(spawned as { _isReady?: boolean })._isReady`，并把对象传给
`noteConPtyHostReleased` / `releaseConPtyHost` / `disposeConoutWorker`；这三者在
非 Windows 上立即返回，而 `releaseConPtyHost` 在缺少 `_agent` 时退化为一条警告，
所以 Bun 对象在那里是安全的。`_isReady` 读到的是 `undefined !== false`，即与
POSIX 上 node-pty 对象走的同一分支。

没有任何地方写 `'\x13'` 或 `'\x11'`——`handleFlowControl` 被传入，但没有调用点
发出 node-pty 的 JS 层会拦截的控制串。该选项仍然被遵守（决定 7），因为 spawn
点显式请求了它。

## 方案

新增 `packages/core/src/utils/bun-pty.ts`，导出单一的
`spawn(file, args, options)`：构造 `Bun.Terminal`，把它挂到 `Bun.spawn` 的子进程
上，返回一个在上表成员上与 node-pty `UnixTerminal` 同形的对象。`loadPty()` 在两个
import 之前增加一个分支：

```ts
if ('bun' in process.versions) {
  if (process.platform === 'win32') {
    return { impl: null, loadError: <今天的理由串，不变> };
  }
  if (typeof globalThis.Bun?.Terminal !== 'function') {
    return { impl: null, loadError: <点名缺失原语的理由串> };
  }
  const { spawn } = await import('./bun-pty.js');
  return { impl: { module: { spawn }, name: 'bun-terminal' }, loadError: null };
}
```

`PtyImplementation['name']` 加宽为 `'lydell-node-pty' | 'node-pty' |
'bun-terminal'`，`shellExecutionService.ts` 里的平行联合同步加宽。动态 import 并
不会让适配层从 Node 产物里消失，而是把它单独切成一块：`npm run bundle` 会产出一个独
立的 `dist/chunks/bun-pty-*.js`，在整个 `dist/` 里唯一的引用者就是上面 Bun 分支中
的那句 `await import()`，而适配层读的是 `globalThis.Bun` 而不是裸的 `Bun` 标识符。
所以在 Node 下该模块从不被求值，即便被求值也不可能抛 `ReferenceError`。

`loadPty()` 保持其契约：从不 reject，import 阶段抛错的后端同样坍缩为
`impl: null`，并把理由放在返回值上。

## 设计决定

### 1. 用 `Bun.Terminal` + `Bun.spawn({ terminal })`，而不是自己实现

子进程的 stdio 挂在终端上（`Bun.spawn` 选项里
`stdin/stdout/stderr: 'ignore'`，这样 Bun 不会再开一条管道），pty master 只通过
`Bun.Terminal` 对象驱动。在 Bun 1.3.14 与 1.4.0 上实测：`cwd`、`cols`、`rows`、
`env` 全部生效（`pwd`、`stty size` 与一个标记变量都能正确读回），写入能到达子
进程，`resize` 在命令执行中对子进程可见，两个并发 pty 互不干扰，连续 20 次
spawn 全部完成且不卡死。

### 2. 退出信息取自子进程，而不是终端回调

`Bun.Terminal` 的 `exit(terminal, code, signal)` 回调不可用：它在
`proc.exited` resolve **之后**才触发——实测晚于 500 毫秒，而且要等事件循环没有其他
待处理事项时才来——并且无论子进程如何结束，一律报告 `code=0, signal=null`。

`proc.exited` resolve 的那一刻才是权威时点。此时 `proc.exitCode` 是退出码，或在
子进程被信号杀死时为 `null`；`proc.signalCode` 是信号名（`'SIGTERM'`、
`'SIGKILL'`、`'SIGHUP'`）或 `null`。`proc.killed` 即使自然退出也是 `true`，因此
不参考。

### 3. 信号致死映射为 node-pty 的 `{exitCode: 0, signal: n}` 形状

node-pty 把自然退出报告为 `{exitCode: 7, signal: 0}`，`SIGTERM` 报告为
`{exitCode: 0, signal: 15}`，`SIGKILL` 报告为 `{exitCode: 0, signal: 9}`
（对照臂实测，Node 24.19.0）。`ShellExecutionService.isSignalTermination` 判断
`signal !== null && signal !== 0`，其文档化的 PTY 契约也期望信号致死携带
`exitCode: 0` 加非零 signal。

Bun 的原始字段会破坏这一点：被取消的命令死于 `SIGTERM` 时 `exitCode` 为
`null`，而 `proc.exited` 自身 resolve 出 shell 风格的 143。若原样透传，被取消的
命令会被判定为自然退出 143，而不是信号终止。因此适配层把 `signalCode` 转成信号
编号并报告 `{exitCode: 0, signal: n}`，其余情况报告
`{exitCode: proc.exitCode, signal: 0}`。

### 4. `onExit` 在 `proc.exited` resolve 时触发，不额外等待排空

node-pty 把 `exit` 事件推迟到读端 socket 关闭之后，并且仍然注明之后可能还有数据
到达。Bun 不需要这种推迟：子进程一次性输出 5000 行时，`proc.exited` resolve 的
那一瞬间所有行都已经送达 `data` 回调（在 Bun 1.3.14 与 1.4.0 上都是
`seen=5000`）。适配层因此在该 resolve 中同步触发 `onExit`，然后关闭终端。为了一个
实测并不存在的竞态而多加一拍，只会推迟每条命令的结算。

终端在退出监听器跑完之后才关闭，因此晚到的 `data` 回调不会比消费方持有的对象活
得更久。

### 5. `kill()` 默认 `SIGHUP`，而不是 Bun 的 `SIGTERM`

`UnixTerminal.prototype.kill` 是被吞掉异常的 `try` 里的
`process.kill(this.pid, signal || 'SIGHUP')`。调用方依赖这个默认值：清理路径直接
裸调 `ptyProcess.kill()`。而 Bun 的 `proc.kill()` 不带参数时发的是 `SIGTERM`。
适配层把 `signal ?? 'SIGHUP'` 透传给 `proc.kill`，使裸 `kill()` 在两个后端下含义
一致，并同样吞掉抛出。

### 6. 环境准备只复刻 node-pty 的两处改写，不多做

`UnixTerminal` 在 fork 之前，会在自己的 env 副本上设置 `env.PWD = cwd` 与
`env.TERM = opt.name || env.TERM || 'xterm'`。两者都复刻：shell 工具传
`name: launch?.env['TERM'] ?? 'xterm'`，web 终端传 `name: 'xterm-256color'`，所以
子进程的 `TERM` 来自 `name`，而不是 `env.TERM`。

node-pty 的 `_sanitizeEnv`（删除 `TMUX`、`TMUX_PANE`、`STY`、`WINDOW`、
`WINDOWID`、`TERMCAP`、`COLUMNS`、`LINES`）只在 `opt.env === process.env` 同一性
成立时运行。两个调用点都不是这样——都传入新展开的对象——所以复刻它等于增加不可达
代码。有意不复刻。

### 7. `handleFlowControl` 在 JS 层模拟，termios 一律不动

node-pty 的流控完全在其 JS 层：`Terminal.prototype.write` 把整个字符串与
`'\x13'` / `'\x11'` 比较，命中则对读端 socket 调 `pause()` / `resume()`，并且
**不**把控制串转发给 pty。`Bun.Terminal` 没有 `pause`/`resume`，所以适配层自己维护
`paused` 标志，暂停期间缓冲已送达的数据块，恢复时冲刷。比较同样是整串比较，与
node-pty 一致，因此夹在更长写入里的控制字节在两个后端下都仍会到达子进程。

终端标志无需调整。一次成对的 `stty -a` 实测——同样的子命令、同样的
`cols`/`rows`、同样的最小 env，唯一变量是后端——两侧的 `lflags`、`iflags`、
`oflags`、`cflags` 完全一致，包括两边都置了 `ixon`。此前认为 Bun 默认 `IXON` 是
一处分歧的假设是错的；探测中它导致的停滞来自把裸 `'\x13'` 直接写进 pty，而
node-pty 的 JS 层本会把它拦下。

### 8. 一处已接受的分歧：`VEOL`

同一次成对 `stty -a` 只有一个字段不同。node-pty 留下 `eol = <undef>`（该字段被设
为 `_POSIX_VDISABLE`）；Bun 的终端报告 `eol = ^@`，即 `VEOL == NUL`，因为 Bun 把
备用行结束符初始化为 0 而不是禁用值。`Bun.Terminal` 暴露 `inputFlags`、
`outputFlags`、`controlFlags`、`localFlags`，但不暴露控制字符数组，所以从 JS 无法
纠正。

对两个消费方评估为良性：shell 工具写入的是命令串加换行，web 终端转发的是浏览器
`xterm.js` 的按键，两者的输入里都不会出现 NUL 字节。记录在此，不做修复。

### 9. `resize` 保留 node-pty 的校验

`UnixTerminal.prototype.resize` 对非正数、`NaN`、`Infinity` 抛出
`resizing must be done using positive cols and rows`。`WebTerminalRegistry` 是在
路由处理器里用客户端提供的尺寸调 `resize` 的，所以这个抛出属于可观测契约的一部
分。适配层在调用 `term.resize` 之前做同样的检查、抛同样的消息。

### 10. 错误面是一个薄壳，不是事件发射器

消费方只调 `on('error', cb)` 与 `removeListener('error', cb)`，`EventEmitter`
接口面上的其他成员都没用到。适配层维护一个错误监听器 `Set`，通过它上报
spawn/写入失败，并且只实现这两个方法。它不继承 `EventEmitter`，因为没有消费方订阅
其他事件，而 node-pty 的 `'close'`/`'data'`/`'exit'` 事件是它自己 JS 层的内部机
制。

### 11. Windows 专属的 spawn 选项被忽略，且分支按 POSIX 收口

`useConptyDll` 在非 Windows 上是惰性的——该选项在 POSIX 预编译包里根本不存在——
所以 Bun 后端接受并忽略它。`loadPty()` 的分支以
`process.platform !== 'win32'` 收口，使 Windows 上的 Bun 继续返回 `impl: null`
与今天的理由；在 Bun 下的 ConPTY 被实测之前，那才是诚实的回答。

### 12. 子进程必须自领一个进程组，所以 `Bun.spawn` 要带 `detached: true`

这是实测出来的，不是读代码读出来的：`Bun.spawn` 用默认选项时子进程继承 Bun 的进
程组，而 `ShellExecutionService` 在 POSIX 上的取消路径是向**进程组**发信号的——
`process.kill(-pid, 'SIGTERM')`，等 `SIGKILL_TIMEOUT_MS` 之后再补 `SIGKILL`，只有
在这一步抛错时才退回 `ptyProcess.kill()`。组被继承时，组信号以 `ESRCH` 失败，于是
兜底生效，而兜底是只发给 shell 自己的一个裸 `SIGHUP`。实测一次被取消的
`sleep 30 & sleep 31 & wait`：两个孙进程都活着，上报 `{exitCode: 0, signal: 1}`，
而 node-pty 上报的是 `{exitCode: 0, signal: 15}`。

`detached: true` 让子进程进入自己的组（`pgid == pid`），这正是 node-pty 的 POSIX
spawn 所做的事，于是两半都与参照后端对齐。`setsid: true` 与 `processGroup: 0` 都
没有任何可观测效果。该选项在 Bun 里基本没有文档，所以钉两次：一条单元测试断言适配
层确实传了它，真实运行时门禁断言其可观测后果——`pgid == pid`、组信号确实落地、没有
孙进程活下来。

### 13. 哪些能测、哪些不能测

`Bun.Terminal` 是原生原语，而本仓的单元测试跑在 Node 上的 vitest 里，所以没有任
何单元测试能驱动真实的 Bun pty。因此拆成两块：

- **可以在 vitest 下测**，办法是注入一对假的 terminal/subprocess：信号到退出信息
  的映射（决定 3）、流控拦截与缓冲（决定 7）、env 改写（决定 6）、`resize` 校验
  （决定 9）、`SIGHUP` 默认值（决定 5）、`detached` spawn 选项（决定 12）、监听器
  释放。适配层把 `Terminal` 构造器与 `spawn` 函数作为参数接收，默认值取真实的 Bun
  全局，因此无需模块 mock 就能提供假实现。
- **只能在真实 Bun 下测**：端到端行为——真实 spawn、输出送达、resize 可见性、退出
  与信号上报、进程组清理、重复 spawn 不泄漏。这些以 `scripts/check-bun-pty.mjs`
  运行，并由一条独立 workflow（`.github/workflows/bun-pty.yml`）在 ubuntu 上把 Bun
  钉到发布的 `DEFAULT_BUN_VERSION`。该脚本直接 import 后端的 TypeScript 源码，不需
  要安装也不需要构建。`tui-parity.yml` 被否决为载具：它的 `paths` 过滤只覆盖
  `packages/cli/**`，本次改动根本不会触发它，而放宽该过滤会让每个 core PR 都跑那两
  个 TUI job。

`getPty.test.ts` 里现有钉住 Bun 短路的用例（"falls back when running under
Bun"、"records why the Bun runtime has no backend"）必须重写：在 POSIX 的 Bun 下
答案变成"有后端"，并且存活下来的是两条不同的理由串——一条给 Windows 的 Bun，一条给
没有 `Terminal` 原语的 Bun 构建。其余用例——失败理由不会在并发的 `loadPty()` 调用之
间串味——含义不变，保留，只是它们的反向断言放宽为 `/Bun/`，从而把两条 Bun 理由都
排除在外，而不只是那条点名原语的。

## 约束

- `packages/core/src/**` 属于 AGENTS.md 两层门禁下的核心基础设施。本次是小范围改
  动（一个新模块、`loadPty()` 里一个分支，加上类型联合加宽），因此适用第二层：上面
  已点名全部下游消费方——`shellExecutionService.ts`（spawn 点与清理路径）、
  `web-terminal-registry.ts`（spawn、resize、kill、宿主释放辅助函数）、
  `conpty-host.ts`（非 Windows 上空操作）。
  `packages/cli/src/agent-view/pty-host.ts` 是明确保持现状的消费方。
- `loadPty()` 必须继续 resolve 而非 reject，`getPty()` 必须保持
  `PtyImplementation` 返回类型，这样在 Bun 原语缺失时
  `ShellExecutionService` 优雅的 `childProcessFallback` 仍会生效。
- 只用 ESM、不用 `any`、`.ts` 文件名用 kebab-case——因此新模块命名为
  `bun-pty.ts`，而不是沿用 `getPty.ts` 那种进了历史允许清单的 camelCase。
- Bun 版本下限：必须存在 `Bun.Terminal`。发布钉住 1.3.14，已具备。若运行时没有它，
  则与"后端不可加载"走同一条 `impl: null` 路径，理由串点名缺失的原语。

## 风险

- **`Bun.Terminal` 是年轻 API。** 它的退出回调语义本身就已经很怪（决定 2）。Bun 升
  级可能改动 `exitCode`/`signalCode` 的语义。缓解手段是真实 Bun 的 CI 腿直接断言退
  出与信号形状，所以一次改动语义的升级会让该 lane 失败，而不是悄悄把被取消的命令重
  新分类。
- **进程组清理才是真正的分歧，现在已在 POSIX 上闭合。** `Bun.spawn` 除非另行声明，
  否则继承父进程的组，这打断了 shell 工具的组信号取消路径（决定 12）。
  `detached: true` 恢复了 node-pty 的形状，门禁把它钉住。残余风险在于该选项几乎没有
  文档，所以一次 Bun 升级可能悄悄不再遵守它——这正是门禁断言可观测后果
  （`pgid == pid`、组信号落地、没有存活的孙进程）而不只是断言选项值的原因。Windows
  侧的清理（`taskkill` / ConPTY 宿主释放）未改动，也未实测。
- **`VEOL` 分歧**（决定 8）无法从 JS 修复，予以接受。
- **覆盖不对称**：darwin 在本地实测，Linux 只经 CI，Windows 完全没有。这一点写在
  验收标准里，而不是掩盖掉。

## 验证计划

第 1—6 步在 darwin 上本地实测；第 7—8 步是只能在别处跑的门禁。

1. 本地端到端腿（`scripts/check-bun-pty.mjs`，14 项检查：用 `stty size` 验初始几
   何、写入透传、resize 可见性、resize 校验、自然退出码、
   `SIGTERM`/`SIGKILL`/`SIGHUP` 形状、裸调 `kill()` 的默认值、pid 存活、两个并发
   pty 无串扰、连续 20 次 spawn、进程组取消、无残留子进程）：**在 Bun 1.3.14 与
   Bun 1.4.0 下均 14/14 PASS，两个版本各连续跑十次、零失败。**六处变异证明该门禁
   不是空转的绿，每处变异都在下一次之前还原，并且都是针对最终版脚本、在干净的进程表
   上重跑的：`detached: false` 让 `process-group-cancel` 失败（`pgid 67909` 对
   `pid 67957`，组 `SIGTERM` 返回 `ESRCH`，两个孙进程都存活），并且因为这两个孙进程
   活得比本次运行更久，`no-stray-children` 随之一起失败；删掉 `toExitInfo` 的信号分
   支让 `sigterm`/`sigkill`/`sighup`/`bare-kill-sighup` 一起失败，退出码分别为
   143/137/129/129；把 `kill()` 默认值改成 `SIGTERM` 只让 `bare-kill-sighup` 以
   signal 15 失败；把初始 `cols` 强制成 100 只让 `geometry-and-output` 以 `24 100`
   失败；去掉 `terminal.resize()` 调用让 `resize-visible` 失败——重问 20 次全部读
   到 `24 80`——而 `resize-validation` 保持绿；去掉校验则只让 `resize-validation`
   失败，此时报的是 Bun 自己的消息（`resize() requires valid cols argument`）而
   不是 node-pty 的。脚本最后一次改动只是修正注释、不改行为，改完后两条腿又各跑了
   一次：Bun 1.3.14 下 14/14，Bun 1.4.0 下 14/14。
2. 成对比较，每次比较只变一个变量（后端）：同样这些检查在 Node 24.19.0 下用
   `@lydell/node-pty` 再跑一遍——**三条臂（Bun 1.3.14、Bun 1.4.0、Node）均
   14/14**，且把 pid 与运行时标签归一化之后 Bun 与 Node 的日志逐行相同；唯一仍然不
   同的是点名后端的 `SUMMARY` 那一行。正是这条对照臂把决定 12 从"读 node-pty 源码
   得出的推论"变成了实测：在 node-pty 下同一个探针报告 `pgid == pid`、组 `SIGTERM`
   落地、零存活孙进程。`stty -a`
   在两个后端下都切出 113 个 token，且只有一个不同：`eol` 在 Bun 下读作 `^@`，在
   node-pty 下读作 `<undef>`（决定 8）。即使传入的环境把 `TERM` 设成别的值，两个后
   端下子进程的 `TERM` 都取自 `name` 选项，`PWD` 都取自 `cwd`。排空顺序用 5000 行
   突发实测：每一行都在 `proc.exited` resolve 之前送达，这正是决定 4 所依赖的；
   terminal 自己的退出回调更晚触发，且报 code 0、无信号，印证决定 2。
3. 生产路径，两条臂：`ShellExecutionService.execute` 驱动一个真实 tty。在 Bun
   1.3.14 与 1.4.0 下它上报 `executionMethod: "bun-terminal"`、一个真实的
   `/dev/ttys00N`、配置的 `30 100` 几何被子进程遵守，取消返回 `aborted: true` 且
   为 `{exitCode: 0, signal: 15}`；Node 对照臂以
   `executionMethod: "lydell-node-pty"` 上报同样的取值。两侧都不残留 `sleep`。
   决定 12 正是这条腿找出来的——加 `detached` 之前，同一次取消在 Bun 下返回
   `{exitCode: 0, signal: 1}`，而 Node 臂返回 `signal: 15`。
4. 进程树探针，两条臂：pty 里跑 `sh -c 'sleep 30 & sleep 31 & wait'`，然后执行
   shell 工具自己的取消序列。两侧都报告 `pgid == pid`、`leadsOwnGroup=true`、组
   `SIGTERM` 落地、零存活孙进程、`{exitCode: 0, signal: 15}`。
5. 在 Node 下执行 `cd packages/core && npx vitest run src/utils/getPty.test.ts
src/utils/bun-pty.test.ts src/services/shellExecutionService.test.ts
src/services/web-terminal-registry.test.ts`：四个文件 **245 条测试全通过**
   （适配层 20、加载器 6、shell 服务 175、web 终端 44）。对适配层的变异——`kill()`
   默认值、`TERM` 优先级、流控缓冲块、`toExitInfo` 的信号分支、`detached` 选项——
   每一处都至少让一条用例失败，所以这套绿测不是空转。
6. `npm run build && npm run typecheck` 退出 0；对每个改动文件的 scoped ESLint 零
   finding；`actionlint` 1.7.12（`scripts/lint.js` 钉住的版本）对新 workflow 零
   finding。`npm run bundle` 的产物也照同样方式核过：适配层被切成独立的一块，只能
   经 Bun 分支里的动态 import 到达，且读的是 `globalThis.Bun`，所以没有任何 Node 路
   径会求值 Bun 专属代码。字面串 `Bun.Terminal` 确实出现在产物里——在加载器的
   `typeof` 守卫和适配层自己的"原语缺失"错误里——所以下面的验收标准写的是"是否被求
   值"，而不是"该字面串是否缺席"。
7. CI：ubuntu 的 Bun 1.3.14 腿跑端到端脚本；常规 Node lane 必须原样保持绿。
8. 手工：用 Bun 构建的 CLI bundle 跑一条需要 TTY 的 shell 工具命令（`tty`、一个
   pager、一个交互式提示），以及一次 web 终端会话。

这套门禁在能被当作证据之前先需要加固，而加固的原因值得记录下来，因为它最初看起来
像是后端的缺陷。有两项检查在 spawn 之后立刻写 pty，而落在 shell 装好行规程之前的
写入会被 tty 回显然后丢掉，于是命令根本没执行。用同一个探针在两个后端下实测：
node-pty 丢了 6 次里的 6 次，Bun 丢了 6 次里的 5 次，所以这是 shell 启动竞态，而
不是两者之间的差异。门禁现在会在第一次写入前等待提示符，解析子进程打印在标签后面
的取值（`echo "GEOMETRY=$(stty size)"`）以免提示符或被回显的命令行粘上去，并且在
resize 之后重新询问而不是只睡一次，因为 `SIGWINCH` 是异步的；并且只统计它自己 spawn
的 `sleep 30`/`sleep 31`，而不是机器上所有的 `sleep`——门禁运行期间就在开发机上观测到
了一个无关的 `sleep`。一次正对照（在门禁之外启动一个 `sleep 30`）会让
`no-stray-children` 报出 `sleepProcs=1` 并失败，所以收窄后的匹配模式仍然看得见真正的
泄漏。

## 验收标准

- 在 darwin 与 ubuntu 的 Bun 下，`loadPty()` 返回 `bun-terminal` 后端，shell 工具
  走 PTY 路径而不是 `childProcessFallback`。
- 在 Bun 下被取消的命令被判定为信号终止，形状与 node-pty 一致
  （`{exitCode: 0, signal: n}`），而不是自然退出 143/137。
- 被取消的命令连同其整个进程组一起死掉：子进程自领一个组（`pgid == pid`），shell
  工具的组 `SIGTERM` 确实落地而不是以 `ESRCH` 掉进 `SIGHUP` 兜底，且没有孙进程存活。
- 在 Bun 下裸调 `kill()` 发的是 `SIGHUP`，与 node-pty 一致。
- 两个后端下子进程的 `TERM` 都等于 `name` 选项，且子进程的 `stty -a` 只在已记录的
  `VEOL` 字段上不同。
- 在 Windows 的 Bun 下，`loadPty()` 仍返回 `impl: null` 与现有理由，任何消费方的行
  为都不变。
- 在 Node 下，所有既有测试原样通过，且 Bun 专属的适配层待在一个没有任何 Node 路径会
  求值的 chunk 里。
- PR 描述中点名所有未验证的维度：Windows ConPTY 与 Windows 侧清理，以及 agent-view
  的 PTY host。

## 待解问题

- agent-view 的 PTY host 应该在本次改动里采用同一个后端，还是留到后续？当前答案：
  后续，因为它有自己的加载器和自己的注入式后端契约。

实施过程中已解：

- Bun 构建的独立产物拿到自己的理由串（"this Bun runtime has no `Bun.Terminal`
  primitive"），区别于 Windows 那条（"the PTY backend is disabled under the Bun
  runtime"），因为两者要求的用户动作不同：升级 Bun，还是改跑 Node 构建。
- 真实 Bun 腿放在一条独立 workflow 里，而不是 `tui-parity.yml` 或 `ci.yml`——理由见
  决定 13。
