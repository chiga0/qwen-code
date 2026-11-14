# Native OpenTUI generated-skill review

[English](2026-11-14-opentui-skill-review.md) | [简体中文](2026-11-14-opentui-skill-review.zh-CN.md)

## Status and evidence

Implemented on the Memory dependency, not final main. One matching bundle passed all eight public scenarios under Node24/Ink, Bun1.4.4/Ink and strict Bun1.4.4/OpenTUI:24 executions, eight unique cases,108 closed mock-model HTTP requests,594 unique actual tool results and24 natural exits. The same bundle also passed the two Memory editor success/failure regressions with zero model HTTP. Ten native component geometry cases separately cover narrow and short viewports; they are not desktop GUI or OS-resize acceptance.

The native worker gap was corrected through existing public completed-tool bookkeeping in the CLI, leaving the20-tool threshold, scheduler and worker permissions intact. Historical baseline, product, setup and observer failures remain recorded independently. Local verification does not qualify a merged main candidate or every supported platform.

## Goal and scope

Restore the complete existing review surface: per-skill Keep/Discard; Keep/Discard all remaining when several remain; `o` editing of the actual staged file with preview reload; Escape decide-later; and turning off auto-generated skills without discarding the batch. Keep the existing scheduler, threshold20, worker permissions, staging/promotion and confirmation policy unchanged. No Core production change, new flag, command or pending-file schema is required. The existing Ink review also receives a local bare-Escape compatibility fix: Readline marks that unmodified event as meta; Ctrl/Alt Escape and modified editor keys remain guarded. Its queued submission gate also reserves an eligible idle review before the opening effect paints, once per pending snapshot. The existing decision-close lifecycle stays unchanged, including when resolution fails without a manager notification. Clearing the last pending task or falling back to an already deferred task also releases dialog ownership so the composer can return.

The Memory dependency already supplies real flag controls; only the existing auto-skill setter updates live runtime state. Disabling and re-enabling from `/memory` must respect existing getter policy. Do not treat a control toggle as approval of generated skills.

## Existing contracts to preserve

Ink AppContainer subscribes to `config.getMemoryManager()` with `{taskType:'skill-review'}`, project-filters `listTasksByType`, selects the most recently updated task with nonempty `metadata.pendingSkills`, and projects task ID/name/description/stagedManifestPath. These tasks live in the selected manager's in-memory Map. Staged files on disk alone do not establish cold-process task rehydration.

Ink DialogManager keys the panel by task ID. The panel snapshots the initial skill sequence so subscription shrinkage after a decision cannot skip entries. Keep/Discard requests one named operation and advances through that snapshot. Bulk options apply only to remaining entries and disappear when only one remains. Completion closes without dismissing: unresolved Core failures remain pending and eligible later. Escape adds only that task ID to the current session's dismissed Set; dismissing another task must not re-arm the first. It never rejects staged skills.

Turn off persists Workspace `memory.enableAutoSkill=false`, calls the same selected Config's existing `setAutoSkillEnabled(false)`, and closes without dismissing or rejecting. Re-enabling through Memory permits that still-pending batch to reopen. A write failure must not disable the live flag or falsely close as success. Use the existing writer's `throwOnWriteFailure` option/commit guard; do not change legacy Ink here.

## Minimal CLI integration and ownership

1. Watcher owns only the ordinary-native bookkeeping correction and its live-session tests. Pass actual completed tool name/args to the existing client method under current owner/session, excluding cancelled/client-initiated calls and paths already counted by shared rounds or Mod observers. This preserves recent tools and skill-write skip behavior; it is not a direct call to the scheduler. Core agent-loop, Mod observer, Ink stream, ACP and noninteractive callers remain unchanged.
2. Entry owns one thin native hook/controller shared with AppShell and the live turn. It owns the filtered subscription, project/task projection and per-owner dismissed Set. Reuse public `subscribe`, `listTasksByType`, `getTask`, `acceptPendingSkillFromTask` and `rejectPendingSkillFromTask`. No process-global manager, reconstructed approval paths or direct pending-skill filesystem promotion/deletion.
3. One collocated native dialog owns preview, stable batch index and existing selection primitives. Shell state owns whether it is presented, using actual selected Config/settings/host. No slash-command union expansion is needed for this automatic surface. A small shared native actual-file editor launcher may be extracted from Memory only if both dialogs use it; no generic launcher framework or Ink-context import.

