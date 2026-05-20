/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { PermissionResponse } from '@qwen-code/sdk/daemon';
import {
  ChatViewer,
  type ChatViewerProps,
} from '../../components/ChatViewer/index.js';
import {
  useDaemonActions,
  useDaemonConnection,
  useDaemonPendingPermissions,
  useDaemonSession,
  useDaemonTranscriptBlocks,
} from '../DaemonSessionProvider.js';
import { daemonBlocksToChatMessages } from '../chatMessages.js';
import '../daemonWeb.css';

export interface DaemonWebChatProps {
  className?: string;
  emptyMessage?: string;
  connectedEmptyMessage?: string;
  disconnectedEmptyMessage?: string;
  showComposer?: boolean;
  showPermissionTray?: boolean;
  chatViewerProps?: Omit<ChatViewerProps, 'messages'>;
}

export function DaemonWebChat({
  className,
  emptyMessage,
  connectedEmptyMessage = 'Send a prompt to start a daemon session.',
  disconnectedEmptyMessage = 'Connect to a daemon, then send a prompt.',
  showComposer = true,
  showPermissionTray = true,
  chatViewerProps,
}: DaemonWebChatProps) {
  const blocks = useDaemonTranscriptBlocks();
  const pendingPermissions = useDaemonPendingPermissions();
  const actions = useDaemonActions();
  const { store } = useDaemonSession();
  const { status } = useDaemonConnection();
  const [draft, setDraft] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const connected = status === 'connected';
  const messages = useMemo(() => daemonBlocksToChatMessages(blocks), [blocks]);

  const runAction = (promise: Promise<unknown>) => {
    setActionError(undefined);
    void promise.catch((error) => {
      setActionError(error instanceof Error ? error.message : String(error));
    });
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    if (text.trim() === '/cancel') {
      runAction(actions.cancel());
      return;
    }
    if (text.trim().startsWith('/model ')) {
      runAction(actions.setModel(text.trim().slice('/model '.length)));
      return;
    }
    runAction(actions.sendPrompt(text));
  };

  const resolvePermission = (
    requestId: string,
    optionId: string,
    optionLabel: string,
  ) => {
    if (!connected) {
      store.dispatch({
        type: 'permission.resolved',
        requestId,
        outcome: optionLabel,
      });
      return;
    }
    runAction(
      actions.respondToPermission(requestId, toPermissionResponse(optionId)),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !isComposing
    ) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={['daemon-web-chat', className].filter(Boolean).join(' ')}>
      <div className="daemon-web-chat__scroll">
        <ChatViewer
          autoScroll
          showEmptyIcon={false}
          theme="dark"
          {...chatViewerProps}
          className={['daemon-web-chat__viewer', chatViewerProps?.className]
            .filter(Boolean)
            .join(' ')}
          emptyMessage={
            emptyMessage ??
            (connected ? connectedEmptyMessage : disconnectedEmptyMessage)
          }
          messages={messages}
        />
      </div>
      {showPermissionTray && pendingPermissions.length > 0 ? (
        <div className="daemon-web-permission-tray">
          {pendingPermissions.map((permission) => (
            <section className="daemon-web-permission-card" key={permission.id}>
              <div>
                <div className="daemon-web-eyebrow">Permission Required</div>
                <strong>{permission.title}</strong>
              </div>
              <div className="daemon-web-permission-options">
                {(permission.options.length > 0
                  ? permission.options
                  : [{ optionId: '__cancel__', label: 'Cancel' }]
                ).map((option) => (
                  <button
                    key={option.optionId}
                    onClick={() =>
                      resolvePermission(
                        permission.requestId,
                        option.optionId,
                        option.label,
                      )
                    }
                    type="button"
                  >
                    <span>{option.label}</span>
                    {getOptionDescription(option) ? (
                      <small>{getOptionDescription(option)}</small>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {actionError ? (
        <div className="daemon-web-action-error">{actionError}</div>
      ) : null}
      {showComposer ? (
        <form className="daemon-web-composer" onSubmit={submit}>
          <div className="daemon-web-composer__box">
            <textarea
              disabled={!connected}
              onChange={(event) => setDraft(event.target.value)}
              onCompositionEnd={() => setIsComposing(false)}
              onCompositionStart={() => setIsComposing(true)}
              onKeyDown={onKeyDown}
              placeholder="Ask the agent anything. Enter sends, Shift+Enter adds a newline."
              value={draft}
            />
            <div className="daemon-web-composer__footer">
              <div className="daemon-web-quick-actions">
                <button
                  disabled={!connected}
                  onClick={() => setDraft('/model ')}
                  type="button"
                >
                  Model
                </button>
                <button
                  disabled={!connected}
                  onClick={() => runAction(actions.cancel())}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              <button
                className="daemon-web-primary"
                disabled={!connected || !draft.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function toPermissionResponse(optionId: string): PermissionResponse {
  if (optionId === '__cancel__') {
    return { outcome: { outcome: 'cancelled' } };
  }
  return { outcome: { outcome: 'selected', optionId } };
}

function getOptionDescription(option: {
  optionId: string;
  label: string;
  description?: string;
}): string {
  return option.description ?? '';
}
