# 派生对比维度 v3

> 数据来源：`analysis/matrix.md` v3（28 cell 真 PTY 录制 + 像素测量）
> 替代 v2（已 DEFECTIVE）

每个维度满足三条：
1. ✅ 直接对应 qwen 的痛点（信息密度 / 纵向空间 / 输出噪声）
2. ✅ 跨 agent 有量化差异（像素或源码数据）
3. ✅ 可执行（对应明确的改动点 + 风险）

---

## Dim-1: 同 prompt 纵向占用（content span）

**对应痛点**：纵向空间使用率

**实测数据**（4 agent × 7 prompt span 平均，单位：像素，VHS 1400×900）：

| Agent | 平均 span | P0 chat | P1 tool | P2 shell | P3 code | P4 markdown | P5 subagent | P6 error |
|---|---|---|---|---|---|---|---|---|
| **claude-code** | **363px** ⭐ | 220 | 268 | 350 | 398 | 625 | 349 | 333 |
| codex | 487px | 320 | 378 | 345 | 563 | 580 | 758¹ | 466 |
| **qwen** | **669px** | 497 | 827 | 820 | 675 | 822 | 562 | 481 |
| opencode | 771px² | 900 | 900 | n/a³ | 900 | 900 | 900 | 900 |

¹ codex 在 P5 SubAgent 上比 qwen 还大（758 vs 562），因为 codex 把 SubAgent 编排的 reasoning 展开得很详细
² opencode 因为有侧边栏，所有 span 都贴满高度
³ opencode P2 黑屏（VHS race），数据无效

**qwen vs claude 比例**：
- P0 chat: **2.26×** （qwen 49.7px / claude 22.0px）
- P1 tool: **3.09×** （qwen 82.7 / claude 26.8）
- P3 code: 1.70×
- P4 markdown: 1.32× （markdown 内容本身需要 ≥10 行结构，meta-reasoning 占比降低）
- P5 subagent: 1.61×
- P6 error: 1.45×

**结论**：**qwen 的 span 跟 claude 的差距主要在 P0/P1**（有 meta-reasoning + tool 调用展开的场景），不是所有 prompt。

---

## Dim-2: 内部留白率（mid_empty %）

**对应痛点**：纵向空间使用率 + 输出噪声

| Agent | 平均 %mid_empty |
|---|---|
| claude-code | 19.3% |
| opencode | -14.3%¹ |
| codex | 23.4% |
| **qwen** | **33.5%** |

¹ opencode 计算异常（无 top/bottom margin），实际看 span 即可

qwen 内部留白比 claude 高 14 个百分点。具体 P1 (tool) 高达 49.9%（一半屏幕是内容之间的空行）。

来源：qwen tool 面板用圆角外框上下各加空行 + 多个 tool 之间空行 + meta-reasoning 段之间空行。

---

## Dim-3: Splash 占用

**对应痛点**：纵向空间使用率（启动后**每次**都付）

| Agent | splash span (px) | %used |
|---|---|---|
| claude-code | ~130 | 12.2% |
| codex | ~200 | 22.1% |
| gemini-cli | ~245 | 27.4% |
| **qwen** | **~280** | 34.8% |
| opencode | 900 | 100% (居中大字 + 大量留白) |

qwen splash **几乎是 claude 的 2.2×**。

可配置项实测（`packages/cli/src/config/settingsSchema.ts`）：
- `ui.hideBanner` default `false` → 设 `true` 可隐藏 ASCII 大字
- `ui.hideTips` default `false` → 设 `true` 可隐藏 Tips 行

**qwen 已实装但默认全开**。改默认 = 简单 + 立即收益 (5-7 行)。

---

## Dim-4: 工具调用展示策略（核心差异点）

**对应痛点**：信息密度 + 输出噪声

| Agent | 默认 tool 渲染 | 实测 P1 tool 行数 |
|---|---|---|
| **claude-code** | **N→1 单行摘要** "Read 1 file, listed 1 directory (ctrl+o to expand)" | 1 行 |
| codex | ▼ Explored 折叠面板 | 折叠到 1 面板 |
| gemini-cli | 每工具 1 行 ✓ ReadFile X | 3-4 行 |
| **qwen** | **圆角面板** 包多个工具 + 每工具单独行 | 5 行 |
| opencode | 每工具 1 行（紧凑） | 3-4 行 |

qwen 已经有 N→1 聚合的代码（`packages/cli/src/ui/utils/mergeCompactToolGroups.ts`），但**仅在 compactMode=true 时启用**。compactMode 默认 false。

---

## Dim-5: Meta-reasoning（assistant content 中的 "+ 推理段"）默认外露

**对应痛点**：输出噪声（最大单笔）

实测 P0 chat："Reply in English with exactly ONE sentence introducing yourself. Do not use any tools."

| Agent | 输出实际行数 | 是否带 meta-reasoning |
|---|---|---|
| qwen | 9-10 行（"+ The user has set up context... There's a conflict... So English it is. Let me introduce myself..."）+ 1 行答案 | ✅ |
| claude-code | 1 行答案 | ❌ |
| codex | 1-2 行答案 | ❌ |
| opencode | 含 "Thinking:" 块 + 答案 | ✅（但有视觉区分，斜体灰）|

