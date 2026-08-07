/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { useSelectionList } from '../../hooks/useSelectionList.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import type { SelectionListItem } from '../../hooks/useSelectionList.js';

export interface MultiSelectItem<T> extends SelectionListItem<T> {
  label: string;
  separator?: boolean;
}

export interface MultiSelectProps<T> {
  items: Array<MultiSelectItem<T>>;
  initialIndex?: number;
  selectedKeys?: string[];
  onConfirm: (selectedValues: T[]) => void;
  onChange?: (selectedValues: T[]) => void;
  onSelectedKeysChange?: (selectedKeys: string[]) => void;
  onHighlight?: (value: T) => void;
  isFocused?: boolean;
  /** Suppress j/k vim-nav while keeping arrows/Enter/space active. */
  disableVimNav?: boolean;
  showNumbers?: boolean;
  showScrollArrows?: boolean;
  maxItemsToShow?: number;
  checkedText?: string;
  uncheckedText?: string;
  showActiveMarker?: boolean;
}

const EMPTY_SELECTED_KEYS: string[] = [];

function getSelectedValues<T>(
  items: Array<MultiSelectItem<T>>,
  selectedKeys: Set<string>,
): T[] {
  return items
    .filter((item) => selectedKeys.has(item.key))
    .map((item) => item.value);
}

export function MultiSelect<T>({
  items,
  initialIndex = 0,
  selectedKeys = EMPTY_SELECTED_KEYS,
  onConfirm,
  onChange,
  onSelectedKeysChange,
  onHighlight,
  isFocused = true,
  disableVimNav = false,
  showNumbers = true,
  showScrollArrows = false,
  maxItemsToShow = 10,
  checkedText = '[✓]',
  uncheckedText = '[ ]',
  showActiveMarker = false,
}: MultiSelectProps<T>): React.JSX.Element {
  const [scrollOffset, setScrollOffset] = useState(0);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const { activeIndex } = useSelectionList({
    items,
    initialIndex,
    isFocused,
    disableVimNav,
    // Disable numeric quick-select in useSelectionList — in a multi-select
    // context, onSelect triggers onConfirm (submit), so numeric keys would
    // accidentally submit the dialog instead of toggling checkboxes.
    // Numbers are still rendered visually via the showNumbers prop below.
    showNumbers: false,
    onHighlight,
    onSelect: () => {
      onConfirm(getSelectedValues(items, selectedKeySet));
    },
  });

  const toggleSelectionAtIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || item.disabled) {
        return;
      }

      const next = new Set(selectedKeySet);
      if (next.has(item.key)) {
        next.delete(item.key);
      } else {
        next.add(item.key);
      }
      const nextKeys = Array.from(next);
      onSelectedKeysChange?.(nextKeys);
      onChange?.(getSelectedValues(items, next));
    },
    [items, onChange, onSelectedKeysChange, selectedKeySet],
  );

  useKeypress(
    (key) => {
      if (key.name === 'space' || key.sequence === ' ') {
        toggleSelectionAtIndex(activeIndex);
      }
    },
    { isActive: isFocused },
  );

  useEffect(() => {
    const newScrollOffset = Math.max(
      0,
      Math.min(activeIndex - maxItemsToShow + 1, items.length - maxItemsToShow),
    );
    if (activeIndex < scrollOffset) {
      setScrollOffset(activeIndex);
    } else if (activeIndex >= scrollOffset + maxItemsToShow) {
      setScrollOffset(newScrollOffset);
    }
  }, [activeIndex, items.length, scrollOffset, maxItemsToShow]);

  const visibleItems = useMemo(
    () => items.slice(scrollOffset, scrollOffset + maxItemsToShow),
    [items, scrollOffset, maxItemsToShow],
  );
  const numberColumnWidth = String(items.length).length;
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + maxItemsToShow < items.length;
  const moreAboveCount = scrollOffset;
  const moreBelowCount = Math.max(
    0,
    items.length - (scrollOffset + maxItemsToShow),
  );

  return (
    <box style={{ flexDirection: "column" }}>
      {showScrollArrows && hasMoreAbove && (
        <text color={theme.text.secondary}>↑ {moreAboveCount} more above</text>
      )}

      {visibleItems.map((item, index) => {
        const itemIndex = scrollOffset + index;
        const isActive = isFocused && activeIndex === itemIndex;
        const isChecked = selectedKeySet.has(item.key);
        const activeMarker = isActive ? '›' : ' ';

        const itemNumberText = `${String(itemIndex + 1).padStart(
          numberColumnWidth,
        )}.`;
        const checkboxText = item.disabled
          ? '[x]'
          : isChecked
            ? checkedText
            : uncheckedText;

        let textColor = theme.text.primary;
        if (item.disabled) {
          textColor = theme.text.secondary;
        } else if (isActive) {
          textColor = theme.status.success;
        } else if (isChecked) {
          textColor = theme.text.accent;
        }

        if (item.separator) {
          return (
            <box key={item.key} style={{ alignItems: "flex-start" }}>
              {showActiveMarker && (
                <box minWidth={2} style={{ flexShrink: 0 }}>
                  <text color={textColor}>{activeMarker}</text>
                </box>
              )}
              <box minWidth={4} style={{ flexShrink: 0 }}>
                <text> </text>
              </box>
              <box style={{ flexGrow: 1 }}>
                <text color={theme.text.secondary}>{item.label}</text>
              </box>
            </box>
          );
        }

        return (
          <box key={item.key} style={{ alignItems: "flex-start" }}>
            {showActiveMarker && (
              <box minWidth={2} style={{ flexShrink: 0 }}>
                <text color={textColor}>{activeMarker}</text>
              </box>
            )}
            <box minWidth={4} style={{ flexShrink: 0 }}>
              <text color={textColor}>{checkboxText}</text>
            </box>
            {showNumbers && (
              <box marginRight={1} minWidth={itemNumberText.length}>
                <text color={textColor}>{itemNumberText}</text>
              </box>
            )}
            <box style={{ flexGrow: 1 }}>
              <text color={textColor}>{item.label}</text>
            </box>
          </box>
        );
      })}

      {showScrollArrows && hasMoreBelow && (
        <text color={theme.text.secondary}>↓ {moreBelowCount} more below</text>
      )}
    </box>
  );
}
