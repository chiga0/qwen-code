# Agent 驱动 Agent 运行 + 录屏 方法论（可执行 Runbook）

> `SPEC.md` 回答「为什么这样调研」，本文档回答「具体怎么操作」。
> 目标读者：任何想新增一个 TUI agent / 新增一组 prompt / 新增一类模式切换观测 / 重做整个矩阵的人。

---

## 一、整体管线（一图先看）

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
│  环境    │   │  Prompt  │   │  Tape 生成   │   │  VHS 录制    │   │ 度量     │
│  (Sandbox│ ─►│  (固定 md)│ ─►│  (脚本拼接)  │ ─►│  → gif/png/  │ ─►│ measure  │
│   Agent) │   │          │   │              │   │    txt/tape  │   │ -density │
└──────────┘   └──────────┘   └──────────────┘   └──────────────┘   └──────────┘
                                                       │
                                                       ▼
                                             ┌────────────────────┐
                                             │ 产物 inventory/ +  │
                                             │ 跨 cell 汇总报告   │
                                             └────────────────────┘
```

5 个阶段中**只有「VHS 录制」是真正驱动 agent 的物理过程**，其他都是数据准备 / 后处理。所谓「agent 驱动 agent」=
**Claude（驱动方）写出 .tape 文件 → vhs CLI 启动一个 PTY → tape 里的 `Type "..." Enter` 把字符注入 PTY → 被驱动 agent（qwen / claude-code / codex / opencode / gemini）以为是真实键盘输入而响应**。

---

## 二、环境前置（一次性 Bootstrap）

### 2.1 系统与外部工具依赖

| 工具 | 用途 | 安装 / 验证 |
|---|---|---|
| `vhs` ≥ 0.11.0 | 真 PTY 录制 + 截图 + GIF 输出 | `brew install vhs` → `vhs --version` |
| `python3` ≥ 3.10 + `Pillow` + `numpy` | 像素度量 | `pip install pillow numpy` |
| `bash` ≥ 3.2 | 调度脚本（macOS 默认即可） | 已有 |
| 固定字体 | VHS 默认 JetBrains Mono | 无需手动装，VHS 自带 |

### 2.2 被驱动 agent 池

每个 agent 必须 **pin 版本 + 固定 launch 命令 + 固定模型** —— 否则截图差异无法归因。当前 v3 baseline：

| ID | CLI | 版本 | Launch 命令 | 默认模型 |
|---|---|---|---|---|
| qwen | `qwen` | 0.15.10 | `qwen -m qwen3.6-max-preview` | OpenAI-compat |
| claude | `claude` | 2.1.139 | `claude` | Anthropic（无 base-url 选项） |
| codex | `codex` | 0.130.0 | `codex` | gpt-5.x（默认） |
| gemini | `gemini` | 0.41.2 | `gemini -m gemini-2.5-flash` | Google API |
| opencode | `/Users/gawain/.opencode/bin/opencode` | 1.14.48 | `opencode -m idealab/qwen3.6-max-preview` | OpenAI-compat |

> **新增 agent**：在 `scripts/render-matrix.sh` 的 `launch_for()`（行 28-37）+ `splash_for()`（行 48-57）+ `inventory_dir_for()`（行 40-46）各加一行即可。

### 2.3 固定 fixture（被分析的代码沙箱）

`fixtures/sandbox/` 是一个最小 Node 项目，3 文件：`index.js / package.json / README.md`。**所有 prompt 都基于这个 fixture 执行**，确保 4 agent 看到的工作目录一致。

新加 fixture 时复制目录即可，没有外部依赖。

### 2.4 固定 prompt（被注入的提示词）

`prompts/P{0..6}-*.md` —— 每个文件 1 个 prompt（**单行，无换行**）。命名约定：`P<id>-<short-tag>.md`。

为什么是「单行无换行」：tape 里 `Type "..."` 不能跨行。`render-matrix.sh:111` 用 `tr -d '\n' | sed 's/"/\\"/g'` 强行展平 + 转义双引号。

---

## 三、agent 驱动 agent 的核心机制（VHS Tape）

### 3.1 Tape 模板（去除注释后的骨架）

来自 `scripts/render-matrix.sh:118-146`：

```vhs
Output "session.gif"
Output "session.txt"

