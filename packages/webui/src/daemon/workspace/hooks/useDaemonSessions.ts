/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useDaemonActions } from '../../session/DaemonSessionProvider.js';
import type { DaemonResourceOptions } from '../types.js';
import { useDaemonResource } from './useDaemonResource.js';

export function useDaemonSessions(options: DaemonResourceOptions = {}) {
  const actions = useDaemonActions();
  const load = useCallback(() => actions.listSessions(), [actions]);
  const result = useDaemonResource(load, options);
  return {
    ...result,
    sessions: result.data ?? [],
    loadSession: actions.loadSession,
    newSession: actions.newSession,
    releaseSession: actions.releaseSession,
  };
}
