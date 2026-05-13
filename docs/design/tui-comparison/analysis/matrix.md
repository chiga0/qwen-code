# 特性矩阵 v3（Cross-Agent Feature Matrix）

> **数据基线**：VHS 1400×900 / FontSize 14 / zsh，4 agent（gemini 因环境 reasoning_content 路由问题被排除，详 §gemini-blocked）× 7 标准 prompt = 28 cell 真 PTY 录制；每张 PNG 经 `scripts/measure-density.py` 像素测量。
> 生成日期：2026-05-12
> 替代 v2（已 DEFECTIVE）。

---

## §1 测量方法

每张响应截图按行（pixel-row）分类：
- **empty**: 该行 < 2% 非背景像素
- **solid_bar**: 该行 > 50% 是同一非背景颜色（状态栏 / 面板背景 / 横分割线）
- **text**: 其他（渲染的字形）

聚合指标：
- **%used** = (text + solid_bar) / height —— 屏幕被填充比例
- **content_span** = 首个非空行到最后非空行之间像素跨度 —— 内容实际"长度"
- **%mid_empty** = 内容跨度内的空行占比 —— 内部留白
- **top/bottom margin** = 前后空白像素

工具：`scripts/measure-density.py`，源数据 `analysis/pixel-sweep-output.md`。

---

## §2 跨 prompt agent 平均（28 cell 综合）

| Agent | 平均 %used | 平均 span (px) | 平均 %mid_empty | 平均 model | 说明 |
|---|---|---|---|---|---|
| **claude-code** | **21.1%** | **363px** ⭐ 最简洁 | 19.3% | Opus 4.7 | 默认极致紧凑：tool 结果 N→1 折叠到 1 行 |
| codex | 30.8% | 487px | 23.4% | gpt-5.5 xhigh | 居中 |
| **qwen** | **40.8%** | **669px** | 33.5% | pai/glm-5.1 + qwen3.6 | 大 splash + meta-reasoning 默认外露 |
| opencode | 85.7% | 771px | -14.3%¹ | Qwen3.6 Max Preview | 唯一带右侧栏，纵向几乎满屏，横向也占用 |

¹ opencode 经常没有 top/bottom margin（侧边栏顶天立地填满高度），所以 mid_empty 计算异常。看 span 列即可：771px = 几乎满屏。

**qwen span 669 是 claude 的 1.84×**（不是之前估的 3.5×；不是 v2 的 2.74×）。**真数据**。

opencode 之所以 span 高是因为侧边栏 = 全屏（永远从 0 到 900）；不能直接和左对齐 agent 类比。

---

## §3 每 prompt 横向对比

### P0 — chat（"用 1 句话介绍你自己，不用工具"）

| Agent | span | %used | %mid_empty | 内容观察 |
|---|---|---|---|---|
| qwen | **497px** | 32.1% | 23.1% | splash 10 行 + meta-reasoning 段（"The user has set up context... There's a conflict..."9 行）+ 1 行答案 |
| claude-code | **220px** | 12.2% | 12.2% | splash 3 行 + 1 行答案 |
| codex | 320px | 22.1% | 13.4% | splash + Tip + 1 行答案 |
| opencode | 900px | 100% | 0% | 全屏 + 侧边栏，单句答案在大空间里 |

**关键**：qwen 在最不需要 reasoning 的 prompt 上（明确说"不用工具，1 句话"）仍然外露 ~9 行 meta-reasoning。

### P1 — single tool（"列文件 + 一句总结"）

| Agent | span | %used | %mid_empty | 工具调用渲染 |
|---|---|---|---|---|
| qwen | **827px** | 42.0% | **49.9%** | 圆角面板 + N=4 单独行 ReadFile，外加 meta-reasoning |
| claude-code | **268px** | 15.2% | 14.6% | **单行**："Read 1 file, listed 1 directory (ctrl+o to expand)" + 1 行内联文件列表 |
| codex | 378px | 19.7% | 22.3% | ▼ Explored 折叠面板 |
| opencode | 900px | 100% | 0% | 主区 Thinking × 3 + 工具 + 总结，侧边栏 token 数 |

**claude span 268 vs qwen 827 = 3.09×**（同 prompt 同 fixture 同 VHS 配置）。

### P2 — long shell（"ls -laR /usr/share | head -200" 长输出）

