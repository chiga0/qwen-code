/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../../semantic-colors.js';
import { ICON } from '../../../constants.js';
import { useKeypress } from '../../../hooks/useKeypress.js';
import { keyMatchers, Command } from '../../../keyMatchers.js';
import { type SubagentConfig } from '@qwen-code/qwen-code-core';
import { t } from '../../../../i18n/index.js';

interface NavigationState {
  currentBlock: 'project' | 'user' | 'builtin' | 'extension';
  projectIndex: number;
  userIndex: number;
  builtinIndex: number;
  extensionIndex: number;
}

interface AgentSelectionStepProps {
  availableAgents: SubagentConfig[];
  onAgentSelect: (agentIndex: number) => void;
}

export const AgentSelectionStep = ({
  availableAgents,
  onAgentSelect,
}: AgentSelectionStepProps) => {
  const [navigation, setNavigation] = useState<NavigationState>({
    currentBlock: 'project',
    projectIndex: 0,
    userIndex: 0,
    builtinIndex: 0,
    extensionIndex: 0,
  });

  // Group agents by level
  const projectAgents = useMemo(
    () => availableAgents.filter((agent) => agent.level === 'project'),
    [availableAgents],
  );
  const userAgents = useMemo(
    () => availableAgents.filter((agent) => agent.level === 'user'),
    [availableAgents],
  );
  const builtinAgents = useMemo(
    () => availableAgents.filter((agent) => agent.level === 'builtin'),
    [availableAgents],
  );
  const extensionAgents = useMemo(
    () => availableAgents.filter((agent) => agent.level === 'extension'),
    [availableAgents],
  );
  const projectNames = useMemo(
    () => new Set(projectAgents.map((agent) => agent.name)),
    [projectAgents],
  );

  // Initialize navigation state when agents are loaded (only once)
  useEffect(() => {
    if (projectAgents.length > 0) {
      setNavigation((prev) => ({ ...prev, currentBlock: 'project' }));
    } else if (userAgents.length > 0) {
      setNavigation((prev) => ({ ...prev, currentBlock: 'user' }));
    } else if (builtinAgents.length > 0) {
      setNavigation((prev) => ({ ...prev, currentBlock: 'builtin' }));
    } else if (extensionAgents.length > 0) {
      setNavigation((prev) => ({ ...prev, currentBlock: 'extension' }));
    }
  }, [projectAgents, userAgents, builtinAgents, extensionAgents]);

  // Custom keyboard navigation
  useKeypress(
    (key) => {
      const { name } = key;

      if (keyMatchers[Command.SELECTION_UP](key)) {
        setNavigation((prev) => {
          if (prev.currentBlock === 'project') {
            if (prev.projectIndex > 0) {
              return { ...prev, projectIndex: prev.projectIndex - 1 };
            } else if (builtinAgents.length > 0) {
              // Move to last item in builtin block
              return {
                ...prev,
                currentBlock: 'builtin',
                builtinIndex: builtinAgents.length - 1,
              };
            } else if (userAgents.length > 0) {
              // Move to last item in user block
              return {
                ...prev,
                currentBlock: 'user',
                userIndex: userAgents.length - 1,
              };
            } else if (extensionAgents.length > 0) {
              // Move to last item in extension block
              return {
                ...prev,
                currentBlock: 'extension',
                extensionIndex: extensionAgents.length - 1,
              };
            } else {
              // Wrap to last item in project block
              return { ...prev, projectIndex: projectAgents.length - 1 };
            }
          } else if (prev.currentBlock === 'user') {
            if (prev.userIndex > 0) {
              return { ...prev, userIndex: prev.userIndex - 1 };
            } else if (projectAgents.length > 0) {
              // Move to last item in project block
              return {
                ...prev,
                currentBlock: 'project',
                projectIndex: projectAgents.length - 1,
              };
            } else if (builtinAgents.length > 0) {
              // Move to last item in builtin block
              return {
                ...prev,
                currentBlock: 'builtin',
                builtinIndex: builtinAgents.length - 1,
              };
            } else if (extensionAgents.length > 0) {
              // Move to last item in extension block
              return {
                ...prev,
                currentBlock: 'extension',
                extensionIndex: extensionAgents.length - 1,
              };
            } else {
              // Wrap to last item in user block
              return { ...prev, userIndex: userAgents.length - 1 };
            }
          } else if (prev.currentBlock === 'builtin') {
            // builtin block
            if (prev.builtinIndex > 0) {
              return { ...prev, builtinIndex: prev.builtinIndex - 1 };
            } else if (userAgents.length > 0) {
              // Move to last item in user block
              return {
                ...prev,
                currentBlock: 'user',
                userIndex: userAgents.length - 1,
              };
            } else if (projectAgents.length > 0) {
              // Move to last item in project block
              return {
                ...prev,
                currentBlock: 'project',
                projectIndex: projectAgents.length - 1,
              };
            } else if (extensionAgents.length > 0) {
              // Move to last item in extension block
              return {
                ...prev,
                currentBlock: 'extension',
                extensionIndex: extensionAgents.length - 1,
              };
            } else {
              // Wrap to last item in builtin block
              return { ...prev, builtinIndex: builtinAgents.length - 1 };
            }
          } else {
            // extension block
            if (prev.extensionIndex > 0) {
              return { ...prev, extensionIndex: prev.extensionIndex - 1 };
            } else if (userAgents.length > 0) {
              // Move to last item in user block
              return {
                ...prev,
                currentBlock: 'user',
                userIndex: userAgents.length - 1,
              };
            } else if (projectAgents.length > 0) {
              // Move to last item in project block
              return {
                ...prev,
                currentBlock: 'project',
                projectIndex: projectAgents.length - 1,
              };
            } else if (builtinAgents.length > 0) {
              // Move to last item in builtin block
              return {
                ...prev,
                currentBlock: 'builtin',
                builtinIndex: builtinAgents.length - 1,
              };
            } else {
              // Wrap to last item in extension block
              return { ...prev, extensionIndex: extensionAgents.length - 1 };
            }
          }
        });
      } else if (keyMatchers[Command.SELECTION_DOWN](key)) {
        setNavigation((prev) => {
          if (prev.currentBlock === 'project') {
            if (prev.projectIndex < projectAgents.length - 1) {
              return { ...prev, projectIndex: prev.projectIndex + 1 };
            } else if (userAgents.length > 0) {
              // Move to first item in user block
              return { ...prev, currentBlock: 'user', userIndex: 0 };
            } else if (builtinAgents.length > 0) {
              // Move to first item in builtin block
              return { ...prev, currentBlock: 'builtin', builtinIndex: 0 };
            } else if (extensionAgents.length > 0) {
              // Move to first item in extension block
              return { ...prev, currentBlock: 'extension', extensionIndex: 0 };
            } else {
              // Wrap to first item in project block
              return { ...prev, projectIndex: 0 };
            }
          } else if (prev.currentBlock === 'user') {
            if (prev.userIndex < userAgents.length - 1) {
              return { ...prev, userIndex: prev.userIndex + 1 };
            } else if (builtinAgents.length > 0) {
              // Move to first item in builtin block
              return { ...prev, currentBlock: 'builtin', builtinIndex: 0 };
            } else if (extensionAgents.length > 0) {
              // Move to first item in extension block
              return { ...prev, currentBlock: 'extension', extensionIndex: 0 };
            } else if (projectAgents.length > 0) {
              // Move to first item in project block
              return { ...prev, currentBlock: 'project', projectIndex: 0 };
            } else {
              // Wrap to first item in user block
              return { ...prev, userIndex: 0 };
            }
          } else if (prev.currentBlock === 'builtin') {
            // builtin block
            if (prev.builtinIndex < builtinAgents.length - 1) {
              return { ...prev, builtinIndex: prev.builtinIndex + 1 };
            } else if (extensionAgents.length > 0) {
              // Move to first item in extension block
              return { ...prev, currentBlock: 'extension', extensionIndex: 0 };
            } else if (projectAgents.length > 0) {
              // Move to first item in project block
              return { ...prev, currentBlock: 'project', projectIndex: 0 };
            } else if (userAgents.length > 0) {
              // Move to first item in user block
              return { ...prev, currentBlock: 'user', userIndex: 0 };
            } else {
              // Wrap to first item in builtin block
              return { ...prev, builtinIndex: 0 };
            }
          } else {
            // extension block
            if (prev.extensionIndex < extensionAgents.length - 1) {
              return { ...prev, extensionIndex: prev.extensionIndex + 1 };
            } else if (projectAgents.length > 0) {
              // Move to first item in project block
              return { ...prev, currentBlock: 'project', projectIndex: 0 };
            } else if (userAgents.length > 0) {
              // Move to first item in user block
              return { ...prev, currentBlock: 'user', userIndex: 0 };
            } else if (builtinAgents.length > 0) {
              // Move to first item in builtin block
              return { ...prev, currentBlock: 'builtin', builtinIndex: 0 };
            } else {
              // Wrap to first item in extension block
              return { ...prev, extensionIndex: 0 };
            }
          }
        });
      } else if (name === 'return' || name === 'space') {
        // Calculate global index and select current item
        let globalIndex: number;
        if (navigation.currentBlock === 'project') {
          globalIndex = navigation.projectIndex;
        } else if (navigation.currentBlock === 'user') {
          // User agents come after project agents in the availableAgents array
          globalIndex = projectAgents.length + navigation.userIndex;
        } else if (navigation.currentBlock === 'builtin') {
          // Builtin agents come after project and user agents in the availableAgents array
          globalIndex =
            projectAgents.length + userAgents.length + navigation.builtinIndex;
        } else {
          // Extension agents come after project, user, and builtin agents
          globalIndex =
            projectAgents.length +
            userAgents.length +
            builtinAgents.length +
            navigation.extensionIndex;
        }

        if (globalIndex >= 0 && globalIndex < availableAgents.length) {
          onAgentSelect(globalIndex);
        }
      }
    },
    { isActive: true },
  );

  if (availableAgents.length === 0) {
    return (
      <box style={{ flexDirection: "column" }}>
        <text color={theme.text.secondary}>{t('No subagents found.')}</text>
        <text color={theme.text.secondary}>
          {t("Use '/agents create' to create your first subagent.")}
        </text>
      </box>
    );
  }

  // Render custom radio button items
  const renderAgentItem = (
    agent: {
      name: string;
      level: 'project' | 'user' | 'builtin' | 'session' | 'extension';
      isBuiltin?: boolean;
    },
    index: number,
    isSelected: boolean,
  ) => {
    const textColor = isSelected ? theme.text.accent : theme.text.primary;

    return (
      <box key={`${agent.name}-${agent.level}`} style={{ alignItems: "center" }}>
        <box minWidth={2} style={{ flexShrink: 0 }}>
          <text color={isSelected ? theme.text.accent : theme.text.primary}>
            {isSelected ? ICON.CIRCLE_FILLED : ' '}
          </text>
        </box>
        <text color={textColor} wrap="truncate">
          {agent.name}
          {agent.isBuiltin && (
            <text color={isSelected ? theme.text.accent : theme.text.secondary}>
              {' '}
              {t('(built-in)')}
            </text>
          )}
          {agent.level === 'user' && projectNames.has(agent.name) && (
            <text
              color={isSelected ? theme.status.warning : theme.text.secondary}
            >
              {' '}
              {t('(overridden by project level agent)')}
            </text>
          )}
        </text>
      </box>
    );
  };

  // Calculate enabled agents count (excluding conflicted user-level agents)
  const enabledAgentsCount =
    projectAgents.length +
    userAgents.filter((agent) => !projectNames.has(agent.name)).length +
    builtinAgents.length +
    extensionAgents.length;

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Project Level Agents */}
      {projectAgents.length > 0 && (
        <box style={{ flexDirection: "column" }} marginBottom={1}>
          <text color={theme.text.primary} bold>
            {t('Project Level ({{path}})', {
              path: projectAgents[0].filePath?.replace(/\/[^/]+$/, '') || '',
            })}
          </text>
          <box marginTop={1} style={{ flexDirection: "column" }}>
            {projectAgents.map((agent, index) => {
              const isSelected =
                navigation.currentBlock === 'project' &&
                navigation.projectIndex === index;
              return renderAgentItem(agent, index, isSelected);
            })}
          </box>
        </box>
      )}

      {/* User Level Agents */}
      {userAgents.length > 0 && (
        <box style={{ flexDirection: "column" }} marginBottom={builtinAgents.length > 0 ? 1 : 0}>
          <text color={theme.text.primary} bold>
            {t('User Level ({{path}})', {
              path: userAgents[0].filePath?.replace(/\/[^/]+$/, '') || '',
            })}
          </text>
          <box marginTop={1} style={{ flexDirection: "column" }}>
            {userAgents.map((agent, index) => {
              const isSelected =
                navigation.currentBlock === 'user' &&
                navigation.userIndex === index;
              return renderAgentItem(agent, index, isSelected);
            })}
          </box>
        </box>
      )}

      {/* Built-in Agents */}
      {builtinAgents.length > 0 && (
        <box style={{ flexDirection: "column" }} marginBottom={extensionAgents.length > 0 ? 1 : 0}>
          <text color={theme.text.primary} bold>
            {t('Built-in Agents')}
          </text>
          <box marginTop={1} style={{ flexDirection: "column" }}>
            {builtinAgents.map((agent, index) => {
              const isSelected =
                navigation.currentBlock === 'builtin' &&
                navigation.builtinIndex === index;
              return renderAgentItem(agent, index, isSelected);
            })}
          </box>
        </box>
      )}

      {/* Extension Agents */}
      {extensionAgents.length > 0 && (
        <box style={{ flexDirection: "column" }}>
          <text color={theme.text.primary} bold>
            {t('Extension Agents')}
          </text>
          <box marginTop={1} style={{ flexDirection: "column" }}>
            {extensionAgents.map((agent, index) => {
              const isSelected =
                navigation.currentBlock === 'extension' &&
                navigation.extensionIndex === index;
              return renderAgentItem(agent, index, isSelected);
            })}
          </box>
        </box>
      )}

      {/* Agent count summary */}
      {(projectAgents.length > 0 ||
        userAgents.length > 0 ||
        builtinAgents.length > 0 ||
        extensionAgents.length > 0) && (
        <box marginTop={1}>
          <text color={theme.text.secondary}>
            {t('Using: {{count}} agents', {
              count: enabledAgentsCount.toString(),
            })}
          </text>
        </box>
      )}
    </box>
  );
};
