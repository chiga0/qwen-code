/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { GoalSnapshotV2, GoalStateCause } from '@qwen-code/qwen-code-core';
import { theme } from '../../semantic-colors.js';
import { ICON } from '../../constants.js';
import { formatDuration } from '../../utils/formatters.js';
import { isTerminalGoalStatusKind, type GoalStatusKind } from '../../types.js';

interface LegacyGoalStatusMessageProps {
  kind: GoalStatusKind;
  condition: string;
  iterations?: number;
  durationMs?: number;
  lastReason?: string;
  snapshot?: never;
  cause?: never;
}

interface GoalStateMessageProps {
  snapshot: GoalSnapshotV2;
  cause?: GoalStateCause;
  kind?: never;
  condition?: never;
  iterations?: never;
  durationMs?: never;
  lastReason?: never;
}

type GoalStatusMessageProps =
  | LegacyGoalStatusMessageProps
  | GoalStateMessageProps;

const pluralTurns = (n: number) => (n === 1 ? 'turn' : 'turns');

function assertNeverGoalStatusKind(kind: never): never {
  throw new Error(`Unexpected goal status kind: ${kind}`);
}

const GoalStateCard: React.FC<GoalStateMessageProps> = ({
  snapshot,
  cause,
}) => {
  const goal = snapshot.goal;
  if (!goal) {
    if (cause !== 'clear') return null;
    return (
      <box style={{ flexDirection: "row" }}>
        <box style={{ width: 2, flexShrink: 0 }}>
          <text color={theme.text.secondary}>{ICON.CIRCLE_EMPTY}</text>
        </box>
        <text color={theme.text.secondary}>Goal cleared</text>
      </box>
    );
  }

  const lifecycle = (() => {
    switch (goal.status) {
      case 'active':
        if (snapshot.activity === 'verifying') {
          return {
            prefix: ICON.CIRCLE_EMPTY,
            color: theme.text.secondary,
            title: 'Goal checking',
          };
        }
        return {
          prefix: ICON.BULLSEYE,
          color: theme.text.accent,
          title:
            snapshot.activity === 'running' ? 'Goal running' : 'Goal active',
        };
      case 'paused':
        return {
          prefix: '!',
          color: theme.status.warning,
          title: 'Goal paused',
        };
      case 'blocked':
        return {
          prefix: ICON.CROSS,
          color: theme.status.error,
          title: 'Goal blocked',
        };
      case 'usage_limited':
        return {
          prefix: '!',
          color: theme.status.warning,
          title: 'Goal usage limited',
        };
      case 'complete':
        return {
          prefix: ICON.CHECK,
          color: theme.status.success,
          title: 'Goal complete',
        };
      default: {
        const exhaustive: never = goal.status;
        void exhaustive;
        throw new Error('Unexpected Goal status');
      }
    }
  })();
  const stats: string[] = [];
  if (goal.turnCount > 0) {
    stats.push(`${goal.turnCount} ${pluralTurns(goal.turnCount)}`);
  }
  if (goal.activeTimeMs > 0) {
    stats.push(formatDuration(goal.activeTimeMs, { hideTrailingZeros: true }));
  }
  const subtitle = stats.length > 0 ? stats.join(' · ') : null;
  const reason =
    goal.status !== 'active' || snapshot.activity === 'verifying'
      ? goal.lastReason?.trim()
      : undefined;

  return (
    <box style={{ flexDirection: "row" }}>
      <box style={{ width: 2, flexShrink: 0 }}>
        <text color={lifecycle.color}>{lifecycle.prefix}</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text color={lifecycle.color}>
          {lifecycle.title}
          {subtitle ? (
            <text color={theme.text.secondary}> · {subtitle}</text>
          ) : null}
        </text>
        <box style={{ flexDirection: "row" }}>
          <box style={{ flexShrink: 0 }} marginRight={1}>
            <text color={theme.text.secondary}>Goal:</text>
          </box>
          <box style={{ flexGrow: 1 }}>
            <text wrap="wrap">{goal.objective}</text>
          </box>
        </box>
        {reason ? (
          <text color={theme.text.secondary} wrap="wrap">
            Reason: {reason}
          </text>
        ) : null}
      </box>
    </box>
  );
};

const GoalStatusMessageInternal: React.FC<GoalStatusMessageProps> = (props) => {
  if (props.snapshot) return <GoalStateCard {...props} />;
  const { kind, condition, iterations, durationMs, lastReason } = props;
  if (kind === 'checking') {
    const reason = lastReason?.trim();
    return (
      <box style={{ flexDirection: "row" }}>
        <box style={{ width: 2, flexShrink: 0 }}>
          <text color={theme.text.secondary}>{ICON.CIRCLE_EMPTY}</text>
        </box>
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <text color={theme.text.secondary}>
            Goal check
            {typeof iterations === 'number' && iterations > 0
              ? ` · turn ${iterations}`
              : ''}{' '}
            · not yet met
          </text>
          <text color={theme.text.secondary} wrap="wrap">
            Goal: {condition}
          </text>
          {reason ? (
            <text color={theme.text.secondary} wrap="wrap">
              Judge: {reason}
            </text>
          ) : null}
        </box>
      </box>
    );
  }

  const { prefix, prefixColor, title } = (() => {
    switch (kind) {
      case 'set':
        return {
          prefix: ICON.BULLSEYE,
          prefixColor: theme.text.accent,
          title: 'Goal set',
        };
      case 'achieved':
        return {
          prefix: ICON.CHECK,
          prefixColor: theme.status.success,
          title: 'Goal achieved',
        };
      case 'cleared':
        return {
          prefix: ICON.CIRCLE_EMPTY,
          prefixColor: theme.text.secondary,
          title: 'Goal cleared',
        };
      case 'failed':
        return {
          prefix: ICON.CROSS,
          prefixColor: theme.status.error,
          title: 'Goal could not be achieved',
        };
      case 'aborted':
        return {
          prefix: '!',
          prefixColor: theme.status.warning,
          title: 'Goal aborted',
        };
      case 'paused':
        return {
          prefix: '!',
          prefixColor: theme.status.warning,
          title: 'Goal paused',
        };
      default:
        return assertNeverGoalStatusKind(kind);
    }
  })();

  const stats: string[] = [];
  if (typeof iterations === 'number' && iterations > 0) {
    stats.push(`${iterations} ${pluralTurns(iterations)}`);
  }
  if (typeof durationMs === 'number') {
    stats.push(formatDuration(durationMs, { hideTrailingZeros: true }));
  }
  const subtitle = stats.length > 0 ? stats.join(' · ') : null;

  return (
    <box style={{ flexDirection: "row" }}>
      <box style={{ width: 2, flexShrink: 0 }}>
        <text color={prefixColor}>{prefix}</text>
      </box>
      <box style={{ flexGrow: 1, flexDirection: "column" }}>
        <text color={prefixColor}>
          {title}
          {subtitle ? (
            <text color={theme.text.secondary}> · {subtitle}</text>
          ) : null}
        </text>
        <box style={{ flexDirection: "row" }}>
          <box style={{ flexShrink: 0 }} marginRight={1}>
            <text color={theme.text.secondary}>Goal:</text>
          </box>
          <box style={{ flexGrow: 1 }}>
            <text wrap="wrap">{condition}</text>
          </box>
        </box>
        {isTerminalGoalStatusKind(kind) && lastReason?.trim() ? (
          <text color={theme.text.secondary} wrap="wrap">
            Last check: {lastReason.trim()}
          </text>
        ) : null}
      </box>
    </box>
  );
};

export const GoalStatusMessage = React.memo(GoalStatusMessageInternal);
