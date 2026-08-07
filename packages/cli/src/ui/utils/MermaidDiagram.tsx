/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { MaxSizedBox } from '../components/shared/MaxSizedBox.js';
import { renderMermaidVisual } from './mermaidVisualRenderer.js';
import {
  renderMermaidImageAsync,
  type MermaidImageRenderResult,
} from './mermaidImageRenderer.js';
import { useTerminalOutput } from '../contexts/TerminalOutputContext.js';

interface MermaidDiagramProps {
  source: string;
  sourceCopyCommand: string;
  contentWidth: number;
  isPending: boolean;
  availableTerminalHeight?: number;
}

const MERMAID_PADDING = 1;

interface MermaidImageState {
  key: string;
  result: MermaidImageRenderResult;
}

function getRenderErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const MermaidDiagramInternal: React.FC<MermaidDiagramProps> = ({
  source,
  sourceCopyCommand,
  contentWidth,
  isPending,
  availableTerminalHeight,
}) => {
  const writeRaw = useTerminalOutput();
  const preparedTerminalImageSequence = React.useRef<string | null>(null);
  const [imageState, setImageState] = React.useState<MermaidImageState | null>(
    null,
  );
  const innerWidth = Math.max(8, contentWidth - MERMAID_PADDING);
  const imageKey = `${source}\0${innerWidth}\0${
    availableTerminalHeight ?? 'auto'
  }`;
  const image =
    imageState?.key === imageKey && !isPending ? imageState.result : null;
  const visual = React.useMemo(
    () => renderMermaidVisual(source, innerWidth),
    [source, innerWidth],
  );

  React.useEffect(() => {
    if (isPending) {
      setImageState(null);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    void renderMermaidImageAsync({
      source,
      contentWidth: innerWidth,
      availableTerminalHeight,
      signal: abortController.signal,
    }).then(
      (result) => {
        if (!cancelled) {
          setImageState({ key: imageKey, result });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setImageState({
            key: imageKey,
            result: {
              kind: 'unavailable',
              reason: getRenderErrorReason(error),
            },
          });
        }
      },
    );

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [availableTerminalHeight, imageKey, innerWidth, isPending, source]);

  const kittySequence =
    image?.kind === 'terminal-image' &&
    image.protocol === 'kitty' &&
    image.placeholder
      ? image.sequence
      : null;

  React.useEffect(() => {
    preparedTerminalImageSequence.current = null;
  }, [imageKey]);

  React.useEffect(() => {
    if (
      !kittySequence ||
      preparedTerminalImageSequence.current === kittySequence
    ) {
      return;
    }
    preparedTerminalImageSequence.current = kittySequence;
    process.nextTick(() => writeRaw(kittySequence));
  }, [kittySequence, writeRaw]);

  const titleWithSourceHint = (title: string) =>
    `${title} · source: ${sourceCopyCommand}`;

  if (
    image?.kind === 'terminal-image' &&
    image.protocol === 'kitty' &&
    image.placeholder
  ) {
    return (
      <box paddingLeft={MERMAID_PADDING} style={{ flexDirection: "column", width: contentWidth, flexShrink: 0 }}>
        <text bold color={theme.text.accent}>
          {titleWithSourceHint(visual.title)}
        </text>
        <MaxSizedBox
          maxHeight={availableTerminalHeight}
          maxWidth={innerWidth}
          overflowDirection="bottom"
        >
          {image.placeholder.lines.map((line, index) => (
            <box key={index}>
              <text color={image.placeholder!.color} wrap="truncate-end">
                {line}
              </text>
            </box>
          ))}
        </MaxSizedBox>
      </box>
    );
  }

  if (image?.kind === 'ansi') {
    return (
      <box paddingLeft={MERMAID_PADDING} style={{ flexDirection: "column", width: contentWidth, flexShrink: 0 }}>
        <text bold color={theme.text.accent}>
          {titleWithSourceHint(visual.title)}
        </text>
        <MaxSizedBox
          maxHeight={availableTerminalHeight}
          maxWidth={innerWidth}
          overflowDirection="bottom"
        >
          {image.lines.map((line, index) => (
            <box key={index}>
              <text>{line || ' '}</text>
            </box>
          ))}
        </MaxSizedBox>
      </box>
    );
  }

  return (
    <box paddingLeft={MERMAID_PADDING} style={{ flexDirection: "column", width: contentWidth, flexShrink: 0 }}>
      <text bold color={theme.text.accent}>
        {titleWithSourceHint(visual.title)}
      </text>
      <MaxSizedBox
        maxHeight={availableTerminalHeight}
        maxWidth={innerWidth}
        overflowDirection="bottom"
      >
        {visual.lines.map((line, index) => (
          <box key={index}>
            <text color={theme.text.primary}>{line || ' '}</text>
          </box>
        ))}
      </MaxSizedBox>
      {visual.warning && (
        <text color={theme.text.secondary} wrap="wrap">
          {visual.warning}
        </text>
      )}
      {!isPending &&
        image?.kind === 'unavailable' &&
        image.showReason !== false && (
          <text color={theme.text.secondary} wrap="wrap">
            Image rendering unavailable: {image.reason}
          </text>
        )}
    </box>
  );
};

export const MermaidDiagram = React.memo(MermaidDiagramInternal);
