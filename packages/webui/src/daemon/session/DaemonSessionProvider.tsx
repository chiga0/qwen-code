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
  useSyncExternalStore,
} from 'react';
import {
  DaemonClient,
  DaemonHttpError,
  DaemonSessionClient,
  createDaemonTranscriptStore,
  normalizeDaemonEvent,
  type DaemonTranscriptBlock,
  type DaemonTranscriptState,
  type DaemonTranscriptStore,
} from '@qwen-code/sdk/daemon';
import { createDaemonSessionActions } from './actions.js';
import { detachDaemonClient, getStableClientId } from './clientLifecycle.js';
import {
  getCurrentMode,
  mapProviderStatus,
  mapSupportedCommands,
  updateConnectionFromDaemonEvent,
} from './mappers.js';
import {
  selectDaemonActiveTodoList,
  selectDaemonLatestTodoList,
  selectDaemonPendingPermissions,
  selectDaemonPendingPermissionRequest,
  selectDaemonStreamingState,
  selectDaemonTodoLists,
} from './selectors.js';
import {
  clearPassiveAssistantDoneTimer,
  delay,
  getReconnectDelayMs,
  schedulePassiveAssistantDone,
} from '../timing.js';
import type {
  ActivePrompt,
  DaemonConnectionState,
  DaemonPromptStatus,
  DaemonSessionActions,
  DaemonSessionContextValue,
  DaemonSessionProviderProps,
  PendingSessionLoad,
} from './types.js';

export type {
  DaemonCommandInfo,
  DaemonConnectionState,
  DaemonConnectionStatus,
  DaemonModelInfo,
  DaemonPendingPermissionRequest,
  DaemonPermissionOptionKind,
  DaemonPermissionRequestOption,
  DaemonPromptImage,
  DaemonPromptStatus,
  DaemonSessionActions,
  DaemonSessionContextValue,
  DaemonSessionProviderProps,
  DaemonTodoItem,
  DaemonTodoList,
  DaemonTodoPriority,
  DaemonTodoStatus,
  SendPromptOptions,
} from './types.js';

const DaemonStoreContext = createContext<DaemonTranscriptStore | undefined>(
  undefined,
);
const DaemonConnectionContext = createContext<
  DaemonConnectionState | undefined
>(undefined);
const DaemonActionsContext = createContext<DaemonSessionActions | undefined>(
  undefined,
);
const DaemonPromptStatusContext = createContext<DaemonPromptStatus | undefined>(
  undefined,
);
const TERMINAL_SESSION_HTTP_STATUSES = new Set([401, 403, 404, 410]);

/**
 * Subset of TERMINAL_SESSION_HTTP_STATUSES that represent **credential
 * failures** (vs session-not-found 404/410). Auth failures should NOT enter
 * the reconnect loop even when `autoReconnect: true` — retrying with the
 * same bad token loops forever, hammering the server with bad credentials
 * and risking transcript wipes if reconnect later attaches a different
 * session and hits the sessionId-change `store.reset()` branch.
 *
 * 404/410 (session-not-found) keep the reconnect-then-recreate behavior —
 * those are recoverable by creating a fresh session.
 */
const AUTH_FAILURE_HTTP_STATUSES = new Set([401, 403]);

