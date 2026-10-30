# Windows preview launcher fixture environment

[English](2026-10-30-windows-preview-launch-diagnostic.md) | [简体中文](2026-10-30-windows-preview-launch-diagnostic.zh-CN.md)

## Problem and observed baseline

The [original Windows ECS case](https://github.com/QwenLM/qwen-code/actions/runs/41002095690/job/123897020864) rejected a deliberately truncated archive, then passed the comparison proving the previous installation tree was unchanged. Launching the retained `qwen.cmd` subsequently produced empty stdout instead of `OLD_PREVIEW`. That failure does not establish installer file deletion.

A [hosted Windows pre-install diagnostic](https://github.com/chiga0/qwen-code/actions/runs/41030003395/job/123977212631), on `515b8d67`, reproduced the empty stdout before invoking any installer. The PowerShell wrapper process returned status 0, signal null and error null. The fixture omitted `PATHEXT`, while the parent contained `.CMD`; the child reported only `.CPL`. Node was `v22.23.4` and Windows PowerShell was `5.1.20348.5756`. The unchanged `OLD_PREVIEW` assertion failed. This is a real RED observation, not a successful launcher or installer qualification.

A second [Windows run](https://github.com/chiga0/qwen-code/actions/runs/41031170132) on `0bbcad` inherited the real parent `PATHEXT`. Raw stdout was now `OLD_PREVIEW`, and both launcher checks and the no-staging check completed. The case still failed: after the launches, the protected fixture HOME gained `AppData/Local/Microsoft/Windows/PowerShell/StartupProfileData-NonInteractive` and roaming directories. Its `.profile` stayed unchanged. The whole-file result was 1 failure and 3 declared POSIX skips; other cases were not reached after bail. This remains a fixture-protection failure, not a whole-file pass.

## Candidate change and scope

Preserve the parent's actual `PATHEXT` in the Windows-only fixture environment alongside `SystemRoot` and `ComSpec`. Do not invent a default extension list, weaken the stdout assertion or change the installer. The second Windows observation confirms restored launcher output on that candidate, while its subsequent HOME-protection failure remains unresolved. All earlier failures remain recorded.

Keep the pre-install testcase's two distinct launcher observations: first the original PowerShell expression with six `QWEN_DIAG_` stderr records: the original `PATHEXT`, `COMSPEC`, `SYSTEMROOT`, PowerShell version, plus actual `GetFolderPath(LocalApplicationData)` and `GetFolderPath(ApplicationData)` paths; then, only if that qualifies, the strict old-installation check. Capture complete process error, signal, status, stdout and stderr. Require trimmed stdout `OLD_PREVIEW`, exactly one of each diagnostic record (values may be empty), and no additional stderr. The second check requires a native exit code, preserves the installation-tree assertion and confirms no staging directory. This testcase invokes **zero installers** and at most two launcher processes, with no retry. Other preservation cases exercise the real installer separately.

The next candidate places Windows `APPDATA` and `LOCALAPPDATA` in two explicit owned directories under fixture `root/tmp`, outside protected HOME, and records both constructed values. Keep the full HOME/profile/tree assertions unchanged: no cache whitelist, exclusion, expected cache bytes or USERPROFILE/HOME rewrite. These variables are only a routing candidate. Historical ConsoleHost code uses `.NET Environment.GetFolderPath`, and the desktop framework resolves Windows known folders through `SHGetFolderPath`, rather than simply reading those variables. The raw PowerShell observation must report both actual known-folder paths and match the two expected owned directories exactly. If Windows resolves elsewhere, reject qualification and retain the protection failure; do not claim redirection succeeded. This route and the complete file still require new Windows verification.

The existing `windows-runner-smoke.yml` retains its boolean `preview_launch_diagnostic`, default `false`. The default full ECS job and its preinstalled Node path remain in place. The `true` mode now runs the **entire 12-registered-case preview installer test file once**, without a test-name filter; it no longer means a single zero-installer workflow job. It includes the pre-install testcase and the original preservation cases, retaining their assertions and declared platform skips. It does not run the whole repository suite or build workspaces.

This focused hosted `windows-2022` job uses Node 22, the shared Windows environment action, exact checkout verification, frozen `--ignore-scripts` dependency installation, zero retries, one worker, a 15-minute bound and an always-uploaded log. Workflow meta-tests protect selection, error propagation and the unchanged default ECS path. The five-file change is limited to the fixture/diagnostic test, workflow, its meta-tests and these two design documents.

## Validation and limits

Run the complete script test and workflow meta-test file through `scripts/tests/vitest.config.ts`, formatting and applicable static checks. macOS can validate POSIX cases and workflow wiring; Windows-only skips there are not Windows evidence.

After review, dispatch the exact candidate branch with `preview_launch_diagnostic=true`. Record actual checkout, runner, Node and PowerShell, inspect the raw launch records and report the whole file's actual pass/fail/skip counts. The first raw launch must again satisfy the original `OLD_PREVIEW` oracle before the subsequent strict check; preserved-tree and staging assertions remain required for installer cases. The owned-appdata candidate Windows result is pending; it must not be inferred from environment values or restored launcher output alone.

Hosted Windows is not the original ECS host. A new successful file run would qualify that fixture and preservation file on the recorded candidate/environment, not all Windows product behavior or the original ECS result. No production default, renderer, release or installer behavior changes here.