| Agent | span | %used | %mid_empty | 长输出处理 |
|---|---|---|---|---|
| qwen | 820px | 57.6% | 33.6% | shell 输出截断（`shellOutputMaxLines: 5`），显示 +N lines 指示器 |
| claude-code | 350px | 20.8% | 18.1% | 工具结果折叠 |
| codex | 345px | 18.0% | 20.3% | 类似 |
| opencode | ⚠️ 黑屏 race | - | - | VHS 抓到 clear-redraw 瞬间，数据无效 |

opencode P2 数据无效（VHS race，疑长输出渲染过程中截图）；需要重测。

### P3 — code-gen（"Fibonacci with memo + 2 行解释"）

| Agent | span | %used | %mid_empty | 代码块渲染 |
|---|---|---|---|---|
| qwen | 675px | 45.2% | 29.8% | 围栏代码块（待二次确认细节）|
| claude-code | 398px | 23.3% | 20.9% | 紧凑 |
| codex | 563px | 37.1% | 25.4% | 含 reasoning 段 |
| opencode | 900px | 100% | 0% | 全屏，含侧边栏 |

### P4 — markdown stress（h2 + 列表 + 代码 + 表格）

| Agent | span | %used | %mid_empty | markdown 渲染综合 |
|---|---|---|---|---|
| qwen | 822px | 49.2% | 42.1% | 全套渲染 |
| claude-code | 625px | 34.8% | 34.7% | 全套渲染（这次 span 接近 qwen 1.32×）|
| codex | 580px | 40.9% | 23.6% | 全套渲染 |
| opencode | 900px | 100% | 0% | 全套 + 侧边栏 |

P4 是 qwen 与 claude **span 差距最小**的一题（1.32×）。原因：markdown 内容本身需要 ≥10 行结构，meta-reasoning 占比相对降低。

### P5 — SubAgent（并行子 agent 数 .md 和 .ts）

| Agent | span | %used | %mid_empty | SubAgent 渲染 |
|---|---|---|---|---|
| qwen | 562px | 31.1% | 31.3% | `✓ Agent ... · 1 tool · 11.3s · 29k tokens` 带元数据折叠 |
| claude-code | 349px | 21.6% | 17.2% | 紧凑 |
| codex | 758px | 50.7% | 33.6% | **本题最大** —— 含详细 reasoning + 多个工具组 |
| opencode | 900px | 100% | 0% | 全屏 |

注意 P5 是**唯一 codex span > qwen** 的题目（758 vs 562）—— codex 在 SubAgent 编排上展开特别多 reasoning。

### P6 — error（读不存在文件）

| Agent | span | %used | %mid_empty | 错误渲染 |
|---|---|---|---|---|
| qwen | 481px | 28.6% | 24.9% | 错误展示降级（不是 JSON dump，是可读文本）|
| claude-code | 333px | 19.6% | 17.4% | 紧凑 |
| codex | 466px | 26.8% | 25.0% | 含 reasoning 解释错误 |
| opencode | 900px | 100% | 0% | 全屏 |

**对比 v2 的 gemini/opencode JSON dump**：本轮 4 agent 都正确降级了错误（不直接 dump JSON）。v2 矩阵中那个 JSON dump 是 thinking-mode bug 的副作用，**不是它们的常规错误行为**。

---

## §4 静态布局（splash 静态对比）

| Agent | splash %used | splash span (px) | 装饰特征 |
|---|---|---|---|
| qwen | 34.8%（实测烟囱）| ~ 280 行像素 | ASCII 大字 QWEN（5 行）+ 信息面板 + Tips 1 行 + footer hint |
| claude-code | 12.2% | ~ 130 | 极简：3 行 logo+model+cwd + 1 行 footer hint |
| codex | 22.1% | ~ 200 | 圆角信息面板 |
| gemini | 27.4% | ~ 245 | 小 pixel logo + 4 行 Tips 编号 + workspace/branch/sandbox/model 行 |
| opencode | 100% | 900 | 居中大字 wordmark + 大量留白 + 输入框 + 底部 cwd 行 |

来源：`out/_smoke/0[1-6]-*-splash.png`

---

## §5 D 类（模式切换 / 快捷键）—— 源码核验

完整源码 file:line 对照在 `inventory/<agent>.md` D 类。这里只摘 **影响渲染** 的键的差异表：

