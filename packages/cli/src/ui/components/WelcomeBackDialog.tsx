/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { type ProjectSummaryInfo } from '@qwen-code/qwen-code-core';
import {
  RadioButtonSelect,
  type RadioSelectItem,
} from './shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface WelcomeBackDialogProps {
  welcomeBackInfo: ProjectSummaryInfo;
  onSelect: (choice: 'restart' | 'continue') => void;
  onClose: () => void;
}

export function WelcomeBackDialog({
  welcomeBackInfo,
  onSelect,
  onClose,
}: WelcomeBackDialogProps) {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  const options: Array<RadioSelectItem<'restart' | 'continue'>> = [
    {
      key: 'restart',
      label: t('Start new chat session'),
      value: 'restart',
    },
    {
      key: 'continue',
      label: t('Continue previous conversation'),
      value: 'continue',
    },
  ];

  // Extract data from welcomeBackInfo
  const {
    timeAgo,
    goalContent,
    totalTasks = 0,
    doneCount = 0,
    inProgressCount = 0,
    pendingTasks = [],
  } = welcomeBackInfo;

  return (
    <box style={{ flexDirection: "column", borderStyle: "round", borderColor: Colors.AccentBlue, padding: 1, width: "100%" }} marginLeft={1}>
      <box style={{ flexDirection: "column" }} marginBottom={1}>
        <text color={Colors.AccentBlue} bold>
          {t('Welcome back! (Last updated: {{timeAgo}})', {
            timeAgo: timeAgo || '',
          })}
        </text>
      </box>

      {/* Overall Goal Section */}
      {goalContent && (
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text color={Colors.Foreground} bold>
            {t('Overall Goal:')}
          </text>
          <box marginTop={1} paddingLeft={2}>
            <text color={Colors.Gray}>{goalContent}</text>
          </box>
        </box>
      )}

      {/* Current Plan Section */}
      {totalTasks > 0 && (
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text color={Colors.Foreground} bold>
            {t('Current Plan:')}
          </text>
          <box marginTop={1} paddingLeft={2}>
            <text color={Colors.Gray}>
              {t('Progress: {{done}}/{{total}} tasks completed', {
                done: String(doneCount),
                total: String(totalTasks),
              })}
              {inProgressCount > 0 &&
                t(', {{inProgress}} in progress', {
                  inProgress: String(inProgressCount),
                })}
            </text>
          </box>

          {pendingTasks.length > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1} paddingLeft={2}>
              <text color={Colors.Foreground} bold>
                {t('Pending Tasks:')}
              </text>
              {pendingTasks.map((task: string, index: number) => (
                <text key={index} color={Colors.Gray}>
                  • {task}
                </text>
              ))}
            </box>
          )}
        </box>
      )}

      {/* Action Selection */}
      <box style={{ flexDirection: "column" }} marginTop={1}>
        <text bold>{t('What would you like to do?')}</text>
        <text>{t('Choose how to proceed with your session:')}</text>
      </box>

      <box marginTop={1}>
        <RadioButtonSelect items={options} onSelect={onSelect} isFocused />
      </box>
    </box>
  );
}