Set Shell "zsh"
Set FontSize 14
Set Width 1400
Set Height 900
Set Padding 20

Hide
Type "cd $SANDBOX && clear"
Enter
Show

Type "<launch_cmd>"
Enter
Sleep <splash>s

Type "<prompt_text>"
Enter
Sleep <pwait>s
Screenshot "response.png"

Ctrl+C
Sleep 500ms
Ctrl+C
Sleep 1s
```

**字段含义**：

| 字段 | 含义 | 当前值 / 来源 |
|---|---|---|
| `Width × Height` | 终端虚拟分辨率 | 1400×900 全部 cell 一致 |
| `FontSize` | 字号 | 14 |
| `Padding` | 边缘 padding | 20 |
| `Hide / Show` | 隐藏 cd/clear 步骤不入帧 | 必须 |
| `<launch_cmd>` | 启动被驱动 agent 的命令 | `launch_for()` 返回 |
| `<splash>` | 启动后等待 splash 渲染稳定的秒数 | `splash_for()`（6-8s 不等） |
| `<prompt_text>` | 注入的 prompt | `cat prompts/<P>-*.md \| tr -d '\n' \| sed ...` |
| `<pwait>` | 等待 agent 响应完成的秒数 | `wait_for_prompt()`（30-120s） |
| `Screenshot` | **关键**：在 pwait 结束瞬间抓全屏 PNG | response.png |
| `Ctrl+C × 2` | 退出 agent | qwen / opencode 需双击 |

### 3.2 关键变量：`splash` 与 `pwait` 的设定原则

| 场景 | splash 经验值 | pwait 经验值 |
|---|---|---|
| 启动只有 banner 无网络请求 | 5-6s | — |
| 启动需拉模型列表 | 7-8s | — |
| 极简 chat（P0，无工具） | — | 30s |
| 单工具调用（P1） | — | 60-75s |
| 长 shell（P2） | — | 90s |
| 子 agent / 并发（P5） | — | 120s |

**判断方法**：先在某 cell 把 pwait 设大（120s），跑一遍看 GIF 末尾是否 agent 已 idle（光标稳定 ≥ 5s），idle 之后还有空闲时间就缩短 pwait。
**宁可大不可小** —— 截图早一秒就缺末尾内容。

### 3.3 模式切换 tape（before/after 对比）

来自 `scripts/render-toggle.sh:43-75`，区别于普通 cell：

```vhs
# ... 启动 + prompt + pwait 完全相同，到 Screenshot "before.png" ...

Screenshot "before.png"
<key_actions>            # 例：Ctrl+O / Alt+M / Ctrl+X→h
Sleep 2s
Screenshot "after.png"

Ctrl+C × 2
```

**`key_actions` 注入方法**：`render-toggle.sh:31` 用 `||` 在 shell 字符串里分隔多条 VHS 命令，再 `tr '|' '\n'` 还原成多行。例：`"Ctrl+X|Sleep 300ms|Type \"h\""` 会生成 3 行 VHS 命令。

---

## 四、执行命令（一键复现）

> 所有命令**在 `docs/design/tui-comparison/` 目录下**执行。

### 4.1 烟囱：先确认每个 agent 能起、splash 不撞 race

```bash
# 1. 每个 agent 跑 splash 烟囱（不发任何 prompt，只看启动画面）
#    没有现成脚本时手写一份：
for a in qwen claude codex gemini opencode; do
  bash scripts/render-matrix.sh -a "$a" -p P0 --dry-run
done