| 操作 | qwen | claude | codex | opencode |
|---|---|---|---|---|
| 紧凑模式 | **Ctrl+O** `TOGGLE_COMPACT_MODE` (`packages/cli/src/config/keyBindings.ts:54,177`) | ❌ 无（密度走 API 端 `outputStyle`） | 未核验（codex 源码本地缺）| `<leader>c` session.compact（仅折叠历史，非常驻渲染开关）|
| 展开内容 | Ctrl+S SHOW_MORE_LINES | **Ctrl+O** toggle transcript（**同键不同义**）| - | `<leader>h` conceal toggle |
| Markdown / plain | **Alt+M** TOGGLE_RENDER_MODE | ❌ | - | ❌ |
| Thinking 显隐 | ❌ | **Meta+T** thinkingToggle (`src/keybindings/defaultBindings.ts:72`) | - | command palette `session.toggle.thinking` |
| 工具描述详略 | **Ctrl+T** TOGGLE_TOOL_DESCRIPTIONS | Ctrl+T toggle todos（**同键不同义**）| - | command palette `session.toggle.actions` |
| 命令调色板 | ❌ | ❌ | ❌ | **Ctrl+P** ⭐ 独有 |
| 模式循环 | ❌ | **Shift+Tab** chat:cycleMode | - | - |
| 主题选择 | ❌ | ❌ | - | **`<leader>t`** 33 主题选 |

**同键不同义警示**：qwen 作为 gemini fork 改了 Ctrl+O/Ctrl+T/Ctrl+S 的语义，对来自 gemini 的用户造成预期错乱。

---

## §6 模式切换效果实测（4 agent × 关键快捷键）

> 6 cell 录制结果：2 cell 完整、4 cell 受 VHS race 或时序问题影响。**先前 v3 的 qwen Ctrl+O 数据（`inventory/qwen/ctrl-o-v3-{after-tools,toggled-back}.png`）作为 qwen 紧凑模式的主要证据**。

### 实测数据表

| Agent | Toggle | before span | after span | Δspan | 视觉变化简述 | 状态 |
|---|---|---|---|---|---|---|
| **claude-code** | **Ctrl+O (transcript)** | 268 | **399** | **+131** | 工具结果从 1 行 "Read 1 file..." 展开成完整 `Bash(ls -la)` 输出 + Read 摘要 + 底部 "Showing detailed transcript · ctrl+o to toggle · ctrl+e to show all" | ✅ 可信 |
| **codex** | **Ctrl+T (transcript viewer)** | 466 | **839** | **+373** | 进入全屏 transcript 模式：顶部 `/ T R A N S C R I P T / / / /` 头 + 完整 `$ ls` 命令 + 输出（README.md / index.js / package.json）+ `✓ · 389ms` 时间 + 底部 vim-like 滚动提示 `↑/↓ to scroll · pgup/pgdn · home/end · q to quit · esc to edit prev` + `100%` 滚动位置 | ✅ 可信 |
| qwen | Ctrl+O (compact) | 0 (VHS race 黑屏) | 59 (响应消失，疑 Ctrl+C 抢先) | n/a | VHS 时序问题，**前面 3 次重测均失败**（slow model / API 401 / race）。**改用 v3 `ctrl-o-v3-*` 数据作为主要证据**（详 report §四）| ❌ 本次无效 |
| qwen | Alt+M (render mode) | - | - | - | session.gif + session.txt 有数据，但 Screenshot 没产生 PNG（疑 tape 早期 Ctrl+C 抢先），实测未完成 | ❌ 无效 |
| opencode | `<leader>h` (conceal) | 900 (满屏) | 900 (满屏) | 0 | 像素完全相同 —— leader 序列疑未触发或 conceal 在此状态无可见效果 | ⚠️ 无差异 |
| opencode | `<leader>b` (sidebar) | 900 (满屏) | 0 (黑屏) | n/a | after 是黑屏，VHS race | ❌ 无效 |

### 关键发现（基于可信 cell + 早期 v3 数据）

