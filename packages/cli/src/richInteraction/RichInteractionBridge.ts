/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type { DualOutputBridge } from '../dualOutput/DualOutputBridge.js';
import { osc, wrapForMultiplexer } from '../utils/osc.js';
import type { RichWidgetRequest, RichWidgetResponse } from './types.js';

type RichWidgetResolver = (
  response: RichWidgetResponse,
) => void | Promise<void>;
type AnchorEmitter = (data: string) => void;

export interface OpenRichWidgetOptions {
  widget: Omit<RichWidgetRequest, 'subtype'>;
  onResponse: RichWidgetResolver;
}

export class RichInteractionBridge {
  private readonly resolvers = new Map<string, RichWidgetResolver>();
  private readonly widgetToRequest = new Map<string, string>();

  constructor(
    private readonly dualOutput: DualOutputBridge,
    private readonly emitAnchor?: AnchorEmitter,
  ) {}

  get isConnected(): boolean {
    return this.dualOutput.isConnected;
  }

  openWidget({ widget, onResponse }: OpenRichWidgetOptions): string {
    const requestId = randomUUID();
    const request: RichWidgetRequest = {
      ...widget,
      subtype: 'rich_widget',
      anchor: widget.anchor ?? { type: 'cursor' },
    };
    this.resolvers.set(requestId, onResponse);
    this.widgetToRequest.set(request.widget_id, requestId);
    this.emitOscMarker('open', requestId, request.widget_id, request.kind);
    this.dualOutput.emitRichWidgetRequest(requestId, request);
    return requestId;
  }

  updateWidget(requestId: string, widget: RichWidgetRequest): void {
    if (!this.resolvers.has(requestId)) return;
    this.dualOutput.emitRichWidgetRequest(requestId, widget);
  }

  closeWidget(requestIdOrWidgetId: string): void {
    const requestId = this.resolvers.has(requestIdOrWidgetId)
      ? requestIdOrWidgetId
      : this.widgetToRequest.get(requestIdOrWidgetId);
    if (!requestId) return;
    const widgetId = [...this.widgetToRequest.entries()].find(
      ([, value]) => value === requestId,
    )?.[0];
    this.resolvers.delete(requestId);
    if (widgetId) {
      this.widgetToRequest.delete(widgetId);
      this.emitOscMarker('close', requestId, widgetId);
    }
    this.dualOutput.emitRichWidgetClose(requestId, widgetId);
  }

  async resolveWidgetResponse(response: RichWidgetResponse): Promise<boolean> {
    const requestId =
      response.request_id ||
      (response.widget_id ? this.widgetToRequest.get(response.widget_id) : '');
    if (!requestId) return false;
    const resolver = this.resolvers.get(requestId);
    if (!resolver) return false;
    await resolver({ ...response, request_id: requestId });
    this.closeWidget(requestId);
    return true;
  }

  private emitOscMarker(
    event: 'open' | 'close',
    requestId: string,
    widgetId: string,
    kind?: string,
  ): void {
    if (!this.emitAnchor) return;
    const payload = JSON.stringify({
      event,
      request_id: requestId,
      widget_id: widgetId,
      kind,
    });
    this.emitAnchor(wrapForMultiplexer(osc(777, 'warp-web-widget', payload)));
  }
}
