# 原生 OpenTUI 生成技能审阅

[English](2026-11-14-opentui-skill-review.md) | [简体中文](2026-11-14-opentui-skill-review.zh-CN.md)

## 状态与证据

已基于 Memory 依赖实现，尚非最终 main。同一份 bundle 在 Node24/Ink、Bun1.4.4/Ink 和严格 Bun1.4.4/OpenTUI 下通过八个公开场景：24次执行、八个唯一用例、108次完整关闭的 mock-model HTTP、594个唯一真实工具结果、24次自然退出。同一产物另通过两项 Memory 编辑器成功/失败回归，模型 HTTP 为0。十个 Native 组件几何用例独立覆盖窄/短视口，不代表真实桌面 GUI 或 OS resize 验收。

Native worker 缺口通过 CLI 既有公开 completed-tool 记账修正，保持20工具阈值、调度器及 worker 权限。历史 baseline、产品、setup 和 observer 失败均独立保留。本机验证不代表合并后的 main 候选或全部支持平台通过。

## 目标与范围

恢复完整已有表面：单项 Keep/Discard，多项时 Keep/Discard all remaining，`o` 编辑实际 staged 文件并刷新预览，Escape 稍后决定，以及关闭自动生成技能但不丢弃批次。保持现有调度器、阈值20、worker 权限、staging/promotion 和确认政策。不改 Core 生产代码，也不加 flag、命令或 pending 文件 schema。既有 Ink 审核另补一个局部裸 Escape 兼容修正：Readline 会把该未修改事件标为 meta；Ctrl/Alt Escape 和带修饰的编辑器按键仍受保护。 排队输入同样在打开 effect 绘制前按现有资格条件为每个 pending 快照预留一次审核槽位。保持原有决策关闭流程，包括写入失败且 manager 未通知的情况。最后一个 pending 任务清空或回退到已延后的旧任务时，同步释放弹窗输入占用，以恢复 composer。

Memory 依赖已提供真实 flag 控制，只有已有 auto-skill setter 更新运行时。通过 `/memory` 关闭和重开要遵守既有 getter 政策；不能把控制项切换当作批准生成技能。

## 必须保留的已有合同

Ink AppContainer 对 `config.getMemoryManager()` 以 `{taskType:'skill-review'}` 订阅，按项目过滤 `listTasksByType`，取最近更新且 `metadata.pendingSkills` 非空的任务，投影 task ID/name/description/stagedManifestPath。任务位于所选 manager 的内存 Map；磁盘 staged 文件不等于冷进程会重建旧任务。

Ink DialogManager 以 task ID 为 key。面板在挂载时快照技能序列，防止决策后订阅列表缩短导致跳项。Keep/Discard 请求一次具名操作并推进快照。批量项只处理剩余内容，只有一项时隐藏。完成后关闭但不标记 dismissed；Core 失败的未决项仍可稍后出现。Escape 只把当前 task ID 加入本 session 的 dismissed Set；关闭另一任务不能重新唤醒前一任务，也不拒绝 staged 技能。

Turn off 持久化 Workspace `memory.enableAutoSkill=false`，调用同一 Config 的已有 `setAutoSkillEnabled(false)`，然后关闭，不 dismiss 或 reject。通过 Memory 重开后同一 pending 批次可再次出现。写入失败不能关闭 live flag 或假成功退出；复用已有 writer 的 `throwOnWriteFailure` 和 commit guard，本范围不修旧 Ink。

## 最小 CLI 接线与所有权

1. watcher 仅负责普通原生记账修正和 live-session 测试。在当前 owner/session 下，把真实完成工具名及 args 交给已有 client 方法，排除取消、client-initiated、已由 shared round 或 Mod observer 计数的路径。保留 recent tools 和技能写入跳过语义，不直接调用调度器；Core agent-loop、Mod observer、Ink stream、ACP 和非交互消费者不变。
2. Entry 持有一个薄 Native hook/controller，由 AppShell 和 live turn 共用，管理过滤订阅、project/task 投影及每 owner 的 dismissed Set。复用公开 `subscribe`、`listTasksByType`、`getTask`、`acceptPendingSkillFromTask`、`rejectPendingSkillFromTask`。不取 process-global manager，不拼接任意批准路径，不直接调用 pending-skill 文件提升/删除。
3. 一个同目录原生对话框管理预览、稳定批次 index 和已有选择原语；shell 状态控制展示，并显式提供所选 Config/settings/host。自动表面不需扩展 slash-command union。只有 Memory 和新对话框共同使用时，才可抽出小型 Native 真实文件 editor launcher，不造通用框架或导入 Ink context。

