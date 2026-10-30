# Windows preview 启动器诊断

[English](2026-10-30-windows-preview-launch-diagnostic.md) | [简体中文](2026-10-30-windows-preview-launch-diagnostic.zh-CN.md)

## 问题与状态

[Windows ECS 基线](https://github.com/QwenLM/qwen-code/actions/runs/41002095690/job/123897020864) 先拒绝故意截断的归档，随后通过旧安装树保持不变的比较。接下来的断言失败：启动保留的 `qwen.cmd` 时，stdout 为空而非 `OLD_PREVIEW`。这不能证明安装器删了文件，也不能证明原因是 `PATHEXT`。

本改动增加诊断测试及可选工作流模式，不修改安装器，不按假设修复环境。原失败保留。新增诊断仍需在真实 Windows 执行。

## 诊断设计

复用现有保护测试 fixture 及其原样生成的 `.cmd` 文件。在调用任何安装器之前，进行两种不同的启动观测，不重试：

1. 保留原 PowerShell 启动表达式，仅增加四条 stderr 记录，分别给出 `PATHEXT`、`COMSPEC`、`SYSTEMROOT` 和 PowerShell 版本。保存构造的环境，以及完整进程 error、signal、status、stdout、stderr。要求进程成功、trim 后的 stdout 精确为 `OLD_PREVIEW`，且每种 `QWEN_DIAG_` 记录恰好一条；值允许为空。额外错误输出使诊断不合格。仅有 `PATHEXT` 为空并不能证明因果。
2. 只有首个观测合格后，才以严格 PowerShell 错误处理及必需的原生命令退出码执行已有旧安装检查。保留安装树比较，要求成功且输出为 `OLD_PREVIEW`、stderr 为空，并确认没有创建 staging 目录。

聚焦场景调用**零次安装器**、最多两个启动进程。第二次启动是独立的错误检测观测，不是输入或断言重试。fixture 环境保持原样，包括未传 `PATHEXT`；不注入继承值或默认扩展名列表。其他保护场景保留原有归档与保护断言。

现有 `windows-runner-smoke.yml` 增加布尔输入 `preview_launch_diagnostic`，默认 `false`。默认仍运行完整 ECS 验证及其预装 Node 路径。选择 `true` 时只运行 hosted `windows-2022` 诊断任务：使用 Node 22、共享 Windows 环境 action、精确 checkout 验证，以及带 `--ignore-scripts` 的冻结依赖安装。只选择安装前的测试用例，零重试、单 worker，不做 workspace build 或运行完整测试集。任务限制为 15 分钟，日志始终上传，以保留失败证据。工作流元测试保护两种模式。

## 验证与限制

通过 `scripts/tests/vitest.config.ts` 运行修改的脚本测试及完整工作流元测试文件，并执行格式和适用的静态检查。macOS 运行可以验证 POSIX 场景及工作流接线；Windows 专用诊断在该平台跳过，不能算 Windows 证据。

审查后，在精确的诊断分支上调用已有工作流，并设置 `preview_launch_diagnostic=true`。记录真实 checkout、runner、Node、PowerShell 身份，即使用例失败也应读取保存的日志。诊断成功只资格化预置启动器观测，不代表安装、回滚、打包或完整 Windows 产品通过。

hosted Windows 不是原 ECS 主机。行为不同需要在该环境另行绑定比较，不能据此重跑其整套测试或改贴原失败。包括继承 `PATHEXT` 在内的环境修复，必须先有证据，再独立验证回归。本改动不改变生产默认值、release 或 renderer 行为。
