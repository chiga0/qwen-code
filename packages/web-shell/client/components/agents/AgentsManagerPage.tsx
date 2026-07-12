import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  BotIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  useAgents,
  useTools,
  type DaemonWorkspaceAgentDetail,
  type DaemonWorkspaceAgentSummary,
} from '@qwen-code/webui/daemon-react-sdk';
import { useI18n } from '../../i18n';
import type { EmbeddedManagerPage } from '../plugins/manager-page';
import { Alert, AlertDescription } from '../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  agentScope,
  canModifyAgent,
  filterAgents,
  toolsForPreset,
  type AgentLevelFilter,
  type AgentToolPreset,
} from './agents-manager-logic';

type View = 'list' | 'detail' | 'create';
type CreationMethod = 'qwen' | 'manual';
type CreationScope = 'workspace' | 'global';

interface AgentsManagerPageProps {
  embedded: EmbeddedManagerPage;
  onMessage: (text: string) => void;
}

function levelLabel(
  agent: DaemonWorkspaceAgentSummary,
  t: ReturnType<typeof useI18n>['t'],
): string {
  return t(`agent.level.${agent.level}`);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="break-words whitespace-pre-wrap text-sm text-muted-foreground">
        {value || '—'}
      </div>
    </div>
  );
}

export function AgentsManagerPage({
  embedded,
  onMessage,
}: AgentsManagerPageProps) {
  const { t } = useI18n();
  const {
    agents,
    status,
    loading,
    error,
    reload,
    getAgent,
    createAgent,
    generateAgent,
    deleteAgent,
  } = useAgents({ autoLoad: true });
  const { tools } = useTools({ autoLoad: true });
  const [view, setView] = useState<View>('list');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detail, setDetail] = useState<DaemonWorkspaceAgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<AgentLevelFilter>('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createMethod, setCreateMethod] = useState<CreationMethod>('manual');
  const [createScope, setCreateScope] = useState<CreationScope>('workspace');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [toolPreset, setToolPreset] = useState<AgentToolPreset>('all');

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.name === selectedName) ?? null,
    [agents, selectedName],
  );
  const filteredAgents = useMemo(
    () => filterAgents(agents, query, levelFilter),
    [agents, levelFilter, query],
  );
  const message = notice ?? error?.message ?? status?.errors?.[0]?.error;
  const nonListView = view !== 'list';

  useEffect(() => {
    embedded.onDetailChange(nonListView);
  }, [embedded, nonListView]);

  useEffect(() => {
    if (view !== 'detail' || !selectedName) return;
    let active = true;
    setDetailLoading(true);
    setDetail(null);
    getAgent(selectedName)
      .then((nextDetail) => {
        if (active) setDetail(nextDetail);
      })
      .catch((nextError: unknown) => {
        if (active) {
          setNotice(
            nextError instanceof Error ? nextError.message : String(nextError),
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getAgent, selectedName, view]);

  const showList = () => {
    setView('list');
    setSelectedName(null);
    setDetail(null);
    setNotice(null);
    embedded.onDetailChange(false);
  };
  const showCreate = () => {
    setView('create');
    setNotice(null);
    embedded.onDetailChange(true);
  };
  const openAgent = (agent: DaemonWorkspaceAgentSummary) => {
    setSelectedName(agent.name);
    setView('detail');
    setNotice(null);
    embedded.onDetailChange(true);
  };

  const resetCreateForm = () => {
    setCreateMethod('manual');
    setCreateScope('workspace');
    setCreateName('');
    setCreateDescription('');
    setCreatePrompt('');
    setToolPreset('all');
  };

  const handleGenerate = async () => {
    if (!createDescription.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const generated = await generateAgent(createDescription.trim());
      setCreateName(generated.name);
      setCreateDescription(generated.description);
      setCreatePrompt(generated.systemPrompt);
    } catch (nextError) {
      setNotice(
        t('agent.create.generateFailed', {
          error:
            nextError instanceof Error ? nextError.message : String(nextError),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (
      !createName.trim() ||
      !createDescription.trim() ||
      !createPrompt.trim() ||
      busy
    ) {
      setNotice(t('agent.create.required'));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await createAgent({
        name: createName.trim(),
        description: createDescription.trim(),
        systemPrompt: createPrompt.trim(),
        scope: createScope,
        tools: toolsForPreset(tools, toolPreset),
      });
      onMessage(t('agent.created', { name: result.agent.name }));
      resetCreateForm();
      await reload();
      showList();
    } catch (nextError) {
      setNotice(
        nextError instanceof Error ? nextError.message : String(nextError),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent || busy) return;
    const scope = agentScope(selectedAgent);
    if (!scope) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteAgent(selectedAgent.name, scope);
      onMessage(t('agent.deleted', { name: selectedAgent.name }));
      await reload();
      showList();
    } catch (nextError) {
      setNotice(
        nextError instanceof Error ? nextError.message : String(nextError),
      );
    } finally {
      setBusy(false);
    }
  };

  const navigation = nonListView ? (
    <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
      <BreadcrumbList className="h-8 text-sm">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={embedded.onRoot}>
              {t('agents.title')}
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            {view === 'create' ? t('agent.create.button') : selectedAgent?.name}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ) : null;

  if (view === 'create') {
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-balance">
              {t('agent.create.button')}
            </h1>
          </div>
          {message ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Card>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('agent.create.location')}</FieldLabel>
                  <Select
                    value={createScope}
                    onValueChange={(value) => {
                      setCreateScope(value as CreationScope);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="workspace">
                          {t('agent.create.project')}
                        </SelectItem>
                        <SelectItem value="global">
                          {t('agent.create.user')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t('agent.create.method')}</FieldLabel>
                  <Select
                    value={createMethod}
                    onValueChange={(value) => {
                      setCreateMethod(value as CreationMethod);
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="manual">
                          {t('agent.create.method.manual')}
                        </SelectItem>
                        <SelectItem value="qwen">
                          {t('agent.create.method.qwen')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-description">
                    {t('agent.create.description')}
                  </FieldLabel>
                  <Textarea
                    id="agent-description"
                    value={createDescription}
                    onChange={(event) =>
                      setCreateDescription(event.target.value)
                    }
                    placeholder={t('agent.create.descPlaceholder')}
                  />
                  {createMethod === 'qwen' ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!createDescription.trim() || busy}
                        onClick={() => void handleGenerate()}
                      >
                        {busy ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SparklesIcon data-icon="inline-start" />
                        )}
                        {t('agent.create.method.qwen')}
                      </Button>
                    </div>
                  ) : (
                    <FieldDescription>
                      {t('agent.create.manualDescHelp')}
                    </FieldDescription>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-name">
                    {t('agent.create.name')}
                  </FieldLabel>
                  <Input
                    id="agent-name"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder={t('agent.create.namePlaceholder')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-prompt">
                    {t('agent.create.prompt')}
                  </FieldLabel>
                  <Textarea
                    id="agent-prompt"
                    className="min-h-40"
                    value={createPrompt}
                    onChange={(event) => setCreatePrompt(event.target.value)}
                    placeholder={t('agent.create.promptPlaceholder')}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t('agent.create.toolsSelection')}</FieldLabel>
                  <Select
                    value={toolPreset}
                    onValueChange={(value) =>
                      setToolPreset(value as AgentToolPreset)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">
                          {t('agent.create.tools.all')}
                        </SelectItem>
                        <SelectItem value="read">
                          {t('agent.create.tools.readOnly')}
                        </SelectItem>
                        <SelectItem value="edit">
                          {t('agent.create.tools.readEdit')}
                        </SelectItem>
                        <SelectItem value="execute">
                          {t('agent.create.tools.readEditExecute')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={showList} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {t('agent.create.save')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedAgent) {
    const mutable = canModifyAgent(selectedAgent);
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <BotIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold text-balance">
                  {selectedAgent.name}
                </h1>
                <Badge variant="secondary">
                  {levelLabel(selectedAgent, t)}
                </Badge>
              </div>
            </div>
            {mutable ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2Icon data-icon="inline-start" />
                    {t('agent.action.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('agent.action.delete')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('agent.delete.confirm', { name: selectedAgent.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => void handleDelete()}
                    >
                      {t('agent.action.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
          {message ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {detailLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : detail ? (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">
                  {t('agent.detail.overview')}
                </TabsTrigger>
                <TabsTrigger value="tools">
                  {t('agent.detail.tools')}
                </TabsTrigger>
                <TabsTrigger value="prompt">
                  {t('agent.detail.systemPrompt')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Card>
                  <CardContent className="grid gap-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <DetailField
                        label={t('agent.create.description')}
                        value={detail.description}
                      />
                    </div>
                    <DetailField
                      label={t('agent.filePathLabel')}
                      value={detail.filePath || ''}
                    />
                    <DetailField
                      label={t('agent.modelLabel')}
                      value={detail.model || ''}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tools">
                <Card>
                  <CardContent>
                    <DetailField
                      label={t('agent.toolsLabel')}
                      value={
                        !detail.tools?.length || detail.tools.includes('*')
                          ? t('agent.create.tools.all')
                          : detail.tools.join(', ')
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="prompt">
                <Card>
                  <CardContent>
                    <DetailField
                      label={t('agent.systemPromptLabel')}
                      value={detail.systemPrompt}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
    );
  }

  const levelOptions: Array<{ value: AgentLevelFilter; label: string }> = [
    { value: 'all', label: t('common.all') },
    { value: 'project', label: t('agent.level.project') },
    { value: 'user', label: t('agent.level.user') },
    { value: 'extension', label: t('agent.level.extension') },
    { value: 'builtin', label: t('agent.level.builtin') },
  ];

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-balance">
              {t('agents.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t('agent.count', { count: agents.length })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void reload()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {t('common.refresh')}
            </Button>
            <Button onClick={showCreate}>
              <PlusIcon data-icon="inline-start" />
              {t('agent.create.button')}
            </Button>
          </div>
        </div>
        {message ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={levelFilter}
          onValueChange={(value) => {
            if (value) setLevelFilter(value as AgentLevelFilter);
          }}
          variant="outline"
          size="sm"
          className="flex-wrap justify-start"
          aria-label={t('agent.create.location')}
        >
          {levelOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {loading && !agents.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : filteredAgents.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredAgents.map((agent) => (
              <Card
                key={`${agent.level}:${agent.name}`}
                size="sm"
                className="cursor-pointer transition-colors hover:bg-accent/30"
                onClick={() => openAgent(agent)}
              >
                <CardHeader>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <BotIcon className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <CardTitle className="break-words">
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {agent.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {levelLabel(agent, t)}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {query || levelFilter !== 'all' ? <SearchIcon /> : <BotIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {query || levelFilter !== 'all'
                  ? t('agent.noMatches')
                  : t('agent.empty')}
              </EmptyTitle>
              {!query && levelFilter === 'all' ? (
                <EmptyDescription>
                  {t('agent.createFirstHint')}
                </EmptyDescription>
              ) : null}
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