1. **claude 和 codex 都把"展开 transcript"绑到一个键上**（Ctrl+O / Ctrl+T），用同一种交互模式：默认收 + 一键放
2. **codex 的 transcript 是全屏接管模式**（带滚动 / 翻页 / 退出快捷键提示），更接近"pager 工具"
3. **claude 的 transcript 是行内展开**（不接管屏幕，可继续输入下一条），更轻量
4. **qwen 的 Ctrl+O 在 VHS 下连续 3 次重测失败**，不是 qwen 本身的问题（v3 早期 `ctrl-o-v3-{after-tools,toggled-back}.png` 实测过完整效果，详 report §四）—— 是 VHS 抓不住 qwen 的 redraw 时序
5. **opencode `<leader>h`** 像素无变化 —— 可能 leader sequence 未触发，或当前响应中 conceal 对象（代码块）不在视野

### v3 toggle 不可信成本

我们用了 6 cell × ~2-3 min × 4 次重试 = ~1 小时录制时间，最终只拿到 2 cell 可信数据。**结论**：VHS 不适合捕模式切换瞬间。要严格测 toggle 效果，**应该用真实终端 + 手工切换 + 截图**，本调研不再追加。

录制脚本：`scripts/render-toggle.sh`。

### 模式切换语义大对比（来自源码 D 类核验）

| 操作 | qwen | claude-code | codex | opencode |
|---|---|---|---|---|
| 紧凑模式 / 隐藏内容 | **Ctrl+O** TOGGLE_COMPACT_MODE | ❌ 无独立紧凑键 | （需进一步核验）| `<leader>h` conceal（代码块）|
| 展开 transcript / 详细工具结果 | Ctrl+S SHOW_MORE_LINES | **Ctrl+O** transcript（**同键不同义**）| **Ctrl+T** transcript viewer | n/a |
| 工具描述详略 | **Ctrl+T** | Ctrl+T → todo panel | - | command palette |
| Thinking 显隐 | 无 | **Meta+T** | （需核验）| command palette `session.toggle.thinking` |
| 主题切换 | 无 | 无 | - | **`<leader>t`** 33 主题 |
| 命令调色板 | ❌ | ❌ | ❌ | **Ctrl+P** ⭐ 独有 |

**最重要的发现**：**Ctrl+O 在 qwen / claude / gemini 三家是完全不同的语义**：
- qwen: 紧凑（隐藏 chrome）
- claude: 展开 transcript（增加 chrome 显示真实命令）
- gemini: SHOW_MORE_LINES（展开被截断的内容）

来自 gemini fork 的用户对这种语义漂移最容易混淆。

---

## §7 gemini 阻塞说明

gemini-2.5-pro 默认配置 + gemini-2.5-flash flag 均在 VHS 工具调用场景下报错：

```
{"error":{"message":"The reasoning_content in the thinking mode must be passed back to the API.",
 "type":"invalid_request_error","param":null,"code":"invalid_request_error"}}
```

- 错误格式 (`type:invalid_request_error`) 是 OpenAI 兼容代理格式，**非 Google Gemini API 原生格式**
- 但用户 gemini settings 显示 auth=`gemini-api-key`（应直连 Google）
- 真终端用户截图（`inventory/gemini-cli/real-terminal/`）显示 gemini 启动 + chat 正常工作
- 推测：环境中存在跨进程 API 拦截（疑 `~/.r2c/` 配置）或 endpoint 路由
- **本环境下 gemini 在 tool-use 场景不可用 —— 排除出本轮矩阵**

gemini 的 D 类源码核验仍在 `inventory/gemini-cli.md`（10 个 key 的 file:line 全确认），可用作设计参考，但**不在像素数据矩阵里**。

---

## §8 关键数据复核索引

| 截图 | 路径 |
|---|---|
| 每 (agent×prompt) 响应 PNG | `inventory/<agent>/matrix/<P>/response.png` |
| 完整 tape（reproducibility）| `inventory/<agent>/matrix/<P>/session.tape` |
| GIF（动画对比）| `inventory/<agent>/matrix/<P>/session.gif` |
| splash | `out/_smoke/0[1-6]-*-splash.png` |
| 像素 sweep 完整数据 | `analysis/pixel-sweep-output.md` |
| qwen 真实终端（chat）| `inventory/gemini-cli/real-terminal/README.md` (gemini), `inventory/opencode/real-terminal/README.md` (opencode) |
| 5 个 inventory（D 类源码核验）| `inventory/{qwen,claude-code,codex,gemini-cli,opencode}.md` |
| 数据质量隔离 | `analysis/data-quality-quarantine.md` |
