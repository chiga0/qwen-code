# Windows preview 启动器 fixture 环境

[English](2026-10-30-windows-preview-launch-diagnostic.md) | [简体中文](2026-10-30-windows-preview-launch-diagnostic.zh-CN.md)

## 问题与已观测基线

[原 Windows ECS 场景](https://github.com/QwenLM/qwen-code/actions/runs/41002095690/job/123897020864) 先拒绝故意截断的归档，再通过旧安装树保持不变的比较。随后启动保留的 `qwen.cmd` 时，stdout 为空而非 `OLD_PREVIEW`。这不能证明安装器删了文件。

[hosted Windows 安装前诊断](https://github.com/chiga0/qwen-code/actions/runs/41030003395/job/123977212631) 在 `515b8d67` 上、尚未调用任何安装器时复现了 stdout 为空。PowerShell 包装进程 status 为 0、signal 为 null、error 为 null。fixture 未传 `PATHEXT`，父进程包含 `.CMD`，子进程却仅报告 `.CPL`。Node 为 `v22.23.4`，Windows PowerShell 为 `5.1.20348.5756`。原样 `OLD_PREVIEW` 断言失败。这是真实 RED 观测，不是启动器或安装器合格结论。

## 候选改动与范围

在仅 Windows 使用的 fixture 环境中，与 `SystemRoot`、`ComSpec` 一起保留父进程实际的 `PATHEXT`。不编造默认扩展名列表，不放宽 stdout 断言，不修改安装器。观测到的环境差异是此候选的依据，因果及修复成立仍需新的 Windows 结果。两个早期失败均保留。

保留安装前用例的两种独立启动观测：先运行原 PowerShell 表达式，并通过四条 `QWEN_DIAG_` stderr 记录给出 `PATHEXT`、`COMSPEC`、`SYSTEMROOT`、PowerShell 版本；只有它合格后，才执行严格旧安装检查。保存完整进程 error、signal、status、stdout、stderr。要求 trim 后 stdout 为 `OLD_PREVIEW`，每种诊断记录恰好一条（值允许为空），没有额外 stderr。第二个检查要求原生命令退出码，保留安装树断言并确认没有 staging 目录。该用例调用**零次安装器**、最多两个启动进程，不重试。其他保护用例另行执行真实安装器。

现有 `windows-runner-smoke.yml` 保留布尔输入 `preview_launch_diagnostic`，默认 `false`。默认完整 ECS 任务及其预装 Node 路径保持。`true` 模式现在**一次运行包含 12 个已注册用例的完整 preview 安装器测试文件**，不使用测试名过滤；它不再表示只运行单个零安装器工作流任务。完整文件包含安装前用例及原保护场景，保留各自断言和声明的平台跳过，不运行全仓测试或构建 workspaces。

该聚焦 hosted `windows-2022` 任务使用 Node 22、共享 Windows 环境 action、精确 checkout 验证、冻结且带 `--ignore-scripts` 的依赖安装、零重试、单 worker、15 分钟限制及始终上传的日志。工作流元测试保护用例选择、错误传播及原默认 ECS 路径。五文件改动仅涉及 fixture/诊断测试、工作流、对应元测试和这两份设计文档。

## 验证与限制

通过 `scripts/tests/vitest.config.ts` 运行完整脚本测试及工作流元测试文件，并执行格式和适用的静态检查。macOS 可以验证 POSIX 场景与工作流接线；Windows 专用用例在此跳过不能算 Windows 证据。

审查后，在精确候选分支调用工作流并设置 `preview_launch_diagnostic=true`。记录真实 checkout、runner、Node、PowerShell，检查原始启动记录，报告完整文件实际通过/失败/跳过数量。首个 raw 启动仍须满足原 `OLD_PREVIEW` oracle，之后才运行严格检查；安装器场景仍必须满足安装树保护及 staging 断言。候选 Windows GREEN 尚未取得，不能从父环境或本地运行推定。

hosted Windows 不是原 ECS 主机。新的完整文件成功只能资格化已记录候选/环境下的 fixture 与保护测试文件，不代表全部 Windows 产品行为通过，也不改变原 ECS 结果。本改动不改变生产默认值、renderer、release 或安装器行为。
