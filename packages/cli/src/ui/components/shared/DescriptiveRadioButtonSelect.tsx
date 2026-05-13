/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { isValidElement, useId } from 'react';
import { Text, Box } from 'ink';
import { theme } from '../../semantic-colors.js';
import { BaseSelectionList } from './BaseSelectionList.js';
import type { SelectionListItem } from '../../hooks/useSelectionList.js';
import { useRichSelectWidget } from '../../../richInteraction/hooks.js';

export interface DescriptiveRadioSelectItem<T> extends SelectionListItem<T> {
  title: React.ReactNode;
  description: React.ReactNode;
}

export interface DescriptiveRadioButtonSelectProps<T> {
  /** An array of items to display as descriptive radio options. */
  items: Array<DescriptiveRadioSelectItem<T>>;
  /** The initial index selected */
  initialIndex?: number;
  /** Function called when an item is selected. Receives the `value` of the selected item. */
  onSelect: (value: T) => void;
  /** Function called when an item is highlighted. Receives the `value` of the selected item. */
  onHighlight?: (value: T) => void;
  /** Whether this select input is currently focused and should respond to input. */
  isFocused?: boolean;
  /** Whether to show numbers next to items. */
  showNumbers?: boolean;
  /** Whether to show the scroll arrows. */
  showScrollArrows?: boolean;
  /** The maximum number of items to show at once. */
  maxItemsToShow?: number;
  /** Gap (in rows) between each item. */
  itemGap?: number;
  /** Disable rich terminal sidecar emission for callers that emit a richer widget themselves. */
  suppressRichWidget?: boolean;
  /** Title shown by rich terminal frontends. */
  richWidgetTitle?: string;
}

function plainTextFromNode(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(plainTextFromNode).join('');
  }
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return plainTextFromNode(node.props.children);
  }
  return '';
}

/**
 * A radio button select component that displays items with title and description.
 *
 * @template T The type of the value associated with each descriptive radio item.
 */
export function DescriptiveRadioButtonSelect<T>({
  items,
  initialIndex = 0,
  onSelect,
  onHighlight,
  isFocused = true,
  showNumbers = false,
  showScrollArrows = false,
  maxItemsToShow = 10,
  itemGap = 0,
  suppressRichWidget = false,
  richWidgetTitle = 'Select an option',
}: DescriptiveRadioButtonSelectProps<T>): React.JSX.Element {
  const widgetId = useId();
  const richWidgetActive = useRichSelectWidget({
    widgetId: `descriptive-radio-select:${widgetId}`,
    title: richWidgetTitle,
    isFocused: isFocused && !suppressRichWidget,
    initialIndex,
    items: items.map((item) => ({
      key: item.key,
      label: plainTextFromNode(item.title) || item.key,
      description: plainTextFromNode(item.description),
      value: item.value,
      disabled: item.disabled,
    })),
    onSelect,
  });

  if (richWidgetActive) {
    return <></>;
  }

  return (
    <BaseSelectionList<T, DescriptiveRadioSelectItem<T>>
      items={items}
      initialIndex={initialIndex}
      onSelect={onSelect}
      onHighlight={onHighlight}
      isFocused={isFocused}
      showNumbers={showNumbers}
      showScrollArrows={showScrollArrows}
      maxItemsToShow={maxItemsToShow}
      itemGap={itemGap}
      renderItem={(item, { titleColor }) => (
        <Box flexDirection="column" key={item.key}>
          <Text color={titleColor}>{item.title}</Text>
          {typeof item.description === 'string' ? (
            <Text color={theme.text.secondary}>{item.description}</Text>
          ) : (
            item.description
          )}
        </Box>
      )}
    />
  );
}
