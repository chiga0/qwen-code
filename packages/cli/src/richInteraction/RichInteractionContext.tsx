/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext } from 'react';
import type { RichInteractionBridge } from './RichInteractionBridge.js';

export const RichInteractionContext =
  createContext<RichInteractionBridge | null>(null);

export function useRichInteraction(): RichInteractionBridge | null {
  return useContext(RichInteractionContext);
}
