/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../semantic-colors.js';
import type { DeviceAuthorizationData } from '@qwen-code/qwen-code-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface QwenOAuthProgressProps {
  onTimeout: () => void;
  onCancel: () => void;
  deviceAuth?: DeviceAuthorizationData;
  authStatus?:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage?: string | null;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function QwenOAuthProgress({
  onTimeout,
  onCancel,
  deviceAuth,
  authStatus,
  authMessage,
}: QwenOAuthProgressProps): React.JSX.Element {
  const defaultTimeout = deviceAuth?.expires_in || 300; // Default 5 minutes
  const [timeRemaining, setTimeRemaining] = useState<number>(defaultTimeout);
  const [dots, setDots] = useState<string>('...');

  useKeypress(
    (key) => {
      if (authStatus === 'timeout' || authStatus === 'error') {
        onCancel();
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        onCancel();
      }
    },
    { isActive: true },
  );

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout]);

  // Animated dots — cycle through fixed-width patterns to avoid layout shift
  useEffect(() => {
    const dotFrames = ['.  ', '.. ', '...'];
    let frameIndex = 0;
    const dotsTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % dotFrames.length;
      setDots(dotFrames[frameIndex]!);
    }, 500);

    return () => clearInterval(dotsTimer);
  }, []);

  // Handle timeout state
  if (authStatus === 'timeout') {
    return (
      <box style={{ borderStyle: "single", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
        <text bold color={theme.status.error}>
          {t('Qwen OAuth Authentication Timeout')}
        </text>

        <box marginTop={1}>
          <text>
            {authMessage ||
              t(
                'OAuth token expired (over {{seconds}} seconds). Please select authentication method again.',
                {
                  seconds: defaultTimeout.toString(),
                },
              )}
          </text>
        </box>

        <box marginTop={1}>
          <text color={theme.text.secondary}>
            {t('Press any key to return to authentication type selection.')}
          </text>
        </box>
      </box>
    );
  }

  if (authStatus === 'error') {
    return (
      <box style={{ borderStyle: "single", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
        <text bold color={theme.status.error}>
          {t('Qwen OAuth Authentication Error')}
        </text>

        <box marginTop={1}>
          <text>
            {authMessage ||
              t('An error occurred during authentication. Please try again.')}
          </text>
        </box>

        <box marginTop={1}>
          <text color={theme.text.secondary}>
            {t('Press any key to return to authentication type selection.')}
          </text>
        </box>
      </box>
    );
  }

  // Show loading state when no device auth is available yet
  if (!deviceAuth) {
    return (
      <box style={{ borderStyle: "single", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
        <text bold>{t('Qwen OAuth Authentication')}</text>

        <box marginTop={1} style={{ flexDirection: "column" }}>
          <text>{t('Waiting for Qwen OAuth authentication...')}</text>
          <text>
            {t('Time remaining:')} {formatTime(timeRemaining)}
          </text>
        </box>

        <box marginTop={1}>
          <text color={theme.text.secondary}>{t('Esc to cancel')}</text>
        </box>
      </box>
    );
  }

  return (
    <box style={{ borderStyle: "single", borderColor: theme.border.default, flexDirection: "column", padding: 1, width: "100%" }}>
      <text bold>{t('Qwen OAuth Authentication')}</text>

      <box marginTop={1}>
        <text>{t('Please visit this URL to authorize:')}</text>
      </box>

      <Link url={deviceAuth.verification_uri_complete || ''} fallback={false}>
        <text color={theme.text.link} bold>
          {deviceAuth.verification_uri_complete}
        </text>
      </Link>

      <box marginTop={1} style={{ flexDirection: "column" }}>
        <text>
          {t('Waiting for authorization')}
          {dots}
        </text>
        <text>
          {t('Time remaining:')} {formatTime(timeRemaining)}
        </text>
      </box>

      <box marginTop={1}>
        <text color={theme.text.secondary}>{t('Esc to cancel')}</text>
      </box>
    </box>
  );
}
