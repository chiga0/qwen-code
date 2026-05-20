/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Terminal } from '@xterm/xterm';
// eslint-disable-next-line import/no-internal-modules
import '@xterm/xterm/css/xterm.css';
import {
  sanitizeDaemonTerminalText,
  transcriptBlockToTerminalText,
  type DaemonUiSessionActions,
} from '@qwen-code/sdk/daemon';
import {
  useDaemonActions,
  useDaemonConnection,
  useDaemonTranscriptBlocks,
} from '../DaemonSessionProvider.js';
import '../daemonWeb.css';

export interface DaemonWebTerminalProps {
  className?: string;
  hint?: string;
  promptLabel?: string;
}

export function DaemonWebTerminal({
  className,
  hint = 'Semantic terminal renderer. Input goes to prompt API; output is rendered from transcript state, not a PTY byte stream.',
  promptLabel = 'qwen-daemon>',
}: DaemonWebTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | undefined>(undefined);
  const inputRef = useRef('');
  const blocks = useDaemonTranscriptBlocks();
  const actions = useDaemonActions();
  const { status } = useDaemonConnection();
  const connected = status === 'connected';
  const rendered = useMemo(
    () => blocks.map((block) => transcriptBlockToTerminalText(block)).join(''),
    [blocks],
  );

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#050608',
        foreground: '#d1d5db',
        cursor: '#4ade80',
        selectionBackground: '#214062',
      },
    });
    terminal.open(containerRef.current);
    terminal.write(`${promptAnsi(promptLabel)}`);
    terminal.onData((data) => {
      handleTerminalInput(data, {
        actions,
        connected,
        inputRef,
        promptLabel,
        terminal,
      });
    });
    terminalRef.current = terminal;
    return () => {
      terminal.dispose();
      terminalRef.current = undefined;
    };
  }, [actions, connected, promptLabel]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.reset();
    if (rendered) terminal.write(rendered);
    terminal.write(promptAnsi(promptLabel));
    if (inputRef.current) terminal.write(sanitizeEcho(inputRef.current));
  }, [promptLabel, rendered]);

  return (
    <div
      className={['daemon-web-terminal', className].filter(Boolean).join(' ')}
    >
      <div className="daemon-web-terminal__surface" ref={containerRef} />
      {hint ? <div className="daemon-web-terminal__hint">{hint}</div> : null}
    </div>
  );
}

function handleTerminalInput(
  data: string,
  {
    actions,
    connected,
    inputRef,
    promptLabel,
    terminal,
  }: {
    actions: DaemonUiSessionActions;
    connected: boolean;
    inputRef: MutableRefObject<string>;
    promptLabel: string;
    terminal: Terminal;
  },
) {
  for (const char of data) {
    if (char === '\r' || char === '\n') {
      const text = inputRef.current;
      inputRef.current = '';
      terminal.write('\r\n');
      if (!text.trim()) {
        terminal.write(promptAnsi(promptLabel));
        return;
      }
      if (!connected) {
        terminal.write('\x1b[31mnot connected\x1b[0m');
        terminal.write(promptAnsi(promptLabel));
        return;
      }
      if (text.trim() === '/cancel') {
        void actions.cancel();
      } else if (text.trim().startsWith('/model ')) {
        void actions.setModel(text.trim().slice('/model '.length));
      } else {
        void actions.sendPrompt(text);
      }
      return;
    }

    if (char === '\u007f') {
      const chars = Array.from(inputRef.current);
      if (chars.length === 0) continue;
      chars.pop();
      inputRef.current = chars.join('');
      terminal.write('\b \b');
      continue;
    }

    if (char === '\x03') {
      inputRef.current = '';
      terminal.write('^C\r\n');
      if (connected) void actions.cancel();
      terminal.write(promptAnsi(promptLabel));
      continue;
    }

    if (char === '\x15') {
      const count = Array.from(inputRef.current).length;
      inputRef.current = '';
      terminal.write('\b \b'.repeat(count));
      continue;
    }

    if (char >= ' ' || char === '\t') {
      inputRef.current += char;
      terminal.write(sanitizeEcho(char));
    }
  }
}

function sanitizeEcho(text: string): string {
  return sanitizeDaemonTerminalText(text);
}

function promptAnsi(promptLabel: string): string {
  return `\r\n\x1b[38;5;42m${sanitizeEcho(promptLabel)}\x1b[0m `;
}
