/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DaemonCapabilities } from '@qwen-code/sdk/daemon';
import { DaemonClient } from '@qwen-code/sdk/daemon';
import { createDaemonWorkspaceActions } from './actions.js';
import type {
  DaemonWorkspaceContextValue,
  DaemonWorkspaceProviderProps,
  DaemonWorkspaceActions,
} from './types.js';

const DaemonWorkspaceContext = createContext<
  DaemonWorkspaceContextValue | undefined
>(undefined);

export type {
  DaemonWorkspaceActions,
  DaemonWorkspaceContextValue,
  DaemonWorkspaceProviderProps,
} from './types.js';

export function DaemonWorkspaceProvider({
  baseUrl,
  token,
  workspaceCwd,
  autoConnect = true,
  children,
}: DaemonWorkspaceProviderProps) {
  const [client, setClient] = useState<DaemonClient | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<
    DaemonCapabilities | undefined
  >(undefined);
  const clientRef = useRef<DaemonClient | undefined>(undefined);
  clientRef.current = client;

  useEffect(() => {
    if (!autoConnect) return undefined;
    const newClient = new DaemonClient({ baseUrl, token });
    setClient(newClient);

    let disposed = false;
    void newClient.capabilities().then((caps) => {
      if (!disposed) setCapabilities(caps);
    });

    return () => {
      disposed = true;
      setClient(undefined);
    };
  }, [autoConnect, baseUrl, token]);

  const workspaceActions = useMemo<DaemonWorkspaceActions>(
    () =>
      createDaemonWorkspaceActions({
        getClient: () => clientRef.current,
        baseUrl,
        token,
      }),
     
    [baseUrl, token],
  );

  const contextValue = useMemo<DaemonWorkspaceContextValue | undefined>(() => {
    if (!client) return undefined;
    return {
      client,
      token,
      baseUrl,
      workspaceCwd: capabilities?.workspaceCwd ?? workspaceCwd,
      capabilities,
      actions: workspaceActions,
    };
  }, [client, token, baseUrl, workspaceCwd, capabilities, workspaceActions]);

  return (
    <DaemonWorkspaceContext.Provider value={contextValue}>
      {children}
    </DaemonWorkspaceContext.Provider>
  );
}

export function useDaemonWorkspace(): DaemonWorkspaceContextValue {
  const context = useContext(DaemonWorkspaceContext);
  if (!context) {
    throw new Error(
      'useDaemonWorkspace must be used within DaemonWorkspaceProvider',
    );
  }
  return context;
}

export function useDaemonWorkspaceActions(): DaemonWorkspaceActions {
  const context = useDaemonWorkspace();
  return context.actions;
}

/**
 * Returns the workspace context if available, or undefined if no ancestor
 * `DaemonWorkspaceProvider` exists. Useful for optional integration.
 */
export function useOptionalDaemonWorkspace():
  | DaemonWorkspaceContextValue
  | undefined {
  return useContext(DaemonWorkspaceContext);
}