**重要 v2 修正**：v3 实测确认 qwen 的 `TOGGLE_COMPACT_MODE` (Ctrl+O) **能隐藏** 这种 "+ 前缀的 assistant content piece"，不只是工具结果（见 `ctrl-o-v3-toggled-back.png` vs `after-tools.png`）。

→ **TUI 层可解**，方案：把 compactMode 默认改为 true，或新增"profile = compact"综合开关。

---

## Dim-6: 状态栏 / Footer 信息组织

**对应痛点**：信息密度（间接 —— 把当前状态信息持续可见，让 splash 可瘦身）

| Agent | 底部状态栏 | 颗粒化设置数 | 用户可自定义 |
|---|---|---|---|
| qwen | 无固定栏（splash 一次性显示）+ 退出大面板 | 0 | ❌ |
| claude-code | 常驻单行 | 0 | ✅ **shell hook 完全可编程** (`statusLine.command`) |
| codex | 常驻单行 + 内嵌 model 面板 | 0 | ❌ |
| gemini-cli | 常驻底栏 + 标签行 | **~10**（`ui.footer.hide*` 全套）| ✅ 每项独立显隐 |
| opencode | 底栏 + **右侧栏**（独有）| 部分（plugin slot）| ❌ |

qwen 作为 gemini fork **丢了 footer 颗粒化设置**。`ui.footer.hideCWD/hideModelInfo/hideContextPercentage/hideSandboxStatus/hideContextSummary` 等系列在 gemini 都有，qwen `settingsSchema.ts` 中**未发现对应项**。

---

## Dim-7: 模式切换发现性

**对应痛点**：输出噪声（间接 —— 用户能否找到现有功能）

| Agent | 发现性方案 |
|---|---|
| qwen | 10+ 个 Ctrl+X / Alt+X 单键，splash 底显示 "按 ? 查看快捷键"（**二级菜单**）|
| claude-code | "? for shortcuts" + Shift+Tab 模式提示常驻 |
| codex | （未充分核验）|
| opencode | **Ctrl+P 命令调色板** ⭐ 可搜索；Tip 占位提示 "tab agents ctrl+p commands" |

qwen 的 10 个键用户没法都记住。**Ctrl+P 调色板 + 快捷键提示常驻** 是发现性的两条候选改进。

---

## Dim-8: 同键不同义（fork 一致性）

**对应痛点**：不是密度问题，但**影响用户预期 / 防止采纳新方案时引发新的反弹**

| Key | qwen | gemini-cli | claude-code |
|---|---|---|---|
| **Ctrl+O** | TOGGLE_COMPACT_MODE | SHOW_MORE_LINES（**展开**） | toggleTranscript |
| **Ctrl+T** | TOGGLE_TOOL_DESCRIPTIONS | SHOW_FULL_TODOS | toggleTodos |
| **Ctrl+S** | SHOW_MORE_LINES | TOGGLE_MOUSE_MODE | - |
| **Ctrl+Y** | RETRY_LAST | TOGGLE_YOLO | - |

qwen 改了同键的语义 ——如果 P0 建议"翻 compactMode 默认 + 加键位提示"，要在 docs 里把这个对照表写清楚。

---

## 派生维度 → 改进建议 优先级映射

| Dim | 改进建议 | 类型 | 预期收益 |
|---|---|---|---|
| **Dim-4 + Dim-5** | **`ui.compactMode` 默认从 `false` 改为 `true`** | 翻默认值 | P1 同 prompt span 从 827 → 估计 350-400px (claude 量级)；P0 从 497 → 估计 ~220px |
| **Dim-3** | `ui.hideBanner` / `ui.hideTips` 默认改 true（或加 `--minimal-banner` flag）| 翻默认值 | splash 每次省 5-7 行 |
| **Dim-6** | 加底部状态栏 + 颗粒化 `ui.footer.hide*` 设置 | 新增设置 | 不省行但让 splash 可瘦身且 model/cwd 持续可见 |
| **Dim-7** | 加 Ctrl+P 命令调色板（学 opencode）| 新增功能 | 利用率：现有 10 个 toggle 键的使用率从 ~5% → ~50% |
| **Dim-2** | 减少 tool 面板边框 + 行间空行 | 渲染细调 | 估计 P1 内部留白从 49.9% → ~25%（再省 ~150px）|
| **Dim-8** | 文档化 vs gemini 键位差异 | docs | 防 fork 用户混淆 |

---

## 不进入派生维度的（明确剔除）

- opencode 居中布局 + 大量留白 → 反借鉴
- opencode 33 主题系统 → 与密度无关
- claude 的 statusLine shell hook → 灵活但学习成本高，gemini 颗粒化设置已够
- codex 的"Waited for background terminal"噪声 → 是 codex 自家架构问题
- subagent 渲染（qwen 已带 metadata，行业较好）→ 无需改
- 错误展示降级 → 本轮实测 4 agent 都正确降级（v2 的 JSON dump 是 gemini/opencode thinking-mode bug 的副作用，非常规行为）
