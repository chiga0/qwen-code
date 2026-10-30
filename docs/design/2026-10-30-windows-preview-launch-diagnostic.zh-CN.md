# Windows preview 启动器 fixture 环境

[English](2026-10-30-windows-preview-launch-diagnostic.md) | [简体中文](2026-10-30-windows-preview-launch-diagnostic.zh-CN.md)

## 问题与已观测基线

[原 Windows ECS 场景](https://github.com/QwenLM/qwen-code/actions/runs/41002095690/job/123897020864) 先拒绝故意截断的归档，再通过旧安装树保持不变的比较。随后启动保留的 `qwen.cmd` 时，stdout 为空而非 `OLD_PREVIEW`。这不能证明安装器删了文件。

[hosted Windows 安装前诊断](https://github.com/chiga0/qwen-code/actions/runs/41030003395/job/123977212631) 在 `515b8d67` 上、尚未调用任何安装器时复现了 stdout 为空。PowerShell 包装进程 status 为 0、signal 为 null、error 为 null。fixture 未传 `PATHEXT`，父进程包含 `.CMD`，子进程却仅报告 `.CPL`。Node 为 `v22.23.4`，Windows PowerShell 为 `5.1.20348.5756`。原样 `OLD_PREVIEW` 断言失败。这是真实 RED 观测，不是启动器或安装器合格结论。

后续 [Windows 运行](https://github.com/chiga0/qwen-code/actions/runs/41031170132) 在 `0bbcad` 上继承了父进程实际 `PATHEXT`。raw stdout 已为 `OLD_PREVIEW`，两种启动检查及无 staging 检查均完成，但用例仍失败：两次启动后，受保护的 fixture HOME 下出现了 `AppData/Local/Microsoft/Windows/PowerShell/StartupProfileData-NonInteractive` 和 roaming 目录，`.profile` 保持不变。完整文件结果为 1 失败、3 个声明的 POSIX 跳过；其他用例因 bail 未执行。这仍是 fixture 保护失败，不是完整文件通过。

## 候选改动与范围

在仅 Windows 使用的 fixture 环境中，与 `SystemRoot`、`ComSpec` 一起保留父进程实际的 `PATHEXT`。不编造默认扩展名列表，不放宽 stdout 断言，不修改安装器。第二次 Windows 观测确认该候选恢复了启动器输出，但随后 HOME 保护失败仍未解决。所有早期失败均保留。

保留安装前用例的两种独立启动观测：先运行原 PowerShell 表达式，通过六条 `QWEN_DIAG_` stderr 记录给出原四项 `PATHEXT`、`COMSPEC`、`SYSTEMROOT`、PowerShell 版本，以及真实 `GetFolderPath(LocalApplicationData)` 和 `GetFolderPath(ApplicationData)` 路径；只有它合格后，才执行严格旧安装检查。保存完整进程 error、signal、status、stdout、stderr。要求 trim 后 stdout 为 `OLD_PREVIEW`，每种诊断记录恰好一条（值允许为空），没有额外 stderr。第二个检查要求原生命令退出码，保留安装树断言并确认没有 staging 目录。该用例调用**零次安装器**、最多两个启动进程，不重试。其他保护用例另行执行真实安装器。

下一候选把 Windows `APPDATA`、`LOCALAPPDATA` 放到 fixture `root/tmp` 下两个明确的 owned 目录，位于受保护 HOME 之外，并记录两个构造值。完整 HOME/profile/tree 断言保持，不增加 cache 白名单、排除项或预期缓存字节，也不改写 USERPROFILE/HOME。这两个变量只是路由候选。历史 ConsoleHost 源码调用 `.NET Environment.GetFolderPath`，desktop framework 通过 `SHGetFolderPath` 解析 Windows known folder，而非简单读取这些变量。raw PowerShell 观测必须报告两个真实 known-folder 路径，并与预期 owned 目录精确相等。如果 Windows 解析到别处，就拒绝资格并保留保护失败，不能声称重定向已成功。该路由与完整文件仍需新的 Windows 验证。

现有 `windows-runner-smoke.yml` 保留布尔输入 `preview_launch_diagnostic`，默认 `false`。默认完整 ECS 任务及其预装 Node 路径保持。`true` 模式现在**一次运行包含 12 个已注册用例的完整 preview 安装器测试文件**，不使用测试名过滤；它不再表示只运行单个零安装器工作流任务。完整文件包含安装前用例及原保护场景，保留各自断言和声明的平台跳过，不运行全仓测试或构建 workspaces。

该聚焦 hosted `windows-2022` 任务使用 Node 22、共享 Windows 环境 action、精确 checkout 验证、冻结且带 `--ignore-scripts` 的依赖安装、零重试、单 worker、15 分钟限制及始终上传的日志。工作流元测试保护用例选择、错误传播及原默认 ECS 路径。五文件改动仅涉及 fixture/诊断测试、工作流、对应元测试和这两份设计文档。

## 验证与限制

通过 `scripts/tests/vitest.config.ts` 运行完整脚本测试及工作流元测试文件，并执行格式和适用的静态检查。macOS 可以验证 POSIX 场景与工作流接线；Windows 专用用例在此跳过不能算 Windows 证据。

审查后，在精确候选分支调用工作流并设置 `preview_launch_diagnostic=true`。记录真实 checkout、runner、Node、PowerShell，检查原始启动记录，报告完整文件实际通过/失败/跳过数量。首个 raw 启动仍须满足原 `OLD_PREVIEW` oracle，之后才运行严格检查；安装器场景仍必须满足安装树保护及 staging 断言。owned-appdata 候选的 Windows 结果尚未取得，不能只从环境值或启动器输出已恢复推定。

hosted Windows 不是原 ECS 主机。新的完整文件成功只能资格化已记录候选/环境下的 fixture 与保护测试文件，不代表全部 Windows 产品行为通过，也不改变原 ECS 结果。本改动不改变生产默认值、renderer、release 或安装器行为。
