/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { keyMatchers, Command } from '../../../keyMatchers.js';
import {
  type Extension,
  getExtensionDisplayName,
  getExtensionDescription,
} from '@qwen-code/qwen-code-core';
import { useTerminalSize } from '../../../hooks/useTerminalSize.js';
import { t, getCurrentLanguage } from '../../../../i18n/index.js';
import { ExtensionUpdateState } from '../../../state/extensions.js';

interface ExtensionListStepProps {
  extensions: Extension[];
  extensionsUpdateState: Map<string, string>;
  onExtensionSelect: (extensionIndex: number) => void;
}

export const ExtensionListStep = ({
  extensions,
  extensionsUpdateState,
  onExtensionSelect,
}: ExtensionListStepProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { columns: termWidth } = useTerminalSize();

  // Calculate max widths for each column for alignment
  const { maxNameWidth, maxStatusWidth } = useMemo(() => {
    let maxName = 0;
    let maxStatus = 0;
    for (const ext of extensions) {
      maxName = Math.max(
        maxName,
        getExtensionDisplayName(ext, getCurrentLanguage()).length,
      );
      const statusLength = ext.isActive
        ? t('active').length
        : t('disabled').length;
      maxStatus = Math.max(maxStatus, statusLength);
    }
    return {
      maxNameWidth: maxName,
      maxStatusWidth: maxStatus,
    };
  }, [extensions]);

  // Reset selection when extensions change
  useEffect(() => {
    if (extensions.length > 0 && selectedIndex >= extensions.length) {
      setSelectedIndex(0);
    }
  }, [extensions, selectedIndex]);

  // Keyboard navigation
  useKeypress(
    (key) => {
      if (keyMatchers[Command.SELECTION_UP](key)) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : extensions.length - 1,
        );
      } else if (keyMatchers[Command.SELECTION_DOWN](key)) {
        setSelectedIndex((prev) =>
          prev < extensions.length - 1 ? prev + 1 : 0,
        );
      } else if (key.name === 'return' || key.name === 'space') {
        if (extensions.length > 0) {
          onExtensionSelect(selectedIndex);
        }
      }
    },
    { isActive: true },
  );

  if (extensions.length === 0) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>
          {t('No extensions installed.')}
        </text>
        <text color={theme.text.secondary}>
          {t("Use '/extensions install' to install your first extension.")}
        </text>
      </box>
    );
  }

  const getUpdateStateColor = (state: string | undefined): string => {
    if (!state) return theme.text.secondary;

    switch (state) {
      case ExtensionUpdateState.CHECKING_FOR_UPDATES:
      case ExtensionUpdateState.UPDATING:
        return theme.text.secondary;
      case ExtensionUpdateState.UPDATE_AVAILABLE:
      case ExtensionUpdateState.UPDATED_NEEDS_RESTART:
      case ExtensionUpdateState.UPDATED_WITH_WARNINGS:
        return theme.status.warning;
      case ExtensionUpdateState.ERROR:
        return theme.status.error;
      case ExtensionUpdateState.UP_TO_DATE:
      case ExtensionUpdateState.NOT_UPDATABLE:
      case ExtensionUpdateState.UPDATED:
        return theme.status.success;
      default:
        return theme.text.secondary;
    }
  };

  const getLocalizedUpdateState = (state: string | undefined): string => {
    if (!state) return '';
    // Map internal state values to translation keys
    const stateMap: Record<string, string> = {
      'up to date': t('up to date'),
      'update available': t('update available'),
      'checking...': t('checking...'),
      'not updatable': t('not updatable'),
      error: t('error'),
    };
    return stateMap[state] || state;
  };

  const truncateDescription = (
    text: string,
    maxWidth: number,
    maxLines: number,
  ): string[] => {
    if (maxWidth <= 0) return [];
    const lines: string[] = [];
    let remaining = text;
    for (let i = 0; i < maxLines; i++) {
      if (!remaining) break;
      if (remaining.length <= maxWidth || i === maxLines - 1) {
        lines.push(
          remaining.length > maxWidth
            ? remaining.slice(0, maxWidth - 1) + '…'
            : remaining,
        );
        break;
      }
      lines.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth);
    }
    return lines;
  };

  const renderExtensionItem = (
    extension: Extension,
    index: number,
    isSelected: boolean,
  ) => {
    const locale = getCurrentLanguage();
    const isActive = extension.isActive;
    const activeColor = isActive ? theme.status.success : theme.text.secondary;
    const activeString = isActive ? t('active') : t('disabled');

    const updateState = extensionsUpdateState.get(extension.name);
    const stateColor = getUpdateStateColor(updateState);
    const stateText = getLocalizedUpdateState(updateState);

    const description = getExtensionDescription(extension, locale);
    // selector(2) + name + gap(2) + status + gap(2) + update state
    const fixedWidth = 2 + maxNameWidth + 2 + maxStatusWidth + 4 + 15;
    const descWidth = Math.max(0, termWidth - fixedWidth);
    const descLines = description
      ? truncateDescription(description, descWidth, 2)
      : [];

    return (
      <box key={extension.name} style={{ flexDirection: "column" }} marginBottom={descLines.length > 0 ? 1 : 0}>
        <box style={{ alignItems: "center" }}>
          <box minWidth={2} style={{ flexShrink: 0 }}>
            <text color={isSelected ? theme.text.accent : theme.text.primary}>
              {isSelected ? '●' : ' '}
            </text>
          </box>
          <box style={{ width: maxNameWidth, flexShrink: 0 }}>
            <text
              color={isSelected ? theme.text.accent : theme.text.primary}
              wrap="truncate"
            >
              {getExtensionDisplayName(extension, locale)}
            </text>
          </box>
          <box marginLeft={2} style={{ width: maxStatusWidth + 2, flexShrink: 0 }}>
            <text color={activeColor}>({activeString})</text>
          </box>
          {stateText && <text color={stateColor}>[{stateText}]</text>}
        </box>
        {descLines.length > 0 && (
          <box paddingLeft={2} style={{ flexDirection: "column" }}>
            {descLines.map((line, i) => (
              <text key={i} color={theme.text.secondary}>
                {line}
              </text>
            ))}
          </box>
        )}
      </box>
    );
  };

  return (
    <box style={{ flexDirection: "column" }}>
      <box marginBottom={1}>
        <text color={theme.text.secondary}>
          {t('{{count}} extensions installed', {
            count: extensions.length.toString(),
          })}
        </text>
      </box>
      <box style={{ flexDirection: "column" }}>
        {extensions.map((extension, index) =>
          renderExtensionItem(extension, index, index === selectedIndex),
        )}
      </box>
    </box>
  );
};
