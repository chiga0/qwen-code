import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  SearchIcon,
  WrenchIcon,
} from 'lucide-react';
import {
  useTools,
  type DaemonWorkspaceToolStatus,
} from '@qwen-code/webui/daemon-react-sdk';
import { useI18n } from '../../i18n';
import {
  filterTools,
  preserveCatalogSelection,
} from '../catalog/catalog-logic';
import { Alert, AlertDescription } from '../ui/alert';
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
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import type { EmbeddedManagerPage } from '../plugins/manager-page';

interface ToolsManagerPageProps {
  onClose: () => void;
  embedded?: EmbeddedManagerPage;
}

function toolLabel(tool: DaemonWorkspaceToolStatus): string {
  return tool.displayName || tool.name;
}

export function ToolsManagerPage({ onClose, embedded }: ToolsManagerPageProps) {
  const { t } = useI18n();
  const { status, tools, loading, error, reload } = useTools({
    autoLoad: true,
  });
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selectedTool = useMemo(
    () => tools.find((tool) => tool.name === selectedName),
    [selectedName, tools],
  );
  const filteredTools = useMemo(
    () => filterTools(tools, query),
    [query, tools],
  );
  const message = error?.message ?? status?.errors?.[0]?.error;
  const enabledCount = tools.filter((tool) => tool.enabled).length;

  useEffect(() => {
    setSelectedName((name) => preserveCatalogSelection(name, tools));
  }, [tools]);

  useEffect(() => {
    embedded?.onDetailChange(Boolean(selectedTool));
  }, [embedded, selectedTool]);

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
          {selectedTool ? (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => setSelectedName(null)}>
                {t('tools.title')}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t('tools.title')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {selectedTool ? <BreadcrumbSeparator /> : null}
        {selectedTool ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{toolLabel(selectedTool)}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
  const navigation = embedded ? (
    selectedTool ? (
      <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
        <BreadcrumbList className="h-8 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={embedded.onRoot}>
                {t('tools.title')}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{toolLabel(selectedTool)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ) : null
  ) : (
    standaloneNavigation
  );

  if (selectedTool) {
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <WrenchIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold text-balance">
                  {toolLabel(selectedTool)}
                </h1>
                <Badge variant="secondary">
                  {selectedTool.enabled
                    ? t('tools.status.enabled')
                    : t('tools.status.disabled')}
                </Badge>
              </div>
              {selectedTool.displayName ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {selectedTool.name}
                </p>
              ) : null}
            </div>
          </div>

          {message ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('tools.details')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="text-sm font-medium">{t('tools.name')}</div>
                <div className="break-words text-sm text-muted-foreground">
                  {selectedTool.name}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="text-sm font-medium">{t('tools.status')}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedTool.enabled
                    ? t('tools.status.enabled')
                    : t('tools.status.disabled')}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <div className="text-sm font-medium">
                  {t('tools.description')}
                </div>
                <div className="break-words text-sm whitespace-pre-wrap text-muted-foreground">
                  {selectedTool.description || t('tools.noDescription')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      {navigation}
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-balance">
              {t('tools.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t('tools.summary', {
                enabled: enabledCount,
                total: tools.length,
              })}
            </p>
          </div>
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
            name="tool-search"
            aria-label={t('tools.search')}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('tools.search')}
            className="pl-9"
          />
        </div>

        {loading && !tools.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : filteredTools.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTools.map((tool) => (
              <Card
                key={tool.name}
                size="sm"
                className="cursor-pointer transition-colors hover:bg-accent/30"
                onClick={() => setSelectedName(tool.name)}
              >
                <CardHeader>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <WrenchIcon className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <CardTitle className="break-words">
                        {toolLabel(tool)}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {tool.description || t('tools.noDescription')}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {tool.enabled
                        ? t('tools.status.enabled')
                        : t('tools.status.disabled')}
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
                {query ? <SearchIcon /> : <WrenchIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {query ? t('tools.noMatches') : t('tools.empty')}
              </EmptyTitle>
              {!query ? (
                <EmptyDescription>{t('tools.empty')}</EmptyDescription>
              ) : null}
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
