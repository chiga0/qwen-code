# 数据质量隔离清单（DEFECTIVE 数据归档）

记录哪些数据 / 结论已知不可信，**禁止用作决策依据**。

新数据进 v3 命名空间（`v3-*.md`、`real-pty-*.png`）。

---

## D1. gemini / opencode VHS 实测响应失败

**症状**: 同 prompt（"List the files..."）：
- 真实 iTerm: ✅ gemini 启动 thinking spinner（用户截图 `inventory/gemini-cli/real-terminal/chat-thinking-7s.png` 即将存入），opencode 显示 `Thinking: ...` 斜体灰段（用户截图 `inventory/opencode/real-terminal/chat-thinking-italic.png`）
- VHS 录制: ❌ 两家均返回 `{"error":{"message":"The reasoning_content in the thinking mode must be passed back to the API"}}`

**根因诊断（运行中，task #13）**:
- 假设 A: VHS 环境差异（TERM / 字符宽度 / chromium-headless 行为）
- 假设 B: VHS 命令时序使 agent 内部多轮 API 调用错位
- 假设 C: prompt 触发了 tool-use 多轮，VHS 在某步 race
- 实验：同 prompt 改成纯 chat（"你是谁?"，无工具）在 VHS 重跑，对比真终端结果

**受影响的产物**（v1/v2 内全部废弃）:
- `inventory/gemini-cli/files-prompt-response.png`
- `inventory/gemini-cli/files-prompt.{gif,txt}`
- `inventory/opencode/files-prompt-response.png`
- `inventory/opencode/files-prompt.{gif,txt}`
- `analysis/matrix.md` 中 gemini / opencode 的所有行
- `analysis/dimensions.md` 中含 gemini / opencode 数据的派生
- `report.md` 第二节"~25 vs ~7"对比里的非 qwen/claude/codex 行

---

## D2. qwen Ctrl+O 实测的 race + 不严谨对比

**症状**: VHS Ctrl+O 切换瞬间常捕到全黑屏（疑 chromium 抓到 clear-redraw 之间）。
- v2 用 "Reply hello"（无工具），切换前后**视觉差仅顶部 padding 2 行**——观察弱
- v3 用 "List files..."（有工具），before-tools 也是黑屏，**用 toggled-back（按 Ctrl+O × 2）替代 default 状态做对照** —— **不是真正的 default vs ON 对比**，是"按了两次"vs"按了一次"

**严格说**: v3 的 toggled-back vs after-tools 对比能说明"Ctrl+O 一次确实改变了渲染"，**不能直接说明"默认状态 vs Ctrl+O ON"的差异**（默认是没按过 Ctrl+O，与"按两次后又回到默认状态"不一定 100% 等价；compactToggleHasVisualEffect 的实现可能不是纯幂等）

**受影响的产物**:
- ~~`inventory/qwen/ctrl-o-v2-{before,after,toggled-back}.png`~~ — 已删除（v2 实验作废，被 v3 取代）
- ~~`inventory/qwen/ctrl-o-v3-before-tools.png`~~ — 已删除（黑屏 race 失效帧）
- `inventory/qwen/ctrl-o-v3-{after-tools,toggled-back}.png` — 标 ⚠️（数据有效但对照含义需澄清，详 §D2 正文）

---

## D3. 完全没做像素 / 字号 / 边框 / 间距 测量

**症状**: 所有"行数"全是肉眼数 PNG 截图，没有：
- 像素级 chrome / content / whitespace 占比
- 边框宽度 / 圆角半径
- 字号 / 行高（VHS 内部用 chromium 渲染，与真终端 iTerm 字号也不一致）
- 块大小测量

**受影响**: 所有定量比较（"~25 vs ~7"等）都只有 ±数行精度。

**修复**: task #17 写像素测量脚本，对所有 PNG 重做。

---

## D4. VHS 字体保真度的根本局限

**症状**: VHS 内部用 ttyd + chromium-headless + 嵌入 web 字体渲染，**不是真实终端的字体引擎**。
真实 iTerm / Ghostty / Alacritty 用 Core Text / FreeType，会有：
- 字距不同
- 行高不同
- 渲染引擎差异（subpixel / hinting）

**受影响**: 任何"真实终端用户体验"的视觉判断不能完全靠 VHS 截图。

**修复**: 必要时叠加用户在真实 iTerm 截图作为对照。已收到两张（gemini/opencode chat 模式）。

---

## D5. codex 源码 0 引用

**症状**: `inventory/codex.md` D 类全是 splash 观察，0 个 file:line 引用（user 提供的源码池中无 codex）。

**修复**: 如果调研要对称，需 clone openai/codex 或在线分析。

---

## D6. 范围未覆盖的渲染场景

**未实测**: markdown headings / 围栏代码 + 语言高亮 / 表格 / diff / 长输出截断 / 错误降级 / SubAgent for non-qwen / 主题切换 / 输入框补全 / @ 文件引用 / 多行编辑 / resize 响应。

**修复**: task #18 设计 6 类 prompt 覆盖。

---

## 总结

| 数据类 | v1/v2 状态 | v3 修复方式 |
|---|---|---|
| 5 家 splash 截图（静态）| ✅ 可信 | 保留 |
| qwen / claude / codex files-prompt 实测 | ✅ 可信（响应完整）| 保留 |
| **gemini / opencode files-prompt** | ❌ VHS artifact | 用 tmux 捕真 PTY 重跑 |
| qwen Ctrl+O before/after | ⚠️ 对照含义不严 | tmux + 严格 default vs ON |
| D 类源码核验（4/5） | ✅ 可信 | 保留 |
| D 类 codex | ❌ 0 引用 | 视优先级决定补 |
| 像素 / 字号 / 边框 / 间距 | ❌ 完全缺失 | 写脚本测量 |
| 多场景渲染（code/shell/diff/markdown）| ❌ 完全缺失 | 设计 6 类 prompt 跑 |
