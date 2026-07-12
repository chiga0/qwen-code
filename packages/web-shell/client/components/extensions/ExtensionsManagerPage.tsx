import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BotIcon,
  BoxIcon,
  CommandIcon,
  EllipsisVerticalIcon,
  FileTextIcon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  SparklesIcon,
} from 'lucide-react';
import type {
  DaemonExtensionEntry,
  DaemonExtensionUpdateState,
} from '@qwen-code/sdk/daemon';
import {
  useConnection,
  useWorkspaceActions,
  useWorkspaceEventSignals,
} from '@qwen-code/webui/daemon-react-sdk';
import { useI18n } from '../../i18n';
import { trimDialogLabel } from '../../utils/dialogLabels';
import {
  filterExtensions,
  preserveSelectedExtensionName,
} from './extensions-manager-logic';
import { Alert, AlertDescription } from '../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../ui/alert-dialog';
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
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import type { EmbeddedManagerPage } from '../plugins/manager-page';

type Scope = 'user' | 'workspace';
type Mutation = 'enable' | 'disable';
type T = ReturnType<typeof useI18n>['t'];

const UPDATE_AVAILABLE: DaemonExtensionUpdateState = 'update available';

interface ExtensionsManagerPageProps {
  onClose: () => void;
  embedded?: EmbeddedManagerPage;
}

function extensionTitle(extension: DaemonExtensionEntry): string {
  return extension.displayName || extension.name;
}

function statusLabel(extension: DaemonExtensionEntry, t: T): string {
  return extension.isActive
    ? t('extensions.manage.status.enabled')
    : t('extensions.manage.status.disabled');
}

