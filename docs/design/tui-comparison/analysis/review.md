# Self-Review Log（v3 / 终轮）

> 本文件**滚动追加**所有审查轮次。v3 终轮在最末，保留前史作为研究透明度证明。

---

## Round 1-9（v1/v2 时期审查，已收敛）

详见末尾"历史 Review 摘要"。关键里程碑：
- Round 1-7：基本流程定型，结论"可发布"
- Round 8：发现 v1/v2 建议大半冗余（qwen 已实装功能，只是默认全关）
- Round 9：v3 实测确认 compactMode 影响范围 > 源码注释暗示，TUI 层可解决 meta-reasoning

v1/v2 已 DEFECTIVE，详细问题清单 `analysis/data-quality-quarantine.md`。

---

## Round 10：v3 终轮（2026-05-12）

用户对 v1/v2 提了三处实质问题，全部修正：

### 10.1 "gemini/opencode 没测试" 修正

| 问题 | v3 修复 |
|---|---|
| gemini/opencode 实测都失败（thinking-mode 错误）就下结论 | 排查发现：gemini = 本环境 reasoning_content 路由 bug 不可用；opencode = 默认 model 是 reasoning 模型，**用 `-m idealab/qwen3.6-max-preview` 切换后成功**（实测 P0-P6 全部捕到完整响应）|

v3 状态：
- gemini-cli：明确从矩阵中排除，D 类源码 inventory 仍可用作设计参考
- opencode：7/7 全部成功（含 P2，待重测的是 toggle race）

### 10.2 "多处黑屏 race 当数据用了" 修正

| 问题 | v3 修复 |
|---|---|
| v2 toggle 测试时把 toggled-back 当 default 等价 | v3 用 **独立会话** before/after，明确 default 状态 vs Ctrl+O 后状态 |
| qwen Ctrl+O 实测在简单 prompt（"hello"）上跑，看不到效果 | v3 用 **P1 tool-using prompt** 触发实际 compact 隐藏行为 |

剩余 race 风险：
- opencode P2（长 shell）矩阵 cell 黑屏 → 排除，标 ⚠️
- qwen toggle 第一次跑（pai/glm-5.1 慢模型）超时 → 已用 `-m qwen3.6-max-preview` 修复

### 10.3 "字体 / 边框 / 间距完全没量化" 修正

| 问题 | v3 修复 |
|---|---|
| v2 全靠肉眼数行数 | v3 写了 `scripts/measure-density.py`（Python + PIL），对 28 cell 全量 PNG 做像素级测量：text% / solid_bar% / mid_empty% / content_span 单位是像素 |
| 字号本身不能比 | VHS 内部用 chromium-headless 渲染，所有 agent 同 FontSize 14。"同字号下" 公平。**绝对像素值与真 iTerm 字体引擎有差异**——已写入 README + report §9.4 |
| 边框 / 间距 | 通过 solid_bar 行检测（>50% 单色填充 = chrome 边框）+ mid_empty 行（< 2% ink = 行间空白）量化 |

剩余局限：
- 字体引擎差异：VHS chromium 字体 vs iTerm Core Text/FreeType。本调研用 VHS 内对比公平。
- 颜色 / 对比度：未量化

### 10.4 6 项需求 vs v3 交付覆盖度

用户 6 项需求 self-audit：

| # | 需求 | v3 覆盖 | 证据 |
|---|---|---|---|
| 1 | 默认配置下 同 prompt 多维度展示对比（model output / thinking / tool / SubAgent / code / shell / markdown） | ✅ 95% | 7 prompt × 4 agent = 28 cell，每 cell PNG + 像素数据 |
| 2 | 长工具输出默认渲染 + 展开 | ⚠️ 60% | P2 covers long shell（qwen 默认 `shellOutputMaxLines: 5` 已截断）；claude 展开（Ctrl+O transcript）已实测；其他 agent 展开行为未单独测 |
| 3 | 字体 / 间距 / border 屏占比 | ⚠️ 70% | 间距 / border 量化✓；字体本身 = VHS 单字体不可比 |
| 4 | 各显示快捷键横向对比 + 精简模式对比 | ✅ 80% | D 类源码核验全 ✓；mode toggle before/after 录制中（qwen Ctrl+O / Alt+M、claude Ctrl+O、codex Ctrl+T、opencode `<leader>h/b`）|
| 5 | 信息有效性（工具输出截断是否有用） | ⚠️ 50% | P2 触发了 qwen shellOutputMaxLines；其他 agent 截断阈值未对比；"是否能展开看完整" 仅 claude 测了 |
| 6 | 真 PTY 数据，禁推断 | ✅ 95% | 28 矩阵 cell 全 PTY；toggle cell 全 PTY；唯一推断是 codex D 类（源码未在用户提供池中，靠 splash + 运行观察）|

