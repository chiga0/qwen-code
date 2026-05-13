/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

export type RichWidgetKind =
  | 'select'
  | 'multi_select'
  | 'form'
  | 'approval'
  | 'diff';

export interface RichWidgetOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface RichWidgetField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multi_select';
  value?: string | string[];
  placeholder?: string;
  options?: RichWidgetOption[];
}

export interface RichWidgetAnchor {
  type: 'cursor';
  marker?: string;
  reservedRows?: number;
}

export interface RichWidgetRequestPayload {
  options?: RichWidgetOption[];
  fields?: RichWidgetField[];
  questions?: unknown[];
  body?: string;
  diff?: string;
  fileName?: string;
  filePath?: string;
  choices?: RichWidgetOption[];
  metadata?: Record<string, unknown>;
}

export interface RichWidgetRequest {
  subtype: 'rich_widget';
  widget_id: string;
  kind: RichWidgetKind;
  title: string;
  payload: RichWidgetRequestPayload;
  anchor?: RichWidgetAnchor;
}

export interface RichWidgetResponse {
  request_id: string;
  widget_id?: string;
  action?: 'submit' | 'cancel' | 'dismiss';
  value?: unknown;
  values?: Record<string, unknown>;
  selectedIndex?: number;
  selectedIndices?: number[];
  decision?: string;
  response?: unknown;
}