export function DaemonSessionProvider({
  baseUrl,
  token,
  workspaceCwd,
  initialSessionId,
  clientId,
  createSessionRequest,
  maxQueued = 1024,
  suppressOwnUserEcho = true,
  includeRawEvent = false,
  autoConnect = true,
  autoReconnect = true,
  reconnectDelayMs = 1_000,
  maxReconnectDelayMs = 10_000,
  heartbeatIntervalMs = 30_000,
  heartbeatFailureThreshold = 3,
  loadWarnings,
  children,
}: DaemonSessionProviderProps) {
  const store = useMemo(() => createDaemonTranscriptStore(), []);
  const sessionRef = useRef<DaemonSessionClient | undefined>(undefined);
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  const activePromptsRef = useRef<Map<string, ActivePrompt>>(new Map());
  const pendingSessionLoadRef = useRef<PendingSessionLoad | undefined>(
    undefined,
  );
  const pendingSessionLoadIdRef = useRef(0);
  const passiveAssistantDoneTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const heartbeatSupportedRef = useRef(false);
  const eventOptionsRef = useRef({ suppressOwnUserEcho, includeRawEvent });
  const reconnectConfigRef = useRef({ reconnectDelayMs, maxReconnectDelayMs });
  const loadWarningsRef = useRef(loadWarnings);
  const clientIdRef = useRef<string | undefined>(undefined);
  if (!clientIdRef.current || clientId) {
    clientIdRef.current = getStableClientId(clientId);
  }
  eventOptionsRef.current = { suppressOwnUserEcho, includeRawEvent };
  reconnectConfigRef.current = { reconnectDelayMs, maxReconnectDelayMs };
  loadWarningsRef.current = loadWarnings;
  const modelServiceId = createSessionRequest?.modelServiceId;
  const sessionScope = createSessionRequest?.sessionScope;
  const [promptStatus, setPromptStatus] = useState<DaemonPromptStatus>('idle');
  const [restoreSessionId, setRestoreSessionId] = useState<string | undefined>(
    initialSessionId,
  );
  const [restoreSessionNonce, setRestoreSessionNonce] = useState(0);
  const [newSessionNonce, setNewSessionNonce] = useState(0);
  const [connection, setConnection] = useState<DaemonConnectionState>({
    status: autoConnect ? 'connecting' : 'idle',
  });

  useEffect(() => {
    if (!autoConnect) return undefined;
    const abort = new AbortController();
    let disposed = false;

    const run = async () => {
      const client = new DaemonClient({ baseUrl, token });
      let session: DaemonSessionClient | undefined;
      let capabilities:
        | Awaited<ReturnType<DaemonClient['capabilities']>>
        | undefined;
      let reconnectSessionId = restoreSessionId;
      let shouldCreateFreshSession = !restoreSessionId && newSessionNonce > 0;
      let reconnectAttempt = 0;

      while (!disposed && !abort.signal.aborted) {
        try {
          if (!session) {
            setConnection((current) => ({
              ...current,
              status: 'connecting',
              error: undefined,
            }));
            const caps = await client.capabilities();
            if (disposed || abort.signal.aborted) return;
            capabilities = caps;
            heartbeatSupportedRef.current =
              Array.isArray(caps.features) &&
              caps.features.includes('client_heartbeat');
            const resolvedWorkspaceCwd = workspaceCwd ?? caps.workspaceCwd;
            const nextSession = restoreSessionId
              ? await DaemonSessionClient.load(
                  client,
                  restoreSessionId,
                  { workspaceCwd: resolvedWorkspaceCwd },
                  clientIdRef.current,
                )
              : reconnectSessionId
                ? await DaemonSessionClient.load(
                    client,
                    reconnectSessionId,
                    { workspaceCwd: resolvedWorkspaceCwd },
                    clientIdRef.current,
                  )
                : await DaemonSessionClient.createOrAttach(
                    client,
                    {
                      ...(modelServiceId !== undefined
                        ? { modelServiceId }
                        : {}),
                      ...(shouldCreateFreshSession
                        ? { sessionScope: 'thread' as const }
                        : sessionScope !== undefined
                          ? { sessionScope }
                          : {}),
                      workspaceCwd: resolvedWorkspaceCwd,
                    },
                    clientIdRef.current,
                  );
            if (disposed || abort.signal.aborted) {
              void detachDaemonClient({
                baseUrl,
                token,
                sessionId: nextSession.sessionId,
                clientId: nextSession.clientId,
              }).catch(() => undefined);
              return;
            }
            const previousSessionId = lastSessionIdRef.current;
            if (
              previousSessionId !== undefined &&
              nextSession.sessionId !== previousSessionId
            ) {
              setPromptStatus('idle');
              clearPassiveAssistantDoneTimer(passiveAssistantDoneTimerRef);
              store.reset();
            } else if (previousSessionId !== undefined) {
              store.dispatch({ type: 'assistant.done', reason: 'reconnected' });
              // wenshao R6 (qwen3.7-max): clear the awaitingResync latch
              // BEFORE the new SSE event loop starts. Otherwise, if the
              // prior connection ended after `state_resync_required` set
              // the latch, every event from the fresh stream gets dropped
              // by `applyDaemonTranscriptEvent`'s passthrough guard —
              // transcript stays permanently frozen even though the
              // connection is healthy. Same-session reconnect IS the
              // recovery path; signal it to the reducer now.
              if (store.getSnapshot().awaitingResync) {
                store.clearAwaitingResync();
              }
            }
            session = nextSession;
            reconnectSessionId = session.sessionId;
            shouldCreateFreshSession = false;
            lastSessionIdRef.current = session.sessionId;
            sessionRef.current = session;
          }

          const activeSession = session;
          const [providerResult, commandResult, contextResult] =
            await Promise.allSettled([
              client.workspaceProviders(),
              activeSession.supportedCommands(),
              activeSession.context(),
            ]);
          const providers =
            providerResult.status === 'fulfilled'
              ? providerResult.value
              : undefined;
          const supportedCommands =
            commandResult.status === 'fulfilled'
              ? commandResult.value
              : undefined;
          const context =
            contextResult.status === 'fulfilled'
              ? contextResult.value
              : undefined;
          const loadWarningTexts = [
            providerResult.status === 'rejected'
              ? loadWarningsRef.current?.models
              : undefined,
            commandResult.status === 'rejected'
              ? loadWarningsRef.current?.commands
              : undefined,
            contextResult.status === 'rejected'
              ? loadWarningsRef.current?.context
              : undefined,
          ].filter((warning): warning is string => Boolean(warning));
          const { models, currentModel, contextWindow } =
            mapProviderStatus(providers);
          const { commands, skills } = mapSupportedCommands(supportedCommands);
          const currentMode = getCurrentMode(context);

          setConnection((current) => ({
            status: 'connected',
            sessionId: activeSession.sessionId,
            workspaceCwd: activeSession.workspaceCwd,
            commands,
            skills,
            models,
            currentModel,
            currentMode,
            tokenCount:
              current.sessionId === activeSession.sessionId
                ? (current.tokenCount ?? 0)
                : 0,
            contextWindow,
            providers,
            supportedCommands,
            context,
            capabilities,
          }));
          setPromptStatus(
            activePromptsRef.current.has(activeSession.sessionId)
              ? 'streaming'
              : 'idle',
          );
          const pendingLoad = pendingSessionLoadRef.current;
          if (pendingLoad?.sessionId === activeSession.sessionId) {
            pendingSessionLoadRef.current = undefined;
            pendingLoad.resolve();
          }
          if (loadWarningTexts.length > 0) {
            store.dispatch(
              loadWarningTexts.map((text) => ({
                type: 'status' as const,
                text,
              })),
            );
          }

          let sawEvent = false;
          let resyncRequested = false;
          for await (const event of activeSession.events({
            signal: abort.signal,
            maxQueued,
          })) {
            if (!sawEvent) {
              sawEvent = true;
              reconnectAttempt = 0;
            }
            try {
              updateConnectionFromDaemonEvent(event, setConnection);
              const eventOptions = eventOptionsRef.current;
              const uiEvents = normalizeDaemonEvent(event, {
                clientId: activeSession.clientId,
                suppressOwnUserEcho: eventOptions.suppressOwnUserEcho,
                includeRawEvent: eventOptions.includeRawEvent,
              });
              if (uiEvents.length > 0) {
                setPromptStatus((current) =>
                  current === 'waiting' ? 'streaming' : current,
                );
              }
              store.dispatch(uiEvents);
              if (
                !activePromptsRef.current.has(activeSession.sessionId) &&
                hasAssistantDelta(uiEvents)
              ) {
                schedulePassiveAssistantDone(
                  store,
                  passiveAssistantDoneTimerRef,
                );
              }
              if (event.type === 'state_resync_required') {
                resyncRequested = true;
                setPromptStatus('idle');
                clearPassiveAssistantDoneTimer(passiveAssistantDoneTimerRef);
                store.reset();
                session = undefined;
                sessionRef.current = undefined;
                setConnection((current) => ({
                  ...current,
                  status: 'connecting',
                  error: undefined,
                }));
                break;
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              store.dispatch({
                type: 'error',
                text: `Skipped malformed daemon event: ${message}`,
                recoverable: true,
              });
            }
          }
          if (!disposed && !abort.signal.aborted && !resyncRequested) {
            // Keep the session handle after a normal SSE close so the next
            // subscription can resume from DaemonSessionClient.lastEventId.
            if (sessionRef.current?.sessionId === activeSession.sessionId) {
              clearPassiveAssistantDoneTimer(passiveAssistantDoneTimerRef);
              store.dispatch({
                type: 'assistant.done',
                reason: 'stream_ended',
              });
            }
            store.dispatch({
              type: 'status',
              text: 'SSE stream ended',
            });
            setConnection((current) => ({
              ...current,
              status: 'disconnected',
              error: 'SSE stream ended',
            }));
          }
        } catch (error) {
          if (disposed || abort.signal.aborted) return;
          const message =
            error instanceof Error ? error.message : String(error);
          const failedSessionId = session?.sessionId;
          if (
            failedSessionId &&
            (isAuthFailureHttpError(error) || isTerminalSessionHttpError(error))
          ) {
            const active = activePromptsRef.current.get(failedSessionId);
            active?.controller.abort();
            activePromptsRef.current.delete(failedSessionId);
          }
          store.dispatch({ type: 'error', text: message, recoverable: true });
          session = undefined;
          sessionRef.current = undefined;
          clearPassiveAssistantDoneTimer(passiveAssistantDoneTimerRef);
          setPromptStatus('idle');
          const pendingLoad = pendingSessionLoadRef.current;
          if (
            pendingLoad &&
            (pendingLoad.sessionId === restoreSessionId ||
              pendingLoad.sessionId === reconnectSessionId)
          ) {
            pendingSessionLoadRef.current = undefined;
            pendingLoad.reject(error);
          }
          // Auth failures (401 / 403) must NOT retry even when
          // `autoReconnect: true`. Retrying with the same invalid token
          // loops forever — the daemon keeps returning 401, each cycle
          // risks transcript wipes via the sessionId-change branch above,
          // and the user sees no actionable error state.
          // Surface as a terminal 'error' connection state regardless of
          // the autoReconnect setting; the user must update credentials.
          if (isAuthFailureHttpError(error)) {
            setConnection({
              status: 'error',
              error: message,
            });
            return;
          }
          if (isTerminalSessionHttpError(error)) {
            reconnectSessionId = undefined;
            if (restoreSessionId) {
              setRestoreSessionId(undefined);
            }
          }
          if (!autoReconnect) {
            setConnection({
              status: 'error',
              error: message,
            });
            return;
          }
          setConnection((current) => ({
            ...current,
            status: 'disconnected',
            error: message,
          }));
        }

        if (!autoReconnect) {
          sessionRef.current = undefined;
          setConnection((current) => ({
            ...current,
            status: 'disconnected',
          }));
          return;
        }

        reconnectAttempt += 1;
        const reconnectConfig = reconnectConfigRef.current;
        const delayMs = getReconnectDelayMs(
          reconnectAttempt,
          reconnectConfig.reconnectDelayMs,
          reconnectConfig.maxReconnectDelayMs,
        );
        setConnection((current) => ({
          ...current,
          status: 'disconnected',
          error: `Reconnecting in ${delayMs}ms`,
        }));
        await delay(delayMs, abort.signal);
      }
    };

    void run();
    return () => {
      const session = sessionRef.current;
      disposed = true;
      abort.abort();
      setPromptStatus('idle');
      clearPassiveAssistantDoneTimer(passiveAssistantDoneTimerRef);
      if (pendingSessionLoadRef.current) {
        pendingSessionLoadRef.current.reject(
          new Error('Session load interrupted by cleanup'),
        );
        pendingSessionLoadRef.current = undefined;
      }
      if (session?.clientId) {
        void detachDaemonClient({
          baseUrl,
          token,
          sessionId: session.sessionId,
          clientId: session.clientId,
        }).catch(() => undefined);
      }
      sessionRef.current = undefined;
    };
  }, [
    autoConnect,
    autoReconnect,
    baseUrl,
    token,
    workspaceCwd,
    modelServiceId,
    sessionScope,
    maxQueued,
    store,
    restoreSessionId,
    restoreSessionNonce,
    newSessionNonce,
  ]);

  useEffect(() => {
    if (
      !heartbeatSupportedRef.current ||
      heartbeatIntervalMs <= 0 ||
      heartbeatFailureThreshold <= 0 ||
      !connection.sessionId
    ) {
      return undefined;
    }
    let disposed = false;
    let consecutiveFailures = 0;
    const timer = setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      session
        .heartbeat()
        .then(() => {
          if (disposed) return;
          if (consecutiveFailures >= heartbeatFailureThreshold) {
            setConnection((current) =>
              current.sessionId === session.sessionId
                ? { ...current, status: 'connected', error: undefined }
                : current,
            );
          }
          consecutiveFailures = 0;
        })
        .catch((error: unknown) => {
          if (disposed) return;
          consecutiveFailures += 1;
          if (consecutiveFailures < heartbeatFailureThreshold) return;
          const message =
            error instanceof Error ? error.message : 'Session heartbeat failed';
          setConnection((current) =>
            current.sessionId === session.sessionId
              ? { ...current, status: 'disconnected', error: message }
              : current,
          );
        });
    }, heartbeatIntervalMs);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [connection.sessionId, heartbeatFailureThreshold, heartbeatIntervalMs]);

  const actions = useMemo<DaemonSessionActions>(
    () =>
      createDaemonSessionActions({
        baseUrl,
        token,
        store,
        sessionRef,
        activePromptsRef,
        pendingSessionLoadRef,
        pendingSessionLoadIdRef,
        heartbeatSupportedRef,
        clientIdRef,
        passiveAssistantDoneTimerRef,
        setConnection,
        setPromptStatus,
        setRestoreSessionId,
        setRestoreSessionNonce,
        setNewSessionNonce,
      }),
    [baseUrl, store, token],
  );
  return (
    <DaemonStoreContext.Provider value={store}>
      <DaemonConnectionContext.Provider value={connection}>
        <DaemonPromptStatusContext.Provider value={promptStatus}>
          <DaemonActionsContext.Provider value={actions}>
            {children}
          </DaemonActionsContext.Provider>
        </DaemonPromptStatusContext.Provider>
      </DaemonConnectionContext.Provider>
    </DaemonStoreContext.Provider>
  );
}

