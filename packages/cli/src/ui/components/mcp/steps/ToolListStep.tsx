/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { keyMatchers, Command } from '../../../keyMatchers.js';
import { t } from '../../../../i18n/index.js';
import type { ToolListStepProps, MCPToolDisplayInfo } from '../types.js';
import { VISIBLE_TOOLS_COUNT } from '../constants.js';

export const ToolListStep: React.FC<ToolListStepProps> = ({
  tools,
  onSelect,
  onBack,
  isActive = true,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 动态计算工具名称列的最大宽度（基于实际内容）
  const toolNameWidth = useMemo(() => {
    if (tools.length === 0) return 30;
    const maxLength = Math.max(...tools.map((t) => t.name.length));
    // 最小 30，最大 50，留一些余量
    return Math.min(Math.max(maxLength + 2, 30), 50);
  }, [tools]);

  // 计算可视区域的起始索引（滚动窗口）
  const scrollOffset = useMemo(() => {
    if (tools.length <= VISIBLE_TOOLS_COUNT) {
      return 0;
    }
    // 确保选中项在可视区域内
    if (selectedIndex < VISIBLE_TOOLS_COUNT - 1) {
      return 0;
    }
    return Math.min(
      selectedIndex - VISIBLE_TOOLS_COUNT + 1,
      tools.length - VISIBLE_TOOLS_COUNT,
    );
  }, [selectedIndex, tools.length]);

  // 当前可视的工具列表
  const displayTools = useMemo(
    () => tools.slice(scrollOffset, scrollOffset + VISIBLE_TOOLS_COUNT),
    [tools, scrollOffset],
  );

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onBack();
      } else if (keyMatchers[Command.SELECTION_UP](key)) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (keyMatchers[Command.SELECTION_DOWN](key)) {
        setSelectedIndex((prev) => Math.min(tools.length - 1, prev + 1));
      } else if (key.name === 'return') {
        if (tools[selectedIndex]) {
          onSelect(tools[selectedIndex]);
        }
      }
    },
    { isActive },
  );

  if (tools.length === 0) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>
          {t('No tools available for this server.')}
        </text>
      </box>
    );
  }

  const getToolAnnotations = (tool: MCPToolDisplayInfo): string => {
    const hints: string[] = [];
    if (tool.annotations?.destructiveHint) hints.push(t('destructive'));
    if (tool.annotations?.readOnlyHint) hints.push(t('read-only'));
    if (tool.annotations?.openWorldHint) hints.push(t('open-world'));
    if (tool.annotations?.idempotentHint) hints.push(t('idempotent'));
    return hints.join(', ');
  };

  return (
    <box style={{ flexDirection: "column" }}>
      {/* 工具列表 */}
      <box style={{ flexDirection: "column" }}>
        {displayTools.map((tool, index) => {
          const actualIndex = scrollOffset + index;
          const isSelected = actualIndex === selectedIndex;
          const annotations = getToolAnnotations(tool);

          return (
            <box key={tool.name}>
              {/* 选择器 */}
              <box minWidth={2}>
                <text
                  color={isSelected ? theme.text.accent : theme.text.primary}
                >
                  {isSelected ? '❯' : ' '}
                </text>
              </box>
              {/* 工具名称 - 固定宽度 */}
              <box style={{ width: toolNameWidth }}>
                <text
                  color={isSelected ? theme.text.accent : theme.text.primary}
                  wrap="truncate"
                >
                  {tool.name}
                </text>
              </box>
              {/* 显示无效工具警告 */}
              {!tool.isValid && (
                <text color={theme.status.warning}>
                  {t('invalid: {{reason}}', {
                    reason: tool.invalidReason || t('unknown'),
                  })}
                </text>
              )}
              {annotations && tool.isValid && (
                <text color={theme.text.secondary}>{annotations}</text>
              )}
            </box>
          );
        })}
      </box>

      {/* 滚动提示 */}
      {tools.length > VISIBLE_TOOLS_COUNT && (
        <box marginTop={1}>
          <text color={theme.text.secondary}>
            {scrollOffset > 0 ? '↑ ' : '  '}
            {t('{{current}}/{{total}}', {
              current: (selectedIndex + 1).toString(),
              total: tools.length.toString(),
            })}
            {scrollOffset + VISIBLE_TOOLS_COUNT < tools.length ? ' ↓' : ''}
          </text>
        </box>
      )}
    </box>
  );
};
