import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BoxIcon,
  DatabaseIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  WrenchIcon,
} from 'lucide-react';
import type {
  DaemonWorkspaceActions,
  DaemonWorkspaceMcpResourceStatus,
  DaemonWorkspaceMcpResourcesStatus,
  DaemonWorkspaceMcpServerStatus,
  DaemonWorkspaceMcpToolStatus,
  DaemonWorkspaceMcpToolsStatus,
} from '@qwen-code/webui/daemon-react-sdk';
import { useMcp } from '@qwen-code/webui/daemon-react-sdk';
import { useI18n } from '../../i18n';
import type { SerializedMcpStatusMessage } from '../messages/McpStatusMessage';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { Button } from '../ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import type { EmbeddedManagerPage } from '../plugins/manager-page';

type McpStatus = Awaited<ReturnType<DaemonWorkspaceActions['loadMcpStatus']>>;
type T = ReturnType<typeof useI18n>['t'];
type SourceFilter = 'all' | 'user' | 'project' | 'extension';
type McpServerAction = {
  id: 'reconnect' | 'enable' | 'disable' | 'authenticate' | 'clear-auth';
  label: string;
};

interface McpManagerPageProps {
  message: SerializedMcpStatusMessage;
  onClose: () => void;
  embedded?: EmbeddedManagerPage;
}

function extractErrorDetail(error: unknown): string {
  if (error && typeof error === 'object') {
    const body = (error as { body?: unknown }).body;
    if (body && typeof body === 'object') {
      const data = (body as { data?: unknown }).data;
      if (data && typeof data === 'object') {
        const details = (data as { details?: unknown }).details;
        if (typeof details === 'string' && details) return details;
      }
      const bodyError = (body as { error?: unknown }).error;
      if (typeof bodyError === 'string' && bodyError) return bodyError;
    }
    if (error instanceof Error && error.message) return error.message;
  }
  return String(error);
}

function sourceValue(server: DaemonWorkspaceMcpServerStatus): SourceFilter {
  if (server.source === 'project') return 'project';
  if (server.source === 'extension' || server.extensionName) return 'extension';
  return 'user';
}

function sourceLabel(server: DaemonWorkspaceMcpServerStatus, t: T): string {
  const source = sourceValue(server);
  return source === 'project'
    ? t('mcp.source.project')
    : source === 'extension'
      ? t('mcp.source.extension')
      : t('mcp.source.user');
}

function statusLabel(server: DaemonWorkspaceMcpServerStatus, t: T): string {
  if (server.disabled) return t('mcp.status.disabled');
  if (server.mcpStatus === 'connected') return t('mcp.status.connected');
  if (server.mcpStatus === 'connecting') return t('mcp.status.connecting');
  return t('mcp.status.disconnectedTitle');
}

function formatServerCommand(
  server: DaemonWorkspaceMcpServerStatus,
  t: T,
): string {
  const config = server.config;
  if (config?.httpUrl) return `${config.httpUrl} (http)`;
  if (config?.url) return `${config.url} (sse)`;
  if (config?.command) {
    return `${config.command} ${config.args?.join(' ') ?? ''} (stdio)`.trim();
  }
  return server.transport ? `(${server.transport})` : t('mcp.status.unknown');
}

function serverActions(
  server: DaemonWorkspaceMcpServerStatus,
  t: T,
): McpServerAction[] {
  const actions: McpServerAction[] = [];
  if (!server.disabled && server.mcpStatus === 'disconnected') {
    actions.push({ id: 'reconnect', label: t('mcp.action.reconnect') });
  }
  actions.push({
    id: server.disabled ? 'enable' : 'disable',
    label: server.disabled ? t('mcp.action.enable') : t('mcp.action.disable'),
  });
  if (!server.disabled) {
    actions.push({
      id: 'authenticate',
      label: server.hasOAuthTokens
        ? t('mcp.action.reauth')
        : t('mcp.action.auth'),
    });
    if (server.hasOAuthTokens) {
      actions.push({ id: 'clear-auth', label: t('mcp.action.clearAuth') });
    }
  }
  return actions;
}