export function useDaemonSession(): DaemonSessionContextValue {
  return {
    store: useDaemonTranscriptStore(),
    connection: useDaemonConnection(),
    promptStatus: useDaemonPromptStatus(),
    actions: useDaemonActions(),
  };
}

export function useDaemonTranscriptStore(): DaemonTranscriptStore {
  const store = useContext(DaemonStoreContext);
  if (!store) {
    throw new Error(
      'useDaemonTranscriptStore must be used within DaemonSessionProvider',
    );
  }
  return store;
}

export function useDaemonTranscriptState(): DaemonTranscriptState {
  const store = useDaemonTranscriptStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export function useDaemonTranscriptBlocks(): readonly DaemonTranscriptBlock[] {
  const store = useDaemonTranscriptStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().blocks,
    () => store.getSnapshot().blocks,
  );
}

export function useDaemonPendingPermissions() {
  // wenshao R5 (qwen3.7-max): subscribe at the blocks level instead of
  // the full transcript state. `selectPendingPermissionBlocks` reads
  // only `state.blocks`; subscribing to the full state caused this
  // hook to re-render on every daemon event (text deltas, tool
  // updates, sidechannel changes) even when blocks were unchanged.
  const blocks = useDaemonTranscriptBlocks();
  return useMemo(() => selectDaemonPendingPermissions(blocks), [blocks]);
}