# 2. 把 dry-run 拿到的 tape 改成「只启动+sleep+screenshot」即得 splash 烟囱
#    现成产物在：out/_smoke/0[1-6]-*-splash.png
```

### 4.2 单 cell 重录（调试用）

```bash
# 只录 qwen × P1
bash scripts/render-matrix.sh -a qwen -p P1

# 录 qwen 与 claude 的 P0/P1（可逗号分隔）
bash scripts/render-matrix.sh -a qwen,claude -p P0,P1
```

### 4.3 全矩阵重录

```bash
# 4 agent × 7 prompt = 28 cell，串行约 30-60min
bash scripts/render-matrix.sh

# 受控并行（每次 3 个 cell，更快但 GPU/CPU 抖动可能影响一致性）
bash scripts/render-matrix.sh --parallel 3
```

### 4.4 模式切换录制

```bash
# 6 个 toggle cell（qwen Ctrl+O / Alt+M、claude Ctrl+O、codex Ctrl+T、opencode leader-h/leader-b）
bash scripts/render-toggle.sh
```

### 4.5 像素度量

```bash
# 单图详细 JSON
python3 scripts/measure-density.py inventory/qwen/matrix/P1/response.png

# 多图 markdown 表格
python3 scripts/measure-density.py --table \
  inventory/qwen/matrix/P1/response.png \
  inventory/claude-code/matrix/P1/response.png

