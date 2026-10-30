# Windows preview launcher diagnostic

[English](2026-10-30-windows-preview-launch-diagnostic.md) | [简体中文](2026-10-30-windows-preview-launch-diagnostic.zh-CN.md)

## Problem and status

The [Windows ECS baseline](https://github.com/QwenLM/qwen-code/actions/runs/41002095690/job/123897020864) rejected a deliberately truncated archive, then passed the comparison proving the previous installation tree was unchanged. Its next assertion failed: launching the retained `qwen.cmd` produced empty stdout instead of `OLD_PREVIEW`. That failure does not establish that the installer deleted files or that `PATHEXT` caused the problem.

This change adds diagnostic tests and an opt-in workflow mode. It does not modify the installer or fix an assumed environment cause. The original failure remains recorded. Windows execution of the new diagnostic is still required.

## Diagnostic design

Reuse the existing preservation test fixture and its exact seeded `.cmd` file. Before any installer invocation, perform two distinct launch observations without retries:

1. The original PowerShell launcher expression, with four stderr records added for `PATHEXT`, `COMSPEC`, `SYSTEMROOT` and the PowerShell version. Capture the constructed environment and complete process error, signal, status, stdout and stderr. Require a successful process, trimmed stdout exactly `OLD_PREVIEW` and exactly one of each `QWEN_DIAG_` record; values may be empty. Additional error output rejects qualification. An empty `PATHEXT` alone is not proof of causality.
2. Only if the first observation qualifies, run the existing old-installation check with strict PowerShell error handling and a required native exit code. Preserve its tree comparison, require successful `OLD_PREVIEW` output and empty stderr, and confirm no staging directory was created.

This focused case invokes **zero installers** and at most two launcher processes. The second launch is a separate error-detection observation, not an input or assertion retry. The fixture environment remains unchanged, including its omitted `PATHEXT`; no inherited/default extension list is injected. Other preservation cases retain their original archive and protection assertions.

The existing `windows-runner-smoke.yml` gains `preview_launch_diagnostic`, a boolean defaulting to `false`. The default retains the full ECS validation job and its preinstalled Node path. Selecting `true` runs only a hosted `windows-2022` diagnostic job with Node 22, the shared Windows environment action, exact checkout verification, and frozen dependency installation with `--ignore-scripts`. It selects only the pre-install testcase, with zero retries and one worker, without workspace builds or the full suite. A 15-minute job bound and an always-uploaded diagnostic log keep failure evidence available. Workflow meta-tests protect both modes.

## Validation and limits

Run the changed script test and the complete workflow meta-test file through `scripts/tests/vitest.config.ts`, plus formatting and applicable static checks. A macOS run can verify the POSIX cases and workflow wiring; the Windows-only diagnostic is skipped there and cannot count as Windows evidence.

After review, dispatch the existing workflow on the exact diagnostic branch with `preview_launch_diagnostic=true`. Record the actual checkout, runner, Node and PowerShell identities and inspect the preserved log even if the test fails. A successful diagnostic qualifies only the seeded launcher observations, not installation, rollback, packaging or the full Windows product.

Hosted Windows is not the original ECS host. Different behavior requires a separately bound comparison on that environment; it does not justify rerunning its entire suite or relabeling the original failure. Any environment repair, including `PATHEXT` inheritance, needs evidence and separate regression verification. No production default, release or renderer behavior changes here.