捕获 Config/manager/host/settings 身份、session、working/project 根、Workspace 设置路径及任务身份。每次分派/编辑/写入前及异步完成后核对。具名决策前验证实时任务仍属于同一项目，且 name/staged-path tuple 一致；不能用整个可变 pending 列表指纹撤销自身成功删除。task/config 替换、观测到 getter A→B→A、关闭和卸载均永久撤销旧回调。旧结果不能关闭、dismiss、重绘或污染新代。现有 API 无法取消已分派的 Core 文件操作，不承诺回滚或原子取消；撤销后停止后续批量分派，不能把 resolved/no-op 调用当作未观察的提升成功。

## 队列和输入优先级

自动打开要求实际非空批次、live auto-skill 开启、turn idle，且任务未 dismissed。Memory 及所有既有高优先级对话框/审批保留槽位，不能覆盖已打开的命令对话框。review 排在 MCP/hooks/tool/action 审批和普通对话框之后、idle composer 之前。若 renderer 已提供后台任务面板，则与 Ink 一样其优先级低于 review；本增量不新增后台任务 UI。被抢占不等于 dismiss；槽位恢复时重新投影剩余元数据。

review 拥有输入期间，应卸载/静音 composer，并纳入前台 shell 焦点阻断、命令/延迟提示 drain、全局 Escape/exit 路由和更新通知显隐。排队的用户/Mod 提示在关闭前不得后台自动提交，也不重排。逐个追踪现有 shell gate 读点，不能只新增无人消费的 `isReviewOpen`。Memory 关闭时重新读取 live enablement，因为稳定 Config 的 setter 不会独自改变 React 依赖。pending 决策/编辑器启动有防重复 latch；每次明确决策推进稳定快照一次，保留未决失败，不能用旧页面回调决定后继。

controller 提供同步读取所选 manager/project/dismissed/live-enable 的 `canDrain` getter，并读取真实 shell UI owner ref，因为 live turn 可能在 React 绘制前完成并出队。复用原队列处理体，通过幂等且检查当前 owner 的 resume 方法恢复；Entry 和 shell 在资格释放后显式调用。旧 owner 回调不能恢复后继队列，保持队列顺序和当前 turn 的 steering 行为。

## 预览、编辑与失败

匹配 Ink 有界读取：最多读取64 KiB加一个检测字节，最多保留12个逻辑预览行，显示换行后行数上限为12或实际 Native body 预算。规范 CRLF，以已有 CLI display helper 清理模型生成 name/description/body/error，显示隐藏/截断标记，真实呈现 Loading/Preview unavailable。B 的读取 pending 时不能显示 A 的 ready 内容。

`o` 按已有首选编辑器/平台规则打开当前实际 staged manifest，在 finally 中恢复 Native suspend/resume；不决策、不推进，也不编辑临时 buffer。阻塞编辑器结束后重新读取，非阻塞编辑器通过同一 staged 文件 watcher 保存刷新，事件按300 ms合并。替换/卸载关闭 watcher/timer，消费异步 watcher 错误并保留 fallback reload。释放 watcher 并允许 CLI 自然退出。

读/编辑/写/接受/拒绝失败不能丢 pending 元数据，也不能向新 owner 发布。Core 当前记录并保留真实 resolution 失败，应保留可重试性和 close/dismiss 区别。批量不是原子事务。缺少/变化的 task 或 staged tuple 应 fail closed，owner 未知不得回退 primary workspace。

## 验证与验收

已提交的公开 harness 使用真实20-read路线，并区分主请求与 worker 请求。不预置 pending JSON、不合成任务，不绕过调度，不私下导入组件，也不强制 NO_RELAUNCH。八项覆盖单项/批量决策、真实 owned 编辑器成功/失败、按任务 Escape 延后、持久化/live关闭及 Memory 重开、禁用生成，以及实际排队用户在审核后仅释放一次。各阶段检查 staged/live 字节、无关技能、设置及保护域。模型流量有意非0，Memory 的零模型合同另计。

build、仓库及 integration typecheck、受影响整文件测试、workflow meta-tests、零警告 lint、格式和 bundle 均在已记录范围通过。实际挂载容器回归覆盖首次 Idle 队列预留、失败决策关闭、最终 pending 移除及回退已延后任务。组件/adapter 测试覆盖 project/manager/task替换、批次缩短、owner ABA、迟到回调、重复按键、resolution/editor/writer失败、有界恶意预览及 watcher 清理。Core manager 测试仅作读取参考，不含 Core 生产修改。堆叠 PR 保留独立有用的 Memory 依赖，按实际 base 的 gross6000 上限提交。

## 边界与开放工作

维护者审阅、相关合并及最终 main 验证仍未完成。既有 task API 不支持原子撤销已启动写入，不承诺冷 pending task 持久化。真实桌面 GUI、Windows/Linux、OS resize、IME/无障碍及设备权限需独立证据。本工作不切默认、不移除 Ink、不发布 release、不自动 merge，也不代表整体迁移完成。