# 跨 cell 汇总（按 prompt 分组 + agent 平均）
bash scripts/pixel-sweep.sh > analysis/pixel-sweep-output.md
```

---

## 五、产物目录约定

### 5.1 矩阵 cell

```
inventory/<agent>/matrix/<P>/
├── session.tape     # 当次实际跑的 tape（重要：有它就能 100% 复现这一格）
├── session.gif      # VHS 出的整段动画
├── session.txt      # 终端最终文本快照
└── response.png     # 在 pwait 结束瞬间抓的全屏（主分析对象）
```

> **禁止收纳 `.mp4`**：`.gitignore` 已加 `*.mp4`，VHS 同时产 mp4 但仓库不收。

### 5.2 模式切换 cell

```
inventory/<agent>/toggle/<toggle-id>/
├── session.tape
├── session.gif
├── session.txt
├── before.png       # toggle 触发前
└── after.png        # toggle 触发后
```

### 5.3 splash 烟囱

```
out/_smoke/0<N>-<agent>-splash.png    # 静态 splash
out/_smoke/0<N>-<agent>-tui.{gif,tape,txt}    # 启动到 idle 的整段
```

`out/` 整体被 `.gitignore`，**仅例外保留 `out/_smoke/`**。

---

## 六、已知坑与处理（必读）

### 6.1 VHS race（黑屏帧）

- **症状**：抓到的 PNG 全黑或几乎全黑。
- **原因**：chromium-headless（VHS 内部）在终端 clear/redraw 瞬间截图。
- **判定**：`measure-density.py` 输出 `pct_text < 0.5` 且 `pct_used < 1`。
- **处理**：
  - 重跑该 cell 1-2 次，多数是偶发
  - 如重跑仍黑屏 → 标 quarantine（`analysis/data-quality-quarantine.md` 加一条）
  - 不要把黑屏帧提交进仓库

### 6.2 模型选择漂移

- **症状**：同 agent 同 prompt 两次跑，响应风格 / 长度大不同。
- **原因**：qwen 的 auto 模型挑选会在多个模型间切（pai/glm-5.1 / DeepSeek 等），慢模型可能让 pwait 不够。
- **处理**：launch 命令**必须 pin 模型**（`qwen -m qwen3.6-max-preview` 不要用裸 `qwen`）。

### 6.3 长 prompt 注入失败

- **症状**：tape Type 行被截断或乱码。
- **原因**：tape 里 `Type "..."` 字符串内含未转义的双引号，或包含换行。
- **处理**：prompts/*.md **强制单行**；脚本里 `tr -d '\n' | sed 's/"/\\"/g'` 必须保留。

### 6.4 退出残留进程

- **症状**：连续录制 N cell 后系统变慢，`ps aux | grep <agent>` 看到大量僵尸。
- **原因**：Ctrl+C 单击对 qwen / opencode 不够，需双击；codex 偶尔需 Ctrl+D。
- **处理**：tape 末尾固定 `Ctrl+C × 2 + Sleep 1s`。仍残留时手动 `pkill -f`。

### 6.5 模式切换 tape 不可信

- **症状**：toggle 的 before / after 完全相同，或 after 全黑。
- **原因**：VHS 不擅长捕「按键瞬间的重绘」，时序窗口窄。
- **处理**：v3 的结论是「VHS 不适合捕模式切换」（详 `analysis/matrix.md §6`），要严测请用真终端 + 手工切换 + 截图。VHS 适合捕**稳定状态**，不适合**变化瞬间**。

### 6.6 splash 时长不一致

- **症状**：splash 还没渲染完就 Type prompt，被 agent 当成 reject。
- **原因**：splash 含网络请求（拉模型列表、check update）的 agent 启动慢。
- **处理**：`splash_for()` 表里给到 7-8s，遇到「prompt 没被吃」就再加 2s。

---

## 七、新增工件的 onboarding checklist

### 7.1 新增一个 agent

| # | 动作 | 验证 |
|---|---|---|
| 1 | 全局安装该 agent + 在隔离环境配同模型 | `<cli> --version` |
| 2 | `scripts/render-matrix.sh` 加 launch_for / splash_for / inventory_dir_for 三处 | 跑 `--dry-run -a <new-agent> -p P0` 看 tape 生成 |
| 3 | 烟囱：跑 `-a <new-agent> -p P0` 单 cell | `inventory/<dir>/matrix/P0/response.png` 非黑屏 |
| 4 | 写 `inventory/<agent>.md`（A-F 6 类） | 每条特性挂源码 file:line 或截图 |
| 5 | 跑全 7 prompt 单 agent 矩阵 | 7 cell 全可信 |
| 6 | 更新 `analysis/matrix.md` 增加该 agent 列 | git diff |
| 7 | 在 `report.md` 增加该 agent 对照行 | 引用其 PNG 路径 |

### 7.2 新增一个 prompt

| # | 动作 | 验证 |
|---|---|---|
| 1 | 写 `prompts/P<N>-<tag>.md`，**单行**，**英文 + 限句数** | `wc -l prompts/P<N>-*.md` 应为 1 |
| 2 | 在 `scripts/render-matrix.sh:25` `ALL_PROMPTS` 加 `P<N>` | — |
| 3 | 在 `wait_for_prompt()` 加该 P 的 pwait | 估算原则见 §3.2 |
| 4 | 跑全 4 agent × 该 prompt | 4 cell 全可信 |
| 5 | 在 `scripts/pixel-sweep.sh:11` `PROMPTS` 加 `P<N>` | 跑 `pixel-sweep.sh` 看汇总表新增一节 |
| 6 | `analysis/matrix.md §3` 加一节 P<N> 横向对比 | git diff |

### 7.3 新增一个模式切换观测

| # | 动作 | 验证 |
|---|---|---|
| 1 | 在 `inventory/<agent>.md` D 类记录该键 + 源码 file:line | — |
| 2 | 在 `scripts/render-toggle.sh` 末尾加一条 `run_toggle <agent> <id> <launch> <splash> <pwait> <key>` | — |
| 3 | 跑 `bash scripts/render-toggle.sh` | `inventory/<agent>/toggle/<id>/{before,after}.png` 非黑屏 |
| 4 | 若 VHS 抓不稳 → 标 quarantine + 用真终端补 | — |

---

## 八、数据质量门（commit 前自查）

每次提交前过一遍 `analysis/data-quality-quarantine.md` 的 **D1-D5 模板**：

- D1：跨 agent 模型不一致 → 全部标记 model lane
- D2：VHS race 黑屏 → 删图 + quarantine 记录
- D3：未做像素度量 → 跑 `pixel-sweep.sh`
- D4：未声明的环境差异 → 在 `report.md §九` 列出
- D5：未跑烟囱直接全矩阵 → 先跑 `-a X -p P0` 单 cell 验证 launch_for

任何一项不通过都不许 commit。

---

## 九、扩展接口（往哪里加代码）

| 想做的事 | 改哪里 |
|---|---|
| 加新 agent | `scripts/render-matrix.sh:28-57` 三个函数 + `scripts/pixel-sweep.sh:10` AGENTS |
| 加新 prompt | `prompts/P<N>-*.md` + `scripts/render-matrix.sh:25,60-71` + `scripts/pixel-sweep.sh:11` |
| 加新度量指标 | `scripts/measure-density.py:96-115` 的 return dict 加字段 + `:118-142` print_table 加列 |
| 加新模式切换 | `scripts/render-toggle.sh` 末尾加一行 `run_toggle` |
| 改 VHS 渲染参数 | `scripts/render-matrix.sh:122-126` Width/Height/FontSize/Padding（**改了之前的所有 PNG 都失效**，要慎重） |
| 加多 turn 录制 | 新写 `scripts/render-scenarios.sh`，复用 §3.1 模板，循环多个 Type+Sleep+Screenshot 段 |

---

## 十、一键完整复现命令

```bash
cd docs/design/tui-comparison