export function useDaemonPendingPermissionRequest() {
  const blocks = useDaemonTranscriptBlocks();
  return useMemo(() => selectDaemonPendingPermissionRequest(blocks), [blocks]);
}

export function useDaemonTodoLists() {
  const blocks = useDaemonTranscriptBlocks();
  return useMemo(() => selectDaemonTodoLists(blocks), [blocks]);
}

export function useDaemonLatestTodoList() {
  const blocks = useDaemonTranscriptBlocks();
  return useMemo(() => selectDaemonLatestTodoList(blocks), [blocks]);
}

export function useDaemonActiveTodoList() {
  const blocks = useDaemonTranscriptBlocks();
  return useMemo(() => selectDaemonActiveTodoList(blocks), [blocks]);
}

export function useDaemonStreamingState() {
  const blocks = useDaemonTranscriptBlocks();
  const promptStatus = useDaemonPromptStatus();
  return useMemo(
    () => selectDaemonStreamingState(blocks, promptStatus),
    [blocks, promptStatus],
  );
}

export function useDaemonActions(): DaemonSessionActions {
  const actions = useContext(DaemonActionsContext);
  if (!actions) {
    throw new Error(
      'useDaemonActions must be used within DaemonSessionProvider',
    );
  }
  return actions;
}

export function useDaemonPromptStatus(): DaemonPromptStatus {
  const promptStatus = useContext(DaemonPromptStatusContext);
  if (!promptStatus) {
    throw new Error(
      'useDaemonPromptStatus must be used within DaemonSessionProvider',
    );
  }
  return promptStatus;
}

export function useDaemonConnection(): DaemonConnectionState {
  const connection = useContext(DaemonConnectionContext);
  if (!connection) {
    throw new Error(
      'useDaemonConnection must be used within DaemonSessionProvider',
    );
  }
  return connection;
}

function hasAssistantDelta(events: ReadonlyArray<{ type: string }>): boolean {
  return events.some((event) => event.type === 'assistant.text.delta');
}

function isTerminalSessionHttpError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  return status !== undefined && TERMINAL_SESSION_HTTP_STATUSES.has(status);
}

function isAuthFailureHttpError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  return status !== undefined && AUTH_FAILURE_HTTP_STATUSES.has(status);
}

function extractHttpStatus(error: unknown): number | undefined {
  if (error instanceof DaemonHttpError) return error.status;
  if (isRecord(error) && typeof error['status'] === 'number') {
    return error['status'];
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
