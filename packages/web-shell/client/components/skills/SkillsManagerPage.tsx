import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';
import {
  useSkills,
  type DaemonWorkspaceSkillStatus,
} from '@qwen-code/webui/daemon-react-sdk';
import { useI18n } from '../../i18n';
import {
  filterSkills,
  preserveCatalogSelection,
  type SkillLevelFilter,
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
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import type { EmbeddedManagerPage } from '../plugins/manager-page';

interface SkillsManagerPageProps {
  onClose: () => void;
  onUseSkill: (name: string) => void;
  embedded?: EmbeddedManagerPage;
}

function skillLevelLabel(
  skill: DaemonWorkspaceSkillStatus,
  t: ReturnType<typeof useI18n>['t'],
): string {
  return t(`skills.level.${skill.level}`);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="break-words text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

export function SkillsManagerPage({
  onClose,
  onUseSkill,
  embedded,
}: SkillsManagerPageProps) {
  const { t } = useI18n();
  const { status, skills, loading, error, reload } = useSkills({
    autoLoad: true,
  });
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<SkillLevelFilter>('all');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.name === selectedName),
    [selectedName, skills],
  );
  const filteredSkills = useMemo(
    () => filterSkills(skills, query, levelFilter),
    [levelFilter, query, skills],
  );
  const message = error?.message ?? status?.errors?.[0]?.error;
  const invocableCount = skills.filter((skill) => skill.modelInvocable).length;
  const levelOptions: Array<{
    value: SkillLevelFilter;
    label: string;
  }> = [
    { value: 'all', label: t('skills.filter.all') },
    { value: 'user', label: t('skills.filter.user') },
    { value: 'project', label: t('skills.filter.project') },
    { value: 'extension', label: t('skills.filter.extension') },
    { value: 'bundled', label: t('skills.filter.bundled') },
  ];

  useEffect(() => {
    setSelectedName((name) => preserveCatalogSelection(name, skills));
  }, [skills]);

  useEffect(() => {
    embedded?.onDetailChange(Boolean(selectedSkill));
  }, [embedded, selectedSkill]);

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
          {selectedSkill ? (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => setSelectedName(null)}>
                {t('skills.title')}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{t('skills.title')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {selectedSkill ? <BreadcrumbSeparator /> : null}
        {selectedSkill ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{selectedSkill.name}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
  const navigation = embedded ? (
    selectedSkill ? (
      <Breadcrumb className="sticky -top-4 z-10 -mx-5 -mt-4 border-b bg-background px-5 py-3">
        <BreadcrumbList className="h-8 text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={embedded.onRoot}>
                {t('skills.title')}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{selectedSkill.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ) : null
  ) : (
    standaloneNavigation
  );

  if (selectedSkill) {
    const invocation = `/${selectedSkill.name}${
      selectedSkill.argumentHint ? ` ${selectedSkill.argumentHint}` : ''
    }`;
    return (
      <div className="flex w-full flex-col gap-6 pb-8">
        {navigation}
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
              <SparklesIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-semibold text-balance">
                  {selectedSkill.name}
                </h1>
                <Badge variant="outline">
                  {skillLevelLabel(selectedSkill, t)}
                </Badge>
                {selectedSkill.modelInvocable ? (
                  <Badge variant="secondary">
                    {t('skills.modelInvocable')}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {selectedSkill.description || t('skills.noDescription')}
              </p>
            </div>
            <Button onClick={() => onUseSkill(selectedSkill.name)}>
              <PlayIcon data-icon="inline-start" />
              {t('skills.run')}
            </Button>
          </div>

          {message || selectedSkill.error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>
                {selectedSkill.error || message}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('skills.details')}</CardTitle>
              <CardDescription>
                {selectedSkill.description || t('skills.noDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <DetailField label={t('skills.invocation')} value={invocation} />
              <DetailField
                label={t('skills.level')}
                value={skillLevelLabel(selectedSkill, t)}
              />
              <DetailField
                label={t('skills.modelAccess')}
                value={
                  selectedSkill.modelInvocable
                    ? t('skills.modelAccess.enabled')
                    : t('skills.modelAccess.disabled')
                }
              />
              <DetailField
                label={t('skills.model')}
                value={selectedSkill.model || '-'}
              />
              <DetailField
                label={t('skills.extension')}
                value={selectedSkill.extensionName || '-'}
              />
              <DetailField
                label={t('skills.status')}
                value={selectedSkill.status}
              />
              {selectedSkill.hint ? (
                <div className="sm:col-span-2">
                  <DetailField
                    label={t('skills.hint')}
                    value={selectedSkill.hint}
                  />
                </div>
              ) : null}
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
              {t('skills.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {t('skills.invocable', {
                enabled: invocableCount,
                total: skills.length,
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
            name="skill-search"
            aria-label={t('skills.search')}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('skills.search')}
            className="pl-9"
          />
        </div>

        <ToggleGroup
          type="single"
          value={levelFilter}
          onValueChange={(value) => {
            if (value) setLevelFilter(value as SkillLevelFilter);
          }}
          variant="outline"
          size="sm"
          className="flex-wrap justify-start"
          aria-label={t('skills.filter.label')}
        >
          {levelOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {loading && !skills.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : filteredSkills.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredSkills.map((skill) => (
              <Card
                key={skill.name}
                size="sm"
                className="cursor-pointer transition-colors [contain-intrinsic-size:auto_128px] [content-visibility:auto] hover:bg-accent/30"
                onClick={() => setSelectedName(skill.name)}
              >
                <CardHeader>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <SparklesIcon className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <CardTitle className="break-words">
                        {skill.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {skill.description || t('skills.noDescription')}
                      </CardDescription>
                    </div>
                    {skill.modelInvocable ? (
                      <Badge variant="secondary" className="shrink-0">
                        {t('skills.modelInvocable')}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {query || levelFilter !== 'all' ? (
                  <SearchIcon />
                ) : (
                  <SparklesIcon />
                )}
              </EmptyMedia>
              <EmptyTitle>
                {query || levelFilter !== 'all'
                  ? t('skills.noMatches')
                  : t('skills.empty')}
              </EmptyTitle>
              {!query && levelFilter === 'all' ? (
                <EmptyDescription>{t('skills.empty')}</EmptyDescription>
              ) : null}
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
