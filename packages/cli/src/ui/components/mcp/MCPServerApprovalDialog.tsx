/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type React from 'react';
import { theme } from '../../semantic-colors.js';
import type { RadioSelectItem } from '../shared/RadioButtonSelect.js';
import { RadioButtonSelect } from '../shared/RadioButtonSelect.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import type { PendingMcpServer } from '../../hooks/useMcpApproval.js';

export enum McpApprovalChoice {
  APPROVE = 'approve',
  APPROVE_ALL = 'approve_all',
  REJECT = 'reject',
}

interface MCPServerApprovalDialogProps {
  /** Name of the gated server currently being decided. */
  serverName: string;
  /** One-line summary of its transport/config (e.g. `node slack.js (stdio)`). */
  summary: string;
  /** Where the config came from (e.g. `.mcp.json`, `.qwen/settings.json`). */
  source: string;
  /** All pending servers that would be approved by "Approve all". */
  pendingServers: PendingMcpServer[];
  /** How many more pending gated servers follow this one. */
  remaining: number;
  onSelect: (choice: McpApprovalChoice) => void;
}

export const MCPServerApprovalDialog: React.FC<
  MCPServerApprovalDialogProps
> = ({ serverName, summary, source, pendingServers, remaining, onSelect }) => {
  // Esc declines this server (treated as reject), matching the folder-trust
  // dialog's escape-to-deny convention.
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onSelect(McpApprovalChoice.REJECT);
      }
    },
    { isActive: true },
  );

  const options: Array<RadioSelectItem<McpApprovalChoice>> = [
    {
      label: 'Approve this server',
      value: McpApprovalChoice.APPROVE,
      key: 'approve',
    },
    {
      label: 'Approve all pending servers in this workspace',
      value: McpApprovalChoice.APPROVE_ALL,
      key: 'approve_all',
    },
    {
      label: 'Reject (esc)',
      value: McpApprovalChoice.REJECT,
      key: 'reject',
    },
  ];

  return (
    <box style={{ flexDirection: "column" }}>
      <box style={{ flexDirection: "column", borderStyle: "round", borderColor: theme.status.warning, padding: 1, width: "100%" }} marginLeft={1}>
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text bold color={theme.text.primary}>
            {`Untrusted MCP server in ${source}`}
          </text>
          <text color={theme.text.primary}>
            {`This workspace declares an MCP server. Approving lets Qwen Code start it and run its tools. Approval is bound to this exact configuration — if ${source} changes, you will be asked again.`}
          </text>
        </box>

        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text color={theme.text.primary}>
            <text bold>{serverName}</text>
            {`  ${summary}`}
          </text>
          {remaining > 0 && (
            <box style={{ flexDirection: "column" }} marginTop={1}>
              <text color={theme.text.secondary}>
                Approve all will trust these servers:
              </text>
              {pendingServers.map((server) => (
                <text key={server.name} color={theme.text.secondary}>
                  {`  ${server.name}  ${server.summary}`}
                </text>
              ))}
            </box>
          )}
        </box>

        <RadioButtonSelect items={options} onSelect={onSelect} isFocused />
      </box>
    </box>
  );
};