# 1) 验证依赖
vhs --version && python3 -c "import PIL, numpy" && echo "deps OK"

# 2) 烟囱（5-10min）
bash scripts/render-matrix.sh -p P0      # 4 agent × 1 prompt 烟囱

# 3) 全矩阵（30-60min）
bash scripts/render-matrix.sh

# 4) 模式切换（10-20min，VHS race 失败率高）
bash scripts/render-toggle.sh

# 5) 度量
bash scripts/pixel-sweep.sh > analysis/pixel-sweep-output.md

# 6) 报告 —— 人工编辑 report.md，引用上面产出的 PNG / 数据表
```

---

## 十一、验证（done definition）

1. **可复现性**：在干净 macOS 上 `git clone` + 跑「§十 一键」步骤，能在 1.5 小时内拿到 28 cell + 6 toggle + pixel-sweep-output.md，**且与已存在的 PNG 视觉上一致**（允许 ±1 帧像素差）
2. **可扩展性**：新加一个 agent 走 `§7.1`、新加一个 prompt 走 `§7.2`，**只改本文档列出的文件**就能跑通
3. **可发现性**：`SPEC.md` 入口 → 本 Runbook 链接 → §一 管线图 → 任一阶段 5min 内能定位到对应脚本和文件
4. **可审计性**：每个 cell 的 `session.tape` 可单独 `vhs <tape>` 重放，且产物文件 byte-equal（VHS 渲染本身确定性 ≥ 99%）

---

## 十二、本文档与现有文件的关系

| 现有文件 | 关系 |
|---|---|
| `SPEC.md` | 调研规范：整体三阶段流程（Inventory → Synthesis → Recording）+ 不在范围。本 Runbook 是它的执行细节补充 |
| `scripts/render-matrix.sh` | 矩阵录制实现 |
| `scripts/render-toggle.sh` | 模式切换录制实现 |
| `scripts/measure-density.py` | 单图度量 |
| `scripts/pixel-sweep.sh` | 跨 cell 汇总 |
| `prompts/P*.md` | 已有 7 个，新增见 §7.2 |
| `inventory/<agent>.md` | A-F 6 类清单，新增 agent 见 §7.1 |
| `analysis/{matrix,dimensions,review,data-quality-quarantine,pixel-sweep-output}.md` | 综合 / 派生 / 度量 / 隔离 / 数据：本 Runbook 跑出来的产物喂入 |
| `report.md` | 最终图文报告，本 Runbook 提供素材，不规定 report 写法 |
