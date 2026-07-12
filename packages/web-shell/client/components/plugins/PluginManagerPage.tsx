import { useCallback, useMemo, useState } from 'react';
import type { SerializedMcpStatusMessage } from '../messages/McpStatusMessage';
import { ExtensionsManagerPage } from '../extensions/ExtensionsManagerPage';
import { AgentsManagerPage } from '../agents/AgentsManagerPage';
import { McpManagerPage } from '../mcp/McpManagerPage';
import { SkillsManagerPage } from '../skills/SkillsManagerPage';
import { ToolsManagerPage } from '../tools/ToolsManagerPage';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useI18n } from '../../i18n';
import type { EmbeddedManagerPage } from './manager-page';

type PluginTab = 'extensions' | 'mcp' | 'skills' | 'tools' | 'agents';

interface PluginManagerPageProps {
  mcpMessage: SerializedMcpStatusMessage | null;
  onClose: () => void;
  onUseSkill: (name: string) => void;
  onMessage: (text: string) => void;
}

export function PluginManagerPage({
  mcpMessage,
  onClose,
  onUseSkill,
  onMessage,
}: PluginManagerPageProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<PluginTab>('extensions');
  const [detailOpen, setDetailOpen] = useState(false);
  const [pageRevision, setPageRevision] = useState(0);

  const resetToRoot = useCallback(() => {
    setDetailOpen(false);
    setPageRevision((revision) => revision + 1);
  }, []);
  const embedded = useMemo<EmbeddedManagerPage>(
    () => ({
      rootLabel: t('plugins.title'),
      onRoot: resetToRoot,
      onDetailChange: setDetailOpen,
    }),
    [resetToRoot, t],
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value as PluginTab);
    setDetailOpen(false);
    setPageRevision((revision) => revision + 1);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      {!detailOpen ? (
        <div className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
          <TabsList className="h-8" aria-label={t('plugins.sections')}>
            <TabsTrigger value="extensions">
              {t('plugins.extensions')}
            </TabsTrigger>
            <TabsTrigger value="mcp">{t('plugins.mcp')}</TabsTrigger>
            <TabsTrigger value="skills">{t('plugins.skills')}</TabsTrigger>
            <TabsTrigger value="tools">{t('plugins.tools')}</TabsTrigger>
            <TabsTrigger value="agents">{t('plugins.agents')}</TabsTrigger>
          </TabsList>
        </div>
      ) : null}

      <TabsContent value={activeTab} className="mt-0">
        {activeTab === 'extensions' ? (
          <ExtensionsManagerPage
            key={`extensions-${pageRevision}`}
            onClose={onClose}
            embedded={embedded}
          />
        ) : activeTab === 'mcp' ? (
          mcpMessage ? (
            <McpManagerPage
              key={`mcp-${pageRevision}`}
              message={mcpMessage}
              onClose={onClose}
              embedded={embedded}
            />
          ) : (
            <div className="mx-auto grid w-full max-w-[800px] gap-3 sm:grid-cols-2">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          )
        ) : activeTab === 'skills' ? (
          <SkillsManagerPage
            key={`skills-${pageRevision}`}
            onClose={onClose}
            onUseSkill={onUseSkill}
            embedded={embedded}
          />
        ) : activeTab === 'tools' ? (
          <ToolsManagerPage
            key={`tools-${pageRevision}`}
            onClose={onClose}
            embedded={embedded}
          />
        ) : (
          <AgentsManagerPage
            key={`agents-${pageRevision}`}
            embedded={embedded}
            onMessage={onMessage}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