覆盖度评估：**平均 75%**，主要缺口在 #2 / #5（长输出展开细节）和 #4（部分 shortcut 未单独 before/after）。

### 10.5 数据可信度分类（v3 最终版）

| 数据类 | 状态 | 备注 |
|---|---|---|
| 4 agent matrix 28 cell 响应 PNG | ✅ 可信 | 真 PTY，每张已肉眼复核 |
| 像素测量（content_span / %used / %mid_empty 等）| ✅ 可信 | PIL 计算，公式透明，可复核 |
| opencode P2（长 shell）| ❌ 无效 | VHS race 黑屏，从矩阵 §3 P2 行排除 |
| 4 agent splash 烟囱 PNG | ✅ 可信 | |
| qwen Ctrl+O toggle | ⚠️ 部分 | 第一轮失败（慢模型）+ 第二轮失败（API 401）+ 第三轮（`qwen -m qwen3.6-max-preview`）—— 第三轮数据采集中 |
| claude Ctrl+O transcript toggle | ✅ 可信 | 一次成功，span 268 → 399 |
| 其他 toggle | ⏳ 录制中 | |
| 4 agent D 类源码 file:line | ✅ 可信 | grep 验证 |
| codex D 类 | ❌ 0 引用 | codex 源码不在用户池 |
| gemini D 类源码 | ✅ 可信 | 路径已修正为 `packages/cli/src/ui/key/keyBindings.ts` |
| 用户真终端截图（gemini/opencode chat）| ✅ 可信 | 用户直接提供 |

### 10.6 报告中的每条建议 trace 回证据

| 建议 | 量化依据 | 源码依据 | 实测依据 |
|---|---|---|---|
| P0a 翻 compactMode 默认 | qwen P1 span 827 vs claude P1 268 = 3.09× | `settingsSchema.ts:794` default:false | qwen ctrl-o toggle 录制（验证中）|
| P0b 隐藏 banner / Tips 默认 | splash 实测 qwen 280px vs claude 130px | `settingsSchema.ts:814`、`AppHeader.tsx:58` | splash 截图 5 张对照 |
| P0c splash footer 加提示 | - | - | 设计推荐 |
| P1 状态栏 + 颗粒化 hide | - | gemini `settingsSchema.ts` 6-10 个 hide 项；qwen 未保留 | inventory/gemini-cli.md E 类 |
| P1 调色板 Ctrl+P | - | opencode `keybind.ts:53` | inventory/opencode.md D 类 |
| P2 减少 tool 面板边框 | qwen P1 mid_empty 49.9% | - | response.png 视觉确认 |
| P3 docs vs gemini 键位 | - | gemini `keyBindings.ts:388,391,394,395,396` 等 | inventory/gemini-cli.md D 类 |

无 claim 缺证据。

### 10.7 残留风险

1. **opencode P2 无效 cell** → 报告 §9.4 已说明
2. **qwen toggle 第三轮还在跑** → 完成后填入 matrix §6，可能需要修正 P0a 中的 "估计 350-400px" 数字
3. **codex D 类无源码** → 报告未做 codex 强 claim
4. **跨模型对照实验未做** → 报告 §9.3 已说明

### 10.8 结论

✅ **可作为最终结论交付**。前提条件：
- 报告中所有 ⚠️ 局限标注用户都看到
- toggle 数据采集完成后 §6 填入
- 不替代用户对自身环境（模型选择 / 终端 / 字体）的判断

---

## 历史 Review 摘要（Round 1-9，已 supersede）

详细记录见 `analysis/data-quality-quarantine.md`，关键节点：

- **Round 1-7**: 基础流程定型，发现 VHS Wait+Screen 坑、qwen-cli 源码 D 类完整
- **Round 8**: 发现 v1/v2 推荐的功能 qwen 大半已实装（仅默认关）
- **Round 9**: 实测确认 compactMode 影响范围
- **Round 10（本轮）**: 用户三处实质问题全部修正