Capture Config/manager/host/settings identity, session, working/project roots, Workspace settings path and task identity. Revalidate before each dispatch/edit/write and after asynchronous work. Before a named decision, verify the live task still belongs to the same project and that the name/staged-path tuple matches; do not fingerprint the whole mutable pending list and revoke one's own successful removals. Task/config replacement, observed getter A→B→A, close and unmount permanently revoke old callbacks. Old results cannot close, dismiss, repaint or poison a replacement. An already dispatched Core filesystem operation is not cancellable through these APIs; no rollback/atomic-cancellation promise is made. Stop further bulk dispatches after revocation, and never equate a resolved/no-op method with unobserved promotion.

## Queue and input precedence

Auto-open requires a nonempty actual batch, live auto-skill enablement, idle turn and no dismissed task. Memory and every existing higher-priority dialog/approval keep their slot; never replace an open command dialog with a review. Rank review below MCP/hooks/tool/action approvals and ordinary dialogs, above the idle composer. Where a renderer already exposes a background-tasks panel, it remains lower priority than review as in Ink; no new background-task UI is included. Preemption is not dismissal; remaining metadata is re-projected when the slot becomes available.

While review owns input, unmount/mute the composer and include it in foreground-shell focus blocking, command/deferred-prompt drains, global Escape/exit routing and update-notice visibility. Gate queued user/Mod prompts until it closes, without changing their order or auto-submitting behind the review. Existing shell gates must be traced at every read site rather than adding an unused `isReviewOpen` field. The controller exposes a synchronous selected-manager/project/dismissed/live-enable `canDrain` getter plus the actual shell UI-owner ref, because the live turn can complete and dequeue before React paints. The existing queue body is reused behind an idempotent current-owner resume method; Entry and shell eligibility release explicitly resume it. Old owner callbacks cannot resume a replacement, and queue order and current-turn steering remain unchanged. Re-check live enablement when Memory closes, because its stable Config setter alone does not trigger a React dependency change. Pending decisions/editor launch need a duplicate-input latch; advance the stable snapshot once per intended decision and retain unresolved failures, without accepting a successor through a stale page callback.

## Preview, editing and failure behavior

Match Ink's bounded read: request at most64 KiB plus one detection byte, retain at most12 logical preview lines and cap displayed wrapped rows to12 or the actual native body budget. Normalize CRLF, sanitize model-generated name/description/body/errors with existing CLI display helpers, show hidden/truncated markers, and show Loading/Preview unavailable honestly. Never show skill A's ready body for skill B while its read is pending.

`o` opens the actual current staged manifest via existing preferred-editor/platform rules and native suspend/resume in finally; it does not decide, advance or edit a temporary buffer. Reload after a blocking editor and watch the same staged file for nonblocking editor saves, coalescing events at300 ms. Close watchers/timers on replacement/unmount; consume asynchronous watcher errors and keep fallback reload usable. Release watchers and allow the CLI to exit naturally.

Read/editor/write/accept/reject failures cannot drop pending metadata or publish into a new owner. Core currently logs and retains real resolution failures; preserve that retryability and close-versus-dismiss distinction. Bulk is not an atomic transaction. Missing/changed task or staged tuple fails closed; unknown ownership cannot fall back to primary workspace.

## Validation and acceptance

The tracked public harness uses the genuine20-read route and distinct main/worker requests. It creates no seeded pending JSON or synthetic task and uses no scheduler bypass, private component import or forced NO_RELAUNCH. Its eight cases cover individual and bulk decisions, real owned editor success/failure, task-specific Escape deferral, persistent/live disable and Memory re-enable, disabled generation, and an actual queued user released exactly once after review. Staged/live bytes, unrelated skills, settings and protected fixtures are checked throughout. Model traffic is intentionally nonzero; Memory's zero-model contract is separate.

Build, repository and integration typechecks, affected whole-file tests, workflow meta-tests, zero-warning lint, formatting and bundle checks passed in their recorded scopes. Actual mounted-container regressions cover the first idle queue reservation, failed-decision close, final pending removal and fallback to an already deferred task. Component/adapter tests cover project/manager/task replacement, shrinking batches, owner ABA, late callbacks, duplicate keys, resolution/editor/writer failures, bounded hostile previews and watcher cleanup. Core manager tests remain read references; no Core production change is included. The stacked PR preserves the independently useful Memory dependency and must stay within gross6000 against its actual base.

## Boundaries and open work

Maintainer review, related merges and final-main validation remain open. Existing task APIs cannot atomically revoke already-started writes, and no cold pending-task persistence is promised. Real desktop GUI, Windows/Linux behavior, OS resize, IME/accessibility and device permissions require separate evidence. This work does not switch defaults, remove Ink, publish a release, merge automatically or complete the whole migration.
