/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { t } from '../../../../i18n/index.js';
import type { ToolDetailStepProps } from '../types.js';

/**
 * 渲染单个参数
 */
const renderParameter = (
  name: string,
  param: Record<string, unknown>,
  isRequired: boolean,
): React.ReactNode => {
  const type = (param['type'] as string) || 'any';
  const description = (param['description'] as string) || '';
  // const defaultValue = param['default'];
  // const enumValues = param['enum'] as string[] | undefined;
  const text = `• ${name}${isRequired ? t('required') : ''}: ${type} ${description ? `- ${description}` : ''}`;

  return (
    <box key={name}>
      <text color={theme.text.secondary} wrap="wrap">
        {text}
      </text>
    </box>
  );
};

/**
 * 渲染参数列表
 */
const ParametersList: React.FC<{
  properties: Record<string, unknown>;
  required: string[];
}> = ({ properties, required }) => {
  const requiredSet = new Set(required);

  return (
    <box style={{ flexDirection: "column" }}>
      <text color={theme.text.primary} bold>
        {t('Parameters')}:
      </text>
      <box style={{ flexDirection: "column" }} marginLeft={1}>
        {Object.entries(properties).map(([name, param]) =>
          renderParameter(
            name,
            param as Record<string, unknown>,
            requiredSet.has(name),
          ),
        )}
      </box>
    </box>
  );
};

/**
 * 提取并展示schema的关键信息，使用类似示例的格式
 */
const SchemaSummary: React.FC<{ schema: object }> = ({ schema }) => {
  const obj = schema as Record<string, unknown>;
  const properties = obj['properties'] as Record<string, unknown> | undefined;
  const required = (obj['required'] as string[]) || [];

  return (
    <box style={{ flexDirection: "column" }}>
      {/* 参数列表 */}
      {properties && Object.keys(properties).length > 0 && (
        <ParametersList properties={properties} required={required} />
      )}
    </box>
  );
};

export const ToolDetailStep: React.FC<ToolDetailStepProps> = ({
  tool,
  onBack,
  isActive = true,
}) => {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onBack();
      }
    },
    { isActive },
  );

  if (!tool) {
    return (
      <box>
        <text color={theme.status.error}>{t('No tool selected')}</text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      {/* 无效工具警告 */}
      {!tool.isValid && (
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text color={theme.status.error} bold>
            {t('Warning: This tool cannot be called by the LLM')}
          </text>
          <text color={theme.status.error}>
            {t('Reason')}: {tool.invalidReason || t('unknown')}
          </text>
          <text color={theme.text.secondary}>
            {t(
              'Tools must have both name and description to be used by the LLM.',
            )}
          </text>
        </box>
      )}

      {/* 工具描述 */}
      {tool.description && (
        <box style={{ flexDirection: "column" }}>
          <text color={theme.text.primary} bold>
            {t('Description')}:
          </text>
          <text wrap="wrap">{tool.description}</text>
        </box>
      )}

      {/* Schema */}
      {tool.schema && (
        <box style={{ flexDirection: "column" }}>
          <SchemaSummary schema={tool.schema} />
        </box>
      )}
    </box>
  );
};