function oauthMessage(serverName: string, t: T, detail?: string): string {
  return [
    `${t('mcp.oauth.server')}: ${serverName}`,
    t('mcp.oauth.starting', { name: serverName }),
    detail,
  ]
    .filter(Boolean)
    .join('\n');
}

function toolAnnotationText(tool: DaemonWorkspaceMcpToolStatus, t: T): string {
  const annotations = tool.annotations ?? {};
  const labels: string[] = [];
  if (annotations['destructiveHint']) {
    labels.push(t('mcp.annotation.destructive'));
  }
  if (annotations['readOnlyHint']) labels.push(t('mcp.annotation.readOnly'));
  if (annotations['openWorldHint']) labels.push(t('mcp.annotation.openWorld'));
  if (annotations['idempotentHint']) {
    labels.push(t('mcp.annotation.idempotent'));
  }
  return labels.join(', ');
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="break-words text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function ToolDetail({ tool, t }: { tool: DaemonWorkspaceMcpToolStatus; t: T }) {
  const annotations = toolAnnotationText(tool, t);
  const schema = tool.schema as
    | { parametersJsonSchema?: unknown; parameters?: unknown }
    | undefined;
  const schemaContent =
    schema?.parametersJsonSchema ?? schema?.parameters ?? schema;

  return (
    <div className="flex flex-col gap-5">
      {!tool.isValid ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t('mcp.invalidToolWarning')}</AlertTitle>
          <AlertDescription>
            {tool.invalidReason || t('mcp.status.unknown')}
            <span className="mt-1 block">{t('mcp.invalidToolHelp')}</span>
          </AlertDescription>
        </Alert>
      ) : null}
      <DetailField
        label={t('mcp.description')}
        value={tool.description?.trim() || t('mcp.noDescription')}
      />
      {annotations ? (
        <DetailField label={t('mcp.annotations')} value={annotations} />
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">{t('mcp.inputSchema')}</div>
        {schemaContent ? (
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            {JSON.stringify(schemaContent, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t('mcp.noSchema')}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceDetail({
  resource,
  t,
}: {
  resource: DaemonWorkspaceMcpResourceStatus;
  t: T;
}) {
  const friendlyName = resource.title || resource.name || '';
  return (
    <div className="flex flex-col gap-5">
      <DetailField label={t('mcp.resource.uriLabel')} value={resource.uri} />
      {friendlyName && friendlyName !== resource.uri ? (
        <DetailField label={t('mcp.resource.nameLabel')} value={friendlyName} />
      ) : null}
      {resource.mimeType ? (
        <DetailField
          label={t('mcp.resource.mimeTypeLabel')}
          value={resource.mimeType}
        />
      ) : null}
      {typeof resource.size === 'number' ? (
        <DetailField
          label={t('mcp.resource.sizeLabel')}
          value={t('mcp.resource.bytes', { count: resource.size })}
        />
      ) : null}
      {resource.description ? (
        <DetailField
          label={t('mcp.description')}
          value={resource.description.trim()}
        />
      ) : null}
    </div>
  );
}

export function McpManagerPage({
  message,
  onClose,
  embedded,
}: McpManagerPageProps) {
  const { t } = useI18n();
  const mcp = useMcp({ autoLoad: false });
  const [status, setStatus] = useState<McpStatus>(message.status);
  const [toolsByServer, setToolsByServer] = useState<
    Record<string, DaemonWorkspaceMcpToolsStatus>
  >(message.toolsByServer);
  const [resourcesByServer, setResourcesByServer] = useState<
    Record<string, DaemonWorkspaceMcpResourcesStatus>
  >(message.resourcesByServer ?? {});
  const [selectedServerName, setSelectedServerName] = useState<string | null>(
    null,
  );
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null);
  const [selectedResourceUri, setSelectedResourceUri] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [busyServer, setBusyServer] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    serverName?: string;
    text: string;
    error?: boolean;
  } | null>(null);
  const [loadErrorsByServer, setLoadErrorsByServer] = useState<
    Record<string, { tools?: string; resources?: string }>
  >({});

  const servers = useMemo(() => status.servers ?? [], [status.servers]);
  const selectedServer =
    servers.find((server) => server.name === selectedServerName) ?? null;
  const selectedTools = selectedServer
    ? (toolsByServer[selectedServer.name]?.tools ?? [])
    : [];
  const selectedResources = selectedServer
    ? (resourcesByServer[selectedServer.name]?.resources ?? [])
    : [];
  const selectedTool =
    selectedTools.find((tool) => tool.name === selectedToolName) ?? null;
  const selectedResource =
    selectedResources.find(
      (resource) => resource.uri === selectedResourceUri,
    ) ?? null;

  useEffect(() => {
    embedded?.onDetailChange(Boolean(selectedServer));
  }, [embedded, selectedServer]);

  const filteredServers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return servers.filter((server) => {
      const matchesSource =
        sourceFilter === 'all' || sourceValue(server) === sourceFilter;
      const matchesQuery =
        !normalized ||
        server.name.toLowerCase().includes(normalized) ||
        server.description?.toLowerCase().includes(normalized) ||
        server.extensionName?.toLowerCase().includes(normalized);
      return matchesSource && Boolean(matchesQuery);
    });
  }, [query, servers, sourceFilter]);

  const loadServerData = useCallback(
    async (server: DaemonWorkspaceMcpServerStatus) => {
      const failures: unknown[] = [];
      const [toolsResult, resourcesResult] = await Promise.allSettled([
        mcp.loadTools(server.name),
        server.resourceCount
          ? mcp.loadResources(server.name)
          : Promise.resolve(null),
      ]);
      if (toolsResult.status === 'fulfilled') {
        setToolsByServer((current) => ({
          ...current,
          [server.name]: toolsResult.value,
        }));
        setLoadErrorsByServer((current) => ({
          ...current,
          [server.name]: { ...current[server.name], tools: undefined },
        }));
      } else {
        failures.push(toolsResult.reason);
        const error = extractErrorDetail(toolsResult.reason);
        setLoadErrorsByServer((current) => ({
          ...current,
          [server.name]: { ...current[server.name], tools: error },
        }));
      }
      if (
        resourcesResult.status === 'fulfilled' &&
        resourcesResult.value !== null
      ) {
        const resources = resourcesResult.value;
        setResourcesByServer((current) => ({
          ...current,
          [server.name]: resources,
        }));
        setLoadErrorsByServer((current) => ({
          ...current,
          [server.name]: { ...current[server.name], resources: undefined },
        }));
      } else if (resourcesResult.status === 'rejected') {
        failures.push(resourcesResult.reason);
        const error = extractErrorDetail(resourcesResult.reason);
        setLoadErrorsByServer((current) => ({
          ...current,
          [server.name]: { ...current[server.name], resources: error },
        }));
      } else {
        setResourcesByServer((current) => {
          if (!(server.name in current)) return current;
          const next = { ...current };
          delete next[server.name];
          return next;
        });
        setLoadErrorsByServer((current) => ({
          ...current,
          [server.name]: { ...current[server.name], resources: undefined },
        }));
      }
      if (failures.length > 0) {
        throw new AggregateError(
          failures,
          `${server.name}: ${failures.map(extractErrorDetail).join('; ')}`,
        );
      }
    },
    [mcp],
  );

  const refreshAll = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setNotice(null);
    try {
      const nextStatus = await mcp.reload();
      if (!nextStatus) return;
      setStatus(nextStatus);
      const results = await Promise.allSettled(
        (nextStatus.servers ?? []).map(loadServerData),
      );
      const failures = results.flatMap((result) =>
        result.status === 'rejected' ? [extractErrorDetail(result.reason)] : [],
      );
      if (failures.length > 0) {
        setNotice({ text: failures.join('\n'), error: true });
      }
    } catch (error) {
      setNotice({ text: extractErrorDetail(error), error: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadServerData, mcp, refreshing]);

  const runAction = useCallback(
    async (server: DaemonWorkspaceMcpServerStatus, action: McpServerAction) => {
      if (busyServer) return;
      setBusyServer(server.name);
      setNotice({
        serverName: server.name,
        text:
          action.id === 'authenticate'
            ? oauthMessage(server.name, t)
            : t('mcp.action.running', { action: action.label }),
      });
      try {
        let detail = '';
        if (action.id === 'reconnect') {
          await mcp.restartServer(server.name);
        } else {
          const result = await mcp.manageServer(server.name, action.id);
          detail = [
            ...(result.messages ?? []),
            ...(result.authUrl ? [result.authUrl] : []),
          ].join('\n');
        }
        const nextStatus = await mcp.reload();
        if (nextStatus) {
          setStatus(nextStatus);
          const nextServer = nextStatus.servers?.find(
            (candidate) => candidate.name === server.name,
          );
          if (nextServer) await loadServerData(nextServer);
        }
        setNotice({
          serverName: server.name,
          text:
            action.id === 'authenticate' && detail
              ? oauthMessage(server.name, t, detail)
              : detail || t('mcp.action.done', { action: action.label }),
        });
      } catch (error) {
        setNotice({
          serverName: server.name,
          text: t('mcp.action.failed', {
            error: extractErrorDetail(error),
          }),
          error: true,
        });
      } finally {
        setBusyServer(null);
      }
    },
    [busyServer, loadServerData, mcp, t],
  );

  const openServer = (server: DaemonWorkspaceMcpServerStatus) => {
    setSelectedServerName(server.name);
    setSelectedToolName(null);
    setSelectedResourceUri(null);
    setNotice(null);
    void loadServerData(server).catch((error: unknown) => {
      setNotice({
        serverName: server.name,
        text: t('mcp.action.failed', { error: extractErrorDetail(error) }),
        error: true,
      });
    });
  };

  const showServerList = () => {
    setSelectedServerName(null);
    setSelectedToolName(null);
    setSelectedResourceUri(null);
  };

  const showSelectedServer = () => {
    setSelectedToolName(null);
    setSelectedResourceUri(null);
  };

  const standaloneNavigation = (
    <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
      <BreadcrumbList className="text-base">
        <BreadcrumbItem>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common.back')}
          >
            <ArrowLeftIcon />
          </Button>
        </BreadcrumbItem>
        <BreadcrumbItem>
          {selectedServer ? (
            <BreadcrumbLink asChild>
              <button type="button" onClick={showServerList}>
                {t('mcp.title')}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t('mcp.title')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {selectedServer ? <BreadcrumbSeparator /> : null}
        {selectedServer ? (
          <BreadcrumbItem>
            {selectedTool || selectedResource ? (
              <BreadcrumbLink asChild>
                <button type="button" onClick={showSelectedServer}>
                  {selectedServer.name}
                </button>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{selectedServer.name}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ) : null}
        {selectedTool || selectedResource ? <BreadcrumbSeparator /> : null}
        {selectedTool ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{selectedTool.name}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
        {selectedResource ? (
          <BreadcrumbItem>
            <BreadcrumbPage>
              {selectedResource.title ||
                selectedResource.name ||
                selectedResource.uri}
            </BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
  const detailLabel = selectedTool
    ? selectedTool.name
    : selectedResource
      ? selectedResource.title || selectedResource.name || selectedResource.uri
      : selectedServer?.name;
  const navigation = embedded ? (
    selectedServer ? (
      <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
        <BreadcrumbList className="h-8 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={embedded.onRoot}>
                {t('mcp.title')}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {selectedTool || selectedResource ? (
              <BreadcrumbLink asChild>
                <button type="button" onClick={showSelectedServer}>
                  {selectedServer.name}
                </button>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{selectedServer.name}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {selectedTool || selectedResource ? <BreadcrumbSeparator /> : null}
          {selectedTool || selectedResource ? (
            <BreadcrumbItem>
              <BreadcrumbPage>{detailLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
    ) : null
  ) : (
    standaloneNavigation
  );

  if (selectedTool && selectedServer) {
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <WrenchIcon />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold">
                {selectedTool.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedTool.serverToolName || selectedServer.name}
              </p>
            </div>
          </div>
          <Card>
            <CardContent>
              <ToolDetail tool={selectedTool} t={t} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedResource && selectedServer) {
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <DatabaseIcon />
            </div>
            <h1 className="min-w-0 break-words text-2xl font-semibold">
              {selectedResource.title ||
                selectedResource.name ||
                selectedResource.uri}
            </h1>
          </div>
          <Card>
            <CardContent>
              <ResourceDetail resource={selectedResource} t={t} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedServer) {
    const tools = selectedTools;
    const resources = selectedResources;
    const loadErrors = loadErrorsByServer[selectedServer.name];
    const actions = serverActions(selectedServer, t);
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <ServerIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold">
                  {selectedServer.name}
                </h1>
                <Badge variant="secondary">
                  {statusLabel(selectedServer, t)}
                </Badge>
                <Badge variant="outline">
                  {sourceLabel(selectedServer, t)}
                </Badge>
              </div>
              {selectedServer.description ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p
                        className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                        tabIndex={0}
                      >
                        {selectedServer.description}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm whitespace-normal">
                      {selectedServer.description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('mcp.settings')}
                >
                  {busyServer === selectedServer.name ? (
                    <Spinner />
                  ) : (
                    <EllipsisVerticalIcon />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuGroup>
                  {actions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      disabled={busyServer !== null}
                      onSelect={() => void runAction(selectedServer, action)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {notice?.serverName === selectedServer.name ? (
            <Alert variant={notice.error ? 'destructive' : 'default'}>
              {notice.error ? <AlertCircleIcon /> : <ExternalLinkIcon />}
              <AlertDescription className="whitespace-pre-wrap break-words">
                {notice.text}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t('mcp.status')}</TabsTrigger>
              <TabsTrigger value="tools">
                {t('mcp.tools')} {tools.length}
              </TabsTrigger>
              <TabsTrigger value="resources">
                {t('mcp.resources')}{' '}
                {selectedServer.resourceCount ?? resources.length}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('mcp.status')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <DetailField
                    label={t('mcp.source')}
                    value={sourceLabel(selectedServer, t)}
                  />
                  <DetailField
                    label={t('mcp.transport')}
                    value={selectedServer.transport}
                  />
                  <DetailField
                    label={t('mcp.command')}
                    value={formatServerCommand(selectedServer, t)}
                  />
                  <DetailField
                    label={t('mcp.workingDirectory')}
                    value={selectedServer.config?.cwd || status.workspaceCwd}
                  />
                  {selectedServer.error ? (
                    <DetailField
                      label={t('mcp.invalidReasonLabel')}
                      value={selectedServer.error}
                    />
                  ) : null}
                  {selectedServer.hint ? (
                    <DetailField
                      label={t('mcp.description')}
                      value={selectedServer.hint}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tools" className="pt-4">
              {loadErrors?.tools ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t('mcp.loadingTools')}</AlertTitle>
                  <AlertDescription>{loadErrors.tools}</AlertDescription>
                </Alert>
              ) : tools.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {tools.map((tool) => (
                    <Card
                      key={tool.name}
                      size="sm"
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => setSelectedToolName(tool.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ')
                          setSelectedToolName(tool.name);
                      }}
                    >
                      <CardHeader>
                        <CardTitle className="break-words">
                          {tool.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {tool.description || t('mcp.noDescription')}
                        </CardDescription>
                        {!tool.isValid ? (
                          <CardAction>
                            <Badge variant="destructive">
                              {t('mcp.status.blocked')}
                            </Badge>
                          </CardAction>
                        ) : null}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty className="rounded-xl border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <WrenchIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('mcp.emptyTools')}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
            <TabsContent value="resources" className="pt-4">
              {loadErrors?.resources ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{t('mcp.resourcesUnavailable')}</AlertTitle>
                  <AlertDescription>{loadErrors.resources}</AlertDescription>
                </Alert>
              ) : resources.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {resources.map((resource) => (
                    <Card
                      key={resource.uri}
                      size="sm"
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => setSelectedResourceUri(resource.uri)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ')
                          setSelectedResourceUri(resource.uri);
                      }}
                    >
                      <CardHeader>
                        <CardTitle className="break-words">
                          {resource.title || resource.name || resource.uri}
                        </CardTitle>
                        <CardDescription className="break-all">
                          {resource.uri}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty className="rounded-xl border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <DatabaseIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('mcp.resourcesUnavailable')}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  const connectingCount = servers.filter(
    (server) => !server.disabled && server.mcpStatus === 'connecting',
  ).length;
  const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
    { value: 'all', label: t('common.all') },
    { value: 'user', label: t('mcp.source.user') },
    { value: 'project', label: t('mcp.source.project') },
    { value: 'extension', label: t('mcp.source.extension') },
  ];

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      {navigation}
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-balance">
              {t('mcp.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t('mcp.servers', { count: servers.length })}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void refreshAll()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {t('common.refresh')}
          </Button>
        </div>

        {connectingCount > 0 ? (
          <Alert>
            <RefreshCwIcon />
            <AlertTitle>
              {t('mcp.starting', { count: connectingCount })}
            </AlertTitle>
            <AlertDescription>{t('mcp.startingNote')}</AlertDescription>
          </Alert>
        ) : null}
        {notice && !notice.serverName ? (
          <Alert variant={notice.error ? 'destructive' : 'default'}>
            <AlertCircleIcon />
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
        {(status.errors ?? []).map((error, index) => (
          <Alert key={`${error.kind}-${index}`} variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>{error.kind}</AlertTitle>
            <AlertDescription>
              {error.error || error.hint || t('mcp.status.unknown')}
            </AlertDescription>
          </Alert>
        ))}
        {status.budgetMode && status.budgetMode !== 'off' ? (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription>
              {t('mcp.clientBudget', {
                count: status.clientCount ?? 0,
                budget: status.clientBudget ?? '∞',
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${t('common.search')} MCP…`}
          />
        </div>
        <ToggleGroup
          type="single"
          value={sourceFilter}
          onValueChange={(value) => {
            if (value) setSourceFilter(value as SourceFilter);
          }}
          variant="outline"
          size="sm"
          aria-label={t('mcp.source')}
        >
          {sourceOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {filteredServers.length ? (
          <div
            className={
              filteredServers.length > 1
                ? 'grid gap-3 lg:grid-cols-2'
                : 'grid gap-3'
            }
          >
            {filteredServers.map((server) => {
              const toolCount = toolsByServer[server.name]?.tools.length ?? 0;
              return (
                <Card
                  key={server.name}
                  size="sm"
                  className="cursor-pointer transition-colors hover:bg-accent/30"
                  onClick={() => openServer(server)}
                >
                  <CardHeader>
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <ServerIcon className="size-5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <CardTitle className="break-words">
                          {server.name}
                        </CardTitle>
                        {server.description ? (
                          <CardDescription className="line-clamp-1">
                            {server.description}
                          </CardDescription>
                        ) : null}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {statusLabel(server, t)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <WrenchIcon className="size-4" />
                        {toolCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <DatabaseIcon className="size-4" />
                        {server.resourceCount ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BoxIcon className="size-4" />
                        {server.promptCount ?? 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerIcon />
              </EmptyMedia>
              <EmptyTitle>
                {query || sourceFilter !== 'all'
                  ? t('mcp.noMatches')
                  : t('mcp.empty')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
