# 像素测量结果（所有 cell）

生成时间：2026-05-12 15:22:55

测量脚本：`scripts/measure-density.py`
字段说明：text% = 文本行占比；bar% = 实色 chrome 行占比；used% = text+bar；mid_empty% = 内容之间留白；span = 首行到末行像素跨度。

## P0-chat

Prompt: `Reply in English with exactly one sentence introducing yourself. Do not use any tools.`

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 25 | 281 | 8 | 208 | 378 | 497 | 31.2 | 0.9 | 32.1 | 23.1 |
| response.png | 900 | 25 | 89 | 21 | 110 | 655 | 220 | 9.9 | 2.3 | 12.2 | 12.2 |
| response.png | 900 | 25 | 100 | 99 | 121 | 555 | 320 | 11.1 | 11.0 | 22.1 | 13.4 |
| response.png | 900 | 0 | 737 | 163 | 0 | 0 | 900 | 81.9 | 18.1 | 100.0 | 0.0 |

## P1-tool-single

Prompt: `List the files in this directory using a tool, then summarize this project in one short sentence.`

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 20 | 359 | 19 | 449 | 53 | 827 | 39.9 | 2.1 | 42.0 | 49.9 |
| response.png | 900 | 25 | 116 | 21 | 131 | 607 | 268 | 12.9 | 2.3 | 15.2 | 14.6 |
| response.png | 900 | 25 | 124 | 53 | 201 | 497 | 378 | 13.8 | 5.9 | 19.7 | 22.3 |
| response.png | 900 | 0 | 738 | 162 | 0 | 0 | 900 | 82.0 | 18.0 | 100.0 | 0.0 |

## P2-tool-long-shell

Prompt: `Run `ls -laR /usr/share | head -200` using a shell tool, then in one sentence tell me roughly how ma`

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 26 | 501 | 17 | 302 | 54 | 820 | 55.7 | 1.9 | 57.6 | 33.6 |
| response.png | 900 | 25 | 174 | 13 | 163 | 525 | 350 | 19.3 | 1.4 | 20.8 | 18.1 |
| response.png | 900 | 25 | 119 | 43 | 183 | 530 | 345 | 13.2 | 4.8 | 18.0 | 20.3 |
| response.png | 900 | 900 | 0 | 0 | -900 | 900 | 0 | 0.0 | 0.0 | 0.0 | -100.0 |

## P3-code-gen

Prompt: `Write a Python function that computes the nth Fibonacci number using memoization. Include exactly 2 `

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 25 | 397 | 10 | 268 | 200 | 675 | 44.1 | 1.1 | 45.2 | 29.8 |
| response.png | 900 | 25 | 182 | 28 | 188 | 477 | 398 | 20.2 | 3.1 | 23.3 | 20.9 |
| response.png | 900 | 25 | 230 | 104 | 229 | 312 | 563 | 25.6 | 11.6 | 37.1 | 25.4 |
| response.png | 900 | 0 | 728 | 172 | 0 | 0 | 900 | 80.9 | 19.1 | 100.0 | 0.0 |

## P4-markdown-stress

Prompt: `Write a brief markdown tutorial about the JavaScript event loop. Use one ## heading, one ordered lis`

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 24 | 421 | 22 | 379 | 54 | 822 | 46.8 | 2.4 | 49.2 | 42.1 |
| response.png | 900 | 25 | 285 | 28 | 312 | 250 | 625 | 31.7 | 3.1 | 34.8 | 34.7 |
| response.png | 900 | 25 | 264 | 104 | 212 | 295 | 580 | 29.3 | 11.6 | 40.9 | 23.6 |
| response.png | 900 | 0 | 708 | 192 | 0 | 0 | 900 | 78.7 | 21.3 | 100.0 | 0.0 |

## P5-subagent

Prompt: `Use parallel sub-agents to separately count how many .md files and how many .ts files exist in this `

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 25 | 263 | 17 | 282 | 313 | 562 | 29.2 | 1.9 | 31.1 | 31.3 |
| response.png | 900 | 25 | 166 | 28 | 155 | 526 | 349 | 18.4 | 3.1 | 21.6 | 17.2 |
| response.png | 900 | 25 | 351 | 105 | 302 | 117 | 758 | 39.0 | 11.7 | 50.7 | 33.6 |
| response.png | 900 | 0 | 722 | 178 | 0 | 0 | 900 | 80.2 | 19.8 | 100.0 | 0.0 |

## P6-error

Prompt: `Try to read the file at /tmp/file-that-does-not-exist-xyz-12345.txt using a tool, then explain what `

| file | h | top | text | bar | mid_empty | bot | span | %text | %bar | %used | %mid_empty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| response.png | 900 | 25 | 252 | 5 | 224 | 394 | 481 | 28.0 | 0.6 | 28.6 | 24.9 |
| response.png | 900 | 25 | 163 | 13 | 157 | 542 | 333 | 18.1 | 1.4 | 19.6 | 17.4 |
| response.png | 900 | 25 | 148 | 93 | 225 | 409 | 466 | 16.4 | 10.3 | 26.8 | 25.0 |
| response.png | 900 | 0 | 618 | 282 | 0 | 0 | 900 | 68.7 | 31.3 | 100.0 | 0.0 |

## 跨 prompt agent 平均

| Agent | 平均 %used | 平均 span | 平均 %mid_empty |
|---|---|---|---|
| qwen | 40.8% | 669px | 33.5% |
| claude-code | 21.1% | 363px | 19.3% |
| codex | 30.8% | 487px | 23.4% |
| opencode | 85.7% | 771px | -14.3% |