function updateLabel(
  state: DaemonExtensionUpdateState | undefined,
  t: T,
): string {
  switch (state) {
    case 'update available':
      return t('extensions.manage.updateAvailable');
    case 'up to date':
      return t('extensions.manage.upToDate');
    case 'not updatable':
      return t('extensions.manage.notUpdatable');
    case 'checking for updates':
      return t('extensions.manage.checkingUpdates');
    case 'updating':
      return t('extensions.manage.updating');
    case 'updated':
      return t('extensions.manage.updateComplete');
    case 'updated, needs restart':
      return t('extensions.manage.restartRequired');
    case 'error':
      return t('extensions.manage.updateError');
    default:
      return t('extensions.manage.unknownUpdate');
  }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm font-medium">{trimDialogLabel(label)}</div>
      <div className="break-words text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function CapabilityList({
  items,
  empty,
  icon: Icon,
}: {
  items: string[];
  empty: string;
  icon: typeof CommandIcon;
}) {
  if (!items.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{empty}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col">
        {items.map((item, index) => (
          <div key={item}>
            {index > 0 ? <Separator /> : null}
            <div className="flex min-w-0 items-center gap-3 py-3 [contain-intrinsic-size:auto_44px] [content-visibility:auto]">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">{item}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ExtensionsManagerPage({
  onClose,
  embedded,
}: ExtensionsManagerPageProps) {
  const { t } = useI18n();
  const connection = useConnection();
  const actions = useWorkspaceActions();
  const signals = useWorkspaceEventSignals();
  const [extensions, setExtensions] = useState<DaemonExtensionEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [updateStates, setUpdateStates] = useState<
    Record<string, DaemonExtensionUpdateState>
  >({});
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uninstallOpen, setUninstallOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return actions
      .loadExtensionsStatus()
      .then((status) => {
        const nextExtensions = status.extensions ?? [];
        setExtensions(nextExtensions);
        setMessage(status.errors?.[0]?.error ?? null);
        setSelectedName((name) =>
          preserveSelectedExtensionName(name, nextExtensions),
        );
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  }, [actions]);

  const checkUpdates = useCallback(() => {
    const clientId = connection.clientId;
    if (!clientId) return Promise.resolve();
    setChecking(true);
    return actions
      .checkExtensionUpdates(clientId)
      .then((result) => setUpdateStates(result.states))
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setChecking(false));
  }, [actions, connection.clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (extensions.length > 0) void checkUpdates();
  }, [checkUpdates, extensions.length]);

  useEffect(() => {
    if ((signals?.extensionsVersion ?? 0) > 0) {
      setUpdateStates({});
      void load();
    }
  }, [load, signals?.extensionsVersion]);

  const refreshSessions = useCallback(() => {
    const clientId = connection.clientId;
    if (!clientId) {
      setMessage(t('extensions.install.waitForSession'));
      return;
    }
    setChecking(true);
    setMessage(null);
    actions
      .refreshExtensions(clientId)
      .then(async (result) => {
        setMessage(
          t('extensions.manage.refreshed', {
            refreshed: result.refreshed,
            failed: result.failed,
          }),
        );
        await load();
        await checkUpdates();
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setChecking(false));
  }, [actions, checkUpdates, connection.clientId, load, t]);

  const runMutation = useCallback(
    (
      name: string,
      run: (clientId?: string) => Promise<unknown>,
      options: { allowWithoutClientId?: boolean } = {},
    ) => {
      const clientId = connection.clientId;
      if (!clientId && !options.allowWithoutClientId) {
        setMessage(t('extensions.install.waitForSession'));
        return;
      }
      setBusyName(name);
      setMessage(null);
      run(clientId)
        .then(() => setMessage(t('extensions.manage.queued', { name })))
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          setBusyName(null);
          void load();
        });
    },
    [connection.clientId, load, t],
  );

  const selectedExtension = useMemo(
    () => extensions.find((extension) => extension.name === selectedName),
    [extensions, selectedName],
  );

  useEffect(() => {
    embedded?.onDetailChange(Boolean(selectedExtension));
  }, [embedded, selectedExtension]);
  const filteredExtensions = useMemo(
    () => filterExtensions(extensions, query),
    [extensions, query],
  );

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
          {selectedExtension ? (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => setSelectedName(null)}>
                {t('extensions.manage.title')}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t('extensions.manage.title')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {selectedExtension ? <BreadcrumbSeparator /> : null}
        {selectedExtension ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{extensionTitle(selectedExtension)}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
  const navigation = embedded ? (
    selectedExtension ? (
      <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
        <BreadcrumbList className="h-8 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={embedded.onRoot}>
                {t('extensions.manage.title')}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{extensionTitle(selectedExtension)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ) : null
  ) : (
    standaloneNavigation
  );

  if (selectedExtension) {
    const details = selectedExtension.details;
    const updateState =
      updateStates[selectedExtension.name] ?? selectedExtension.updateState;
    const busy = busyName === selectedExtension.name;
    const mutation: Mutation = selectedExtension.isActive
      ? 'disable'
      : 'enable';
    const toggleScope = (scope: Scope) =>
      runMutation(
        selectedExtension.name,
        (clientId) =>
          mutation === 'enable'
            ? actions.enableExtension(
                selectedExtension.name,
                { scope },
                clientId,
              )
            : actions.disableExtension(
                selectedExtension.name,
                { scope },
                clientId,
              ),
        { allowWithoutClientId: true },
      );
    const commands = details?.commands ?? [];
    const skills = details?.skills ?? [];
    const agents = details?.agents ?? [];
    const mcpServers = details?.mcpServers ?? [];
    const contextFiles = details?.contextFiles ?? [];

    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <PackageIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold">
                  {extensionTitle(selectedExtension)}
                </h1>
                <Badge variant="outline">v{selectedExtension.version}</Badge>
                <Badge variant="secondary">
                  {statusLabel(selectedExtension, t)}
                </Badge>
              </div>
              {selectedExtension.description ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p
                        className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                        tabIndex={0}
                      >
                        {selectedExtension.description}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm whitespace-normal">
                      {selectedExtension.description}
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
                  aria-label={t('extensions.manage.actions')}
                >
                  {busy ? <Spinner /> : <EllipsisVerticalIcon />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={busy || updateState !== UPDATE_AVAILABLE}
                    onSelect={() =>
                      runMutation(selectedExtension.name, (clientId) =>
                        actions.updateExtension(
                          selectedExtension.name,
                          clientId,
                        ),
                      )
                    }
                  >
                    {t('extensions.manage.update')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy}
                    onSelect={() => toggleScope('user')}
                  >
                    {mutation === 'enable'
                      ? t('extensions.manage.enable')
                      : t('extensions.manage.disable')}
                    · {t('settings.scope.user')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy}
                    onSelect={() => toggleScope('workspace')}
                  >
                    {mutation === 'enable'
                      ? t('extensions.manage.enable')
                      : t('extensions.manage.disable')}
                    · {t('settings.scope.workspace')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={busy}
                    onSelect={() => setUninstallOpen(true)}
                  >
                    {t('extensions.manage.uninstallAction')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {message ? (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription className="break-words">
                {message}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="overview">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="overview">
                {t('extensions.manage.overview')}
              </TabsTrigger>
              <TabsTrigger value="commands">
                {trimDialogLabel(t('extensions.manage.commands'))}{' '}
                {commands.length}
              </TabsTrigger>
              <TabsTrigger value="skills">
                {trimDialogLabel(t('extensions.manage.skills'))} {skills.length}
              </TabsTrigger>
              <TabsTrigger value="agents">
                {trimDialogLabel(t('extensions.manage.agents'))} {agents.length}
              </TabsTrigger>
              <TabsTrigger value="mcp">
                {trimDialogLabel(t('extensions.manage.mcpServers'))}{' '}
                {mcpServers.length}
              </TabsTrigger>
              <TabsTrigger value="context">
                {trimDialogLabel(t('extensions.manage.contextFiles'))}{' '}
                {contextFiles.length}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('extensions.manage.overview')}</CardTitle>
                  {selectedExtension.description ? (
                    <CardDescription>
                      {selectedExtension.description}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <DetailField
                    label={t('extensions.manage.name')}
                    value={selectedExtension.name}
                  />
                  <DetailField
                    label={t('extensions.manage.version')}
                    value={selectedExtension.version}
                  />
                  <DetailField
                    label={t('extensions.manage.status')}
                    value={statusLabel(selectedExtension, t)}
                  />
                  <DetailField
                    label={t('extensions.manage.source')}
                    value={selectedExtension.source ?? '-'}
                  />
                  <DetailField
                    label={t('extensions.manage.path')}
                    value={selectedExtension.path}
                  />
                  <DetailField
                    label={t('extensions.manage.updateStatus')}
                    value={updateLabel(updateState, t)}
                  />
                  <DetailField
                    label={t('extensions.manage.installType')}
                    value={selectedExtension.installType ?? '-'}
                  />
                  <DetailField
                    label={t('extensions.manage.origin')}
                    value={selectedExtension.originSource ?? '-'}
                  />
                  <DetailField
                    label={t('extensions.manage.settings')}
                    value={(details?.settings ?? []).join(', ') || '-'}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="commands" className="pt-4">
              <CapabilityList
                items={commands}
                empty={t('extensions.manage.emptyCommands')}
                icon={CommandIcon}
              />
            </TabsContent>
            <TabsContent value="skills" className="pt-4">
              <CapabilityList
                items={skills}
                empty={t('extensions.manage.emptySkills')}
                icon={SparklesIcon}
              />
            </TabsContent>
            <TabsContent value="agents" className="pt-4">
              <CapabilityList
                items={agents}
                empty={t('extensions.manage.emptyAgents')}
                icon={BotIcon}
              />
            </TabsContent>
            <TabsContent value="mcp" className="pt-4">
              <CapabilityList
                items={mcpServers}
                empty={t('extensions.manage.emptyMcpServers')}
                icon={ServerIcon}
              />
            </TabsContent>
            <TabsContent value="context" className="pt-4">
              <CapabilityList
                items={contextFiles}
                empty={t('extensions.manage.emptyContextFiles')}
                icon={FileTextIcon}
              />
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <PackageIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>
                {t('extensions.manage.uninstallAction')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('extensions.manage.uninstallConfirm', {
                  name: selectedExtension.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  runMutation(selectedExtension.name, (clientId) =>
                    actions.uninstallExtension(
                      selectedExtension.name,
                      clientId,
                    ),
                  );
                  setSelectedName(null);
                }}
              >
                {t('extensions.manage.uninstallAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      {navigation}
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {t('extensions.manage.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('extensions.manage.count', { count: extensions.length })}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading || checking}
            onClick={refreshSessions}
          >
            {loading || checking ? (
              <Spinner />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {t('common.refresh')}
          </Button>
        </div>

        {message ? (
          <Alert>
            <AlertCircleIcon />
            <AlertDescription className="break-words">
              {message}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="extension-search"
            aria-label={t('extensions.manage.search')}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('extensions.manage.search')}
            className="pl-9"
          />
        </div>

        {loading && !extensions.length ? (
          <div
            className={
              filteredExtensions.length > 1
                ? 'grid gap-3 lg:grid-cols-2'
                : 'grid gap-3'
            }
          >
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ) : filteredExtensions.length ? (
          <div className="grid gap-3">
            {filteredExtensions.map((extension) => {
              const state =
                updateStates[extension.name] ?? extension.updateState;
              const capabilities = extension.capabilities;
              return (
                <Card
                  key={extension.id || extension.name}
                  size="sm"
                  className="cursor-pointer transition-colors hover:bg-accent/30"
                  onClick={() => setSelectedName(extension.name)}
                >
                  <CardHeader>
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <PackageIcon className="size-5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <CardTitle className="break-words">
                          {extensionTitle(extension)}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {extension.description ||
                            t('extensions.manage.noDescription')}
                        </CardDescription>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Badge variant="outline">v{extension.version}</Badge>
                        <Badge variant="secondary">
                          {statusLabel(extension, t)}
                        </Badge>
                        {state === UPDATE_AVAILABLE ? (
                          <Badge>{updateLabel(state, t)}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="flex flex-wrap justify-end gap-4 border-0 bg-transparent pt-0 text-xs text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <CommandIcon className="size-4" />
                      {capabilities.commandCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <SparklesIcon className="size-4" />
                      {capabilities.skillCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BotIcon className="size-4" />
                      {capabilities.agentCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ServerIcon className="size-4" />
                      {capabilities.mcpServerCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileTextIcon className="size-4" />
                      {capabilities.contextFileCount}
                    </span>
                    {capabilities.hasSettings ? (
                      <span className="inline-flex items-center gap-1">
                        <SettingsIcon className="size-4" />1
                      </span>
                    ) : null}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {query ? <SearchIcon /> : <BoxIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {query
                  ? t('extensions.manage.noMatches')
                  : t('extensions.manage.empty')}
              </EmptyTitle>
              {!query ? (
                <EmptyDescription>
                  {t('extensions.manage.emptyDescription')}
                </EmptyDescription>
              ) : null}
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
