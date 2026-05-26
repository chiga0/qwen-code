/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useDaemonWorkspaceActions } from '../DaemonWorkspaceProvider.js';
import type { DaemonResourceOptions } from '../types.js';
import { useDaemonResource } from './useDaemonResource.js';

export function useDaemonMemory(options: DaemonResourceOptions = {}) {
  const workspaceActions = useDaemonWorkspaceActions();
  const load = useCallback(
    () => workspaceActions.loadMemoryStatus(),
    [workspaceActions],
  );
  const result = useDaemonResource(load, options);
  return {
    ...result,
    status: result.data,
    files: result.data?.files ?? [],
    readFile: workspaceActions.readWorkspaceFile,
    writeMemory: workspaceActions.writeMemory,
  };
}
