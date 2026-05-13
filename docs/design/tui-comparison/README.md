# TUI Comparison Research v3

横向调研 Claude Code / Codex CLI / Qwen Code / OpenCode 的 TUI 渲染（gemini-cli 因本环境 reasoning_content 路由问题排除）。

> **真正出发点**：qwen-code 当前 TUI 信息密度低、纵向空间利用差、输出冗余多。本调研从竞品里抠出**可借鉴的具体规范**。

> **本版本（v3）**：基于 **28 cell 真 PTY 录制 + 像素测量 + 源码核验**重写。v1/v2 已 DEFECTIVE（保留作历史）。详 `analysis/review.md` 9 轮 self-review + 数据质量隔离 `analysis/data-quality-quarantine.md`。

## 核心定量结论

同 prompt × 同 fixture × 同 VHS 配置（1400×900, FontSize 14）下，4 agent 平均纵向占用：

| Agent | 平均 span | qwen 比 |
|---|---|---|
| claude-code | **363px** | 0.54× |
| codex | 487px | 0.73× |
| **qwen** | 669px | **1.0×** (baseline) |
| opencode | 771px (含侧栏)| - |

各 prompt 极端值：
- P1 single tool: **qwen 827 / claude 268 = 3.09×**
- P0 chat: qwen 497 / claude 220 = 2.26×（即使要求"1 句不用工具"仍外露 9-10 行 meta-reasoning）

## 核心源码发现

**qwen 已经实装了所有需要的密度工具，但默认全关：**

| 能力 | 默认值 | 源码位置 |
|---|---|---|
| `ui.compactMode`（隐藏 tool 输出 + thinking）| **false** | `packages/cli/src/config/settingsSchema.ts:794` |
| `ui.hideBanner` | **false** | `settingsSchema.ts:814` |
| `ui.hideTips` | **false** | （同上）|
| `mergeCompactToolGroups` 工具 N→1 聚合 | 仅 compactMode=true | `packages/cli/src/ui/utils/mergeCompactToolGroups.ts` |
| `ui.shellOutputMaxLines` | 5（已开）| `settingsSchema.ts:803` |

→ **最小改动**：翻 1 个默认值（`compactMode: false → true`）+ splash footer 加 "Ctrl+O 紧凑模式" 提示。

详 [report.md](./report.md) §六。

## 阅读路径

最少看完 = 8 分钟：
1. `README.md`（本文）—— 核心结论 + 数字
2. [`report.md`](./report.md) §六 改进建议（按 ROI 排序）
3. `inventory/qwen/toggle/ctrl-o-compact/{before,after}.png` —— 一图证 compactMode 效果

完整研究路径：
4. [`analysis/matrix.md`](./analysis/matrix.md) —— 28 cell 量化矩阵
5. [`analysis/dimensions.md`](./analysis/dimensions.md) —— 8 个派生维度
6. [`analysis/review.md`](./analysis/review.md) —— 9 轮 self-review 日志
7. `inventory/<agent>.md` × 5 —— 每 agent 的 A/B/C/D/E/F 类完整 inventory
8. `inventory/<agent>/matrix/<P>/response.png` × 28 —— 每 cell 真 PTY 截图

## 目录布局

```
docs/design/tui-comparison/
├── SPEC.md                   # 调研规范（v1 时期）
├── README.md                 # ⭐ 本文件
├── report.md                 # ⭐ 最终建议（v3）
├── prompts/                  # 7 个标准 prompt
│   ├── README.md
│   └── P{0..6}-*.md
├── fixtures/sandbox/         # 标准 fixture
├── inventory/                # Phase 1
│   ├── README.md
│   ├── {qwen, claude-code, codex, gemini-cli, opencode}.md
│   └── <agent>/
│       ├── matrix/<P>/       # ⭐ 28 cell 真 PTY 数据
│       │   ├── session.tape
│       │   ├── session.gif
│       │   ├── session.txt
│       │   └── response.png
│       ├── toggle/<key>/     # 模式切换 before/after
│       │   ├── before.png
│       │   └── after.png
│       └── real-terminal/    # 用户真终端截图（gemini/opencode）
├── analysis/                 # Phase 2
│   ├── matrix.md             # ⭐ v3 矩阵
│   ├── dimensions.md         # ⭐ v3 派生维度
│   ├── review.md             # ⭐ 9 轮 self-review
│   ├── data-quality-quarantine.md
│   └── pixel-sweep-output.md # 像素测量原始数据
├── scripts/
│   ├── measure-density.py    # 像素测量脚本
│   ├── render-matrix.sh      # 28 cell 批量录制
│   ├── render-toggle.sh      # 模式切换 before/after
│   └── pixel-sweep.sh        # 全量像素分析
└── out/_smoke/               # splash 烟囱（5 agent）
```

## qwen vs gemini 同键不同义警示

qwen 是 gemini fork，**改了同键的语义但保留键位**：

| Key | qwen | gemini |
|---|---|---|
| Ctrl+O | 紧凑模式 toggle | 展开内容 SHOW_MORE_LINES |
| Ctrl+T | 工具描述详略 | 完整 TODO 列表 |
| Ctrl+S | 展开更多行 | 鼠标模式 toggle |
| Ctrl+Y | 重试上一条 | YOLO 自动批准 |

如果采纳 P0a（翻 compactMode 默认），docs 应同步加这个对照表。

## 数据可信度声明

✅ **本研究数据基础**：
- 4 agent × 7 prompt = 28 cell 真 PTY 录制（VHS 1400×900）
- 每 cell 含 PNG 截图 + GIF 录像 + TXT 文本快照 + 完整 tape（reproducible）
- 像素级测量（`scripts/measure-density.py`，开源 Python + PIL）
- 4 agent D 类（快捷键）源码核验，每条 file:line
- 用户提供的 2 张真终端截图（gemini/opencode chat）作定性参考

⚠️ **已知未覆盖**：
- gemini-cli 在本环境的 tool-use 失败（reasoning_content 路由 bug；非 CLI 普遍状态）—— 不在像素矩阵中
- 跨模型对照实验（剥离"qwen 啰嗦是模型还是 TUI"贡献比）
- 主题切换 / image paste / 终端 resize / 长会话压缩
- 单次实测，无 P50/P90 统计
- VHS 字体保真 ≠ 真实 iTerm 字体引擎
- opencode P2（长 shell）VHS race 黑屏

⚪ **方法学局限**：
- 字号 / 颜色 / 字距：VHS 内部用 chromium-headless 渲染（不是真实终端 Core Text/FreeType），与真实 iTerm 视觉有微差异。本调研基于 VHS 数据，**用于跨 agent 相对比较公平**（所有 agent 在同一 VHS 环境），但**绝对像素值与你日常 iTerm 看到的不完全一致**

详细数据可信度分类见 `analysis/data-quality-quarantine.md`。

## 不进行 PR（用户指示）

本次是纯研究，**不提 PR**。结果直接讨论后由用户决定改动节奏。
