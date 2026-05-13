# 标准 Prompt 集（覆盖用户的 7 个对比维度）

每个 prompt 是一个独立 `.md` 文件，**文件正文 = 完整提问文本**（不夹杂别的）。
所有 agent 用**完全相同的文本**，确保横向对比公平。

## 映射到用户需求

| Prompt | 触发维度 |
|---|---|
| [P0-chat.md](./P0-chat.md) | 纯模型输出 / 字体 / 间距 / 边框（同输出内容看屏占比）|
| [P1-tool-single.md](./P1-tool-single.md) | 工具调用渲染 + 模型输出 + thinking 折叠 |
| [P2-tool-long-shell.md](./P2-tool-long-shell.md) | 长 shell 输出截断 + 是否能展开 + 信息有效性 |
| [P3-code-gen.md](./P3-code-gen.md) | 围栏代码块渲染（语言高亮、行号、复制提示）|
| [P4-markdown-stress.md](./P4-markdown-stress.md) | Markdown 综合（h2 / 列表 / 代码块 / 表格）|
| [P5-subagent.md](./P5-subagent.md) | SubAgent 并行调度 + 嵌套结果渲染 |
| [P6-error.md](./P6-error.md) | 错误展示降级 / 恢复路径 |

## 运行规则

1. 默认配置下跑一次（除 opencode 和 gemini 需用 `-m` 切非 thinking model 绕开 agent bug）
2. 紧凑模式开关（Ctrl+O 或对应键）下再跑一次
3. 每次跑完用 `scripts/measure-density.py` 测像素
4. 同 prompt 同 agent 跑 2 次取一致性
