import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  placeholder,
  tooltips,
  type DecorationSet,
} from '@codemirror/view';
import {
  EditorState,
  Compartment,
  Prec,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionStatus,
  moveCompletionSelection,
  startCompletion,
  type CompletionSource,
} from '@codemirror/autocomplete';
import { minimalSetup } from 'codemirror';
import type { CommandInfo } from '../adapters/types';
import type { PromptImage } from '../adapters/promptTypes';
import {
  useOptionalWorkspace,
  type UseDaemonFollowupSuggestionReturn,
} from '@qwen-code/webui/daemon-react-sdk';
import {
  slashCompletionSource,
  getImplicitTabCompletion,
  getMissingSlashPrefixCompletion,
  type SkillInfo,
} from '../completions/slashCompletion';
import type { CommandDisplayCategoryOrder } from '../utils/commandDisplay';
import { createAtCompletionSource } from '../completions/atCompletion';
import { useInputHistory } from '../hooks/useInputHistory';
import { useI18n } from '../i18n';
import {
  inputHighlight,
  inputHighlightTheme,
} from '../extensions/inputHighlight';
import { isEditableTarget } from '../utils/dom';
import type {
  WebShellComposerApi,
  WebShellComposerInput,
  WebShellComposerTag,
  WebShellComposerTagOptions,
  WebShellComposerTextOptions,
} from '../customization';

// ---- Large paste handling (shared utilities) ----

const LARGE_PASTE_CHAR_THRESHOLD = 1000;
const LARGE_PASTE_LINE_THRESHOLD = 10;

export function normalizePastedText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function isLargePaste(text: string): boolean {
  return (
    [...text].length > LARGE_PASTE_CHAR_THRESHOLD ||
    text.split('\n').length > LARGE_PASTE_LINE_THRESHOLD
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface LargePastePlaceholderResult {
  placeholderText: string;
  nextPasteId: number;
}

export function createLargePastePlaceholder(
  pendingPastes: Map<string, string>,
  nextPasteId: number,
  pasted: string,
): LargePastePlaceholderResult {
  const charCount = [...pasted].length;
  const base = `[Pasted Content ${charCount} chars]`;
  const placeholderText = nextPasteId === 1 ? base : `${base} #${nextPasteId}`;
  pendingPastes.set(placeholderText, pasted);
  return { placeholderText, nextPasteId: nextPasteId + 1 };
}

export function prunePendingPastes(
  pendingPastes: Map<string, string>,
  docText: string,
): number | null {
  for (const placeholderText of pendingPastes.keys()) {
    if (!docText.includes(placeholderText)) {
      pendingPastes.delete(placeholderText);
    }
  }
  return pendingPastes.size === 0 ? 1 : null;
}

export function expandLargePastePlaceholders(
  pendingPastes: Map<string, string>,
  text: string,
): string {
  if (pendingPastes.size === 0) return text;
  const placeholders = [...pendingPastes.keys()].sort(
    (a, b) => b.length - a.length,
  );
  const pattern = new RegExp(placeholders.map(escapeRegExp).join('|'), 'g');
  return text.replace(
    pattern,
    (placeholderText) => pendingPastes.get(placeholderText) ?? placeholderText,
  );
}

// ---- Tag serialization (shared) ----

export function serializeComposerTag(tag: WebShellComposerTag): string {
  return tag.value?.trim() || tag.label?.trim() || tag.id;
}

function serializeComposerTags(tags: readonly WebShellComposerTag[]): string {
  return tags.map(serializeComposerTag).join('\n');
}

export function getComposerTagLabel(tag: WebShellComposerTag): string {
  return tag.label?.trim() ?? '';
}

export function getComposerTagValue(tag: WebShellComposerTag): string {
  return tag.value?.trim() ?? '';
}

export function getComposerTagDisplay(tag: WebShellComposerTag): string {
  return getComposerTagValue(tag) || getComposerTagLabel(tag) || tag.id;
}

export function buildComposerPrompt(
  text: string,
  tags: readonly WebShellComposerTag[],
): string {
  const tagText = serializeComposerTags(tags);
  if (!tagText) return text;
  if (!text) return tagText;
  return `${tagText}\n\n${text}`;
}

// ---- Inline tag CodeMirror extension (shared) ----

interface InlineTagRange {
  from: number;
  to: number;
  tag: WebShellComposerTag;
}

interface InlineTagDecorationSpec {
  tag: WebShellComposerTag;
}

export const addInlineTagEffect = StateEffect.define<InlineTagRange>({
  map: (value) => value,
});
export const removeInlineTagEffect = StateEffect.define<{
  predicate?: (tag: WebShellComposerTag) => boolean;
}>();
export const clearInlineTagsEffect = StateEffect.define<void>();

class ComposerTagWidget extends WidgetType {
  constructor(private readonly tag: WebShellComposerTag) {
    super();
  }

  eq(other: ComposerTagWidget): boolean {
    return (
      this.tag.id === other.tag.id &&
      this.tag.label === other.tag.label &&
      this.tag.value === other.tag.value &&
      this.tag.removable === other.tag.removable
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.style.cssText =
      'display:inline-flex;align-items:center;max-width:min(44ch,100%);min-height:20px;margin:0 0.25ch;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-tertiary);color:var(--text-primary);font-family:var(--font-mono,monospace);font-size:12px;line-height:1.2;vertical-align:baseline;';
    const tagLabel = getComposerTagLabel(this.tag);
    const tagValue = getComposerTagValue(this.tag);

    if (tagLabel) {
      const label = document.createElement('span');
      label.style.cssText =
        'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0 3px 7px;color:var(--accent-color);';
      label.textContent = tagLabel;
      chip.appendChild(label);
    }

    if (tagValue) {
      const value = document.createElement('span');
      value.style.cssText =
        'max-width:32ch;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0 3px 0.5ch;color:var(--text-secondary);';
      value.textContent = tagValue;
      chip.appendChild(value);
    } else if (!tagLabel) {
      const fallback = document.createElement('span');
      fallback.style.cssText =
        'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 0 3px 7px;color:var(--accent-color);';
      fallback.textContent = this.tag.id;
      chip.appendChild(fallback);
    }

    if (this.tag.removable !== false) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute(
        'aria-label',
        `Remove ${getComposerTagDisplay(this.tag)}`,
      );
      remove.style.cssText =
        'flex:0 0 auto;width:22px;height:22px;padding:0;border:0;background:transparent;color:var(--text-dimmed);font:inherit;line-height:22px;cursor:pointer;';
      remove.textContent = '×';
      remove.addEventListener('mousedown', (event) => event.preventDefault());
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        const changes: Array<{ from: number; to: number; insert: string }> = [];
        view.state
          .field(inlineComposerTagField)
          .between(0, view.state.doc.length, (from, to, value) => {
            const tag = (value.spec as Partial<InlineTagDecorationSpec>).tag;
            if (tag?.id === this.tag.id && tag.removable !== false) {
              changes.push({ from, to, insert: '' });
            }
          });
        if (changes.length === 0) return;
        view.dispatch({
          changes,
          effects: removeInlineTagEffect.of({
            predicate: (tag) => tag.id === this.tag.id,
          }),
          scrollIntoView: true,
        });
        view.focus();
      });
      remove.addEventListener('mouseenter', () => {
        remove.style.color = 'var(--error-color)';
      });
      remove.addEventListener('mouseleave', () => {
        remove.style.color = 'var(--text-dimmed)';
      });
      chip.appendChild(remove);
    }

    return chip;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function createInlineTagDecoration(range: InlineTagRange) {
  const spec = {
    widget: new ComposerTagWidget(range.tag),
    inclusive: false,
    tag: range.tag,
  };
  return Decoration.replace(spec).range(range.from, range.to);
}

const inlineComposerTagField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(tags, tr) {
    let next = tags.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addInlineTagEffect)) {
        next = next.update({ add: [createInlineTagDecoration(effect.value)] });
      } else if (effect.is(removeInlineTagEffect)) {
        next = next.update({
          filter: (_from, _to, value) => {
            const tag = (value.spec as Partial<InlineTagDecorationSpec>).tag;
            if (!tag) return true;
            return effect.value.predicate ? !effect.value.predicate(tag) : true;
          },
        });
      } else if (effect.is(clearInlineTagsEffect)) {
        next = Decoration.none;
      }
    }
    return next;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

export function getInlineComposerTags(view: EditorView): WebShellComposerTag[] {
  const tags: WebShellComposerTag[] = [];
  view.state
    .field(inlineComposerTagField)
    .between(0, view.state.doc.length, (_from, _to, value) => {
      const tag = (value.spec as Partial<InlineTagDecorationSpec>).tag;
      if (tag) tags.push(tag);
    });
  return tags;
}

// ---- EditorHandle type (shared) ----

export interface EditorHandle extends WebShellComposerApi {
  clearText(): void;
  focus(): void;
  getText(): string;
  hasInput(): boolean;
  retryLast(): void;
}

// ---- Compartments (shared) ----

export const editableCompartment = new Compartment();
export const placeholderCompartment = new Compartment();

// ---- Hook options ----

export interface UseComposerCoreOptions {
  onSubmit: (text: string, images?: PromptImage[]) => boolean | void;
  onCycleMode?: () => void;
  onToggleShortcuts?: () => void;
  disabled?: boolean;
  placeholderText?: string;
  commands: CommandInfo[];
  skills?: SkillInfo[];
  slashCommandCategoryOrder?: CommandDisplayCategoryOrder;
  queuedMessages?: string[];
  onPopQueuedMessages?: () => string | null;
  onClearQueuedMessages?: () => boolean;
  currentMode?: string;
  draftText?: string;
  draftVersion?: number;
  onFocusFooter?: () => boolean;
  dialogOpen?: boolean;
  followupState?: UseDaemonFollowupSuggestionReturn['followupState'];
  onAcceptFollowup?: UseDaemonFollowupSuggestionReturn['onAcceptFollowup'];
  onDismissFollowup?: UseDaemonFollowupSuggestionReturn['onDismissFollowup'];
  sessionName?: string;
  composerInput?: WebShellComposerInput;
  composerInputVersion?: number;
  /** CodeMirror theme extension for the editor view. Each variant provides its own. */
  editorTheme: Parameters<typeof EditorView.theme>[0];
}

export interface SearchState {
  searchMode: boolean;
  searchQuery: string;
  searchMatches: string[];
  searchActiveIndex: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchUiRef: React.RefObject<HTMLDivElement | null>;
  openHistorySearch: () => void;
  closeSearch: (restoreDraft: boolean, keepFocus?: boolean) => void;
  submitSearchMatch: (match: string) => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSearchInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface UseComposerCoreReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewRef: React.RefObject<EditorView | null>;
  focus: () => void;
  submitText: () => void;
  clearText: () => void;
  getText: () => string;
  hasInput: () => boolean;
  hasContent: boolean;
  handle: EditorHandle;
  pastedImages: PromptImage[];
  removeImage: (index: number) => void;
  composerTags: WebShellComposerTag[];
  removeTopTag: (id: string) => void;
  addTags: (
    tags: readonly WebShellComposerTag[],
    options?: WebShellComposerTagOptions,
  ) => void;
  removeInlineTags: (predicate?: (tag: WebShellComposerTag) => boolean) => void;
  insertText: (text: string, options?: WebShellComposerTextOptions) => void;
  setText: (text: string) => void;
  submit: (input?: WebShellComposerInput) => void;
  clear: (options?: { text?: boolean; tags?: boolean }) => void;
  retryLast: () => void;
  replaceEditorText: (text: string) => void;
  shellMode: boolean;
  setShellMode: React.Dispatch<React.SetStateAction<boolean>>;
  currentMode: string;
  sessionName: string | undefined;
  searchState: SearchState;
  navigatePrevHistory: () => void;
  navigateNextHistory: () => void;
  showShortcutHints: boolean;
  followupState: UseDaemonFollowupSuggestionReturn['followupState'];
  disabled: boolean;
  onAcceptFollowup: UseDaemonFollowupSuggestionReturn['onAcceptFollowup'];
  onDismissFollowup: UseDaemonFollowupSuggestionReturn['onDismissFollowup'];
}

export function useComposerCore(
  options: UseComposerCoreOptions,
): UseComposerCoreReturn {
  const {
    onSubmit,
    onCycleMode,
    onToggleShortcuts,
    disabled = false,
    placeholderText = 'Type a message...',
    commands,
    skills = [],
    slashCommandCategoryOrder,
    queuedMessages = [],
    onPopQueuedMessages,
    onClearQueuedMessages,
    currentMode = 'default',
    draftText,
    draftVersion,
    onFocusFooter,
    dialogOpen = false,
    followupState,
    onAcceptFollowup,
    onDismissFollowup,
    sessionName,
    composerInput,
    composerInputVersion,
    editorTheme,
  } = options;

  const workspace = useOptionalWorkspace();
  const { language, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onCycleModeRef = useRef(onCycleMode);
  onCycleModeRef.current = onCycleMode;
  const onToggleShortcutsRef = useRef(onToggleShortcuts);
  onToggleShortcutsRef.current = onToggleShortcuts;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const skillsRef = useRef(skills);
  skillsRef.current = skills;
  const slashCommandCategoryOrderRef = useRef(slashCommandCategoryOrder);
  slashCommandCategoryOrderRef.current = slashCommandCategoryOrder;
  const tRef = useRef(t);
  tRef.current = t;
  const queuedMessagesRef = useRef(queuedMessages);
  queuedMessagesRef.current = queuedMessages;
  const onPopQueuedMessagesRef = useRef(onPopQueuedMessages);
  onPopQueuedMessagesRef.current = onPopQueuedMessages;
  const onClearQueuedMessagesRef = useRef(onClearQueuedMessages);
  onClearQueuedMessagesRef.current = onClearQueuedMessages;
  const followupStateRef = useRef(followupState);
  followupStateRef.current = followupState;
  const onAcceptFollowupRef = useRef(onAcceptFollowup);
  onAcceptFollowupRef.current = onAcceptFollowup;
  const onDismissFollowupRef = useRef(onDismissFollowup);
  onDismissFollowupRef.current = onDismissFollowup;
  const onFocusFooterRef = useRef(onFocusFooter);
  onFocusFooterRef.current = onFocusFooter;
  const languageRef = useRef(language);
  languageRef.current = language;
  const workspaceActionsRef = useRef(workspace?.actions);
  workspaceActionsRef.current = workspace?.actions;
  const [shellMode, setShellMode] = useState(false);
  const shellModeRef = useRef(shellMode);
  shellModeRef.current = shellMode;
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchUiRef = useRef<HTMLDivElement>(null);
  const searchDraftRef = useRef('');
  const [pastedImages, setPastedImages] = useState<PromptImage[]>([]);
  const pastedImagesRef = useRef<PromptImage[]>([]);
  const pendingPastesRef = useRef<Map<string, string>>(new Map());
  const nextPasteIdRef = useRef(1);
  const [composerTags, setComposerTags] = useState<WebShellComposerTag[]>([]);
  const composerTagsRef = useRef<WebShellComposerTag[]>([]);
  composerTagsRef.current = composerTags;
  const composerInputRef = useRef(composerInput);
  composerInputRef.current = composerInput;
  const submitTextRef = useRef<
    (
      view: EditorView,
      textOverride?: string,
      tagsOverride?: readonly WebShellComposerTag[],
    ) => boolean
  >(() => true);
  const autoTriggerRef = useRef<{ text: string; from: number } | null>(null);

  // Track whether editor has content for send button state
  const [hasContent, setHasContent] = useState(false);

  // Update hasContent when tags or images change
  useEffect(() => {
    const view = viewRef.current;
    const text = view?.state.doc.toString().trim() ?? '';
    setHasContent(
      text.length > 0 || composerTags.length > 0 || pastedImages.length > 0,
    );
  }, [composerTags, pastedImages]);

  const promptHistory = useInputHistory();
  const shellHistory = useInputHistory('qwen-web-shell-command-history');

  const {
    push,
    navigateUp,
    navigateDown,
    isNavigating,
    reset,
    getReverseMatches,
    getLastEntry,
    resetSearch,
  } = promptHistory;
  const historyActionsRef = useRef({
    push,
    navigateUp,
    navigateDown,
    isNavigating,
    reset,
    getReverseMatches,
    getLastEntry,
    resetSearch,
  });
  historyActionsRef.current = {
    push,
    navigateUp,
    navigateDown,
    isNavigating,
    reset,
    getReverseMatches,
    getLastEntry,
    resetSearch,
  };
  const shellHistoryActionsRef = useRef(shellHistory);
  shellHistoryActionsRef.current = shellHistory;
  pastedImagesRef.current = pastedImages;

  const openHistorySearch = useCallback(() => {
    if (disabledRef.current) return;
    const view = viewRef.current;
    if (!view) return;
    const query = view.state.doc.toString();
    searchDraftRef.current = query;
    setSearchMode(true);
    setSearchQuery(query);
    const history = shellModeRef.current
      ? shellHistoryActionsRef.current
      : historyActionsRef.current;
    setSearchMatches(history.getReverseMatches(query));
    setSearchActiveIndex(0);
    history.resetSearch();
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);
  const openHistorySearchRef = useRef(openHistorySearch);
  openHistorySearchRef.current = openHistorySearch;

  const navigatePrevHistory = useCallback(() => {
    if (disabledRef.current) return;
    const view = viewRef.current;
    if (!view) return;
    if (completionStatus(view.state) === 'active') {
      moveCompletionSelection(false)(view);
      view.focus();
      return;
    }
    if (view.state.doc.lines > 1) {
      view.focus();
      return;
    }
    const history = shellModeRef.current
      ? shellHistoryActionsRef.current
      : historyActionsRef.current;
    const current = view.state.doc.toString();
    const prev = history.navigateUp(current);
    if (prev !== null) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: prev },
        selection: { anchor: prev.length },
      });
    }
    view.focus();
  }, []);

  const navigateNextHistory = useCallback(() => {
    if (disabledRef.current) return;
    const view = viewRef.current;
    if (!view) return;
    if (completionStatus(view.state) === 'active') {
      moveCompletionSelection(true)(view);
      view.focus();
      return;
    }
    if (view.state.doc.lines > 1) {
      view.focus();
      return;
    }
    const history = shellModeRef.current
      ? shellHistoryActionsRef.current
      : historyActionsRef.current;
    const next = history.navigateDown();
    if (next !== null) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        selection: { anchor: next.length },
      });
    }
    view.focus();
  }, []);

  // ---- Create CodeMirror EditorView ----
  useEffect(() => {
    if (!containerRef.current) return;

    const tooltipPortal = document.createElement('div');
    tooltipPortal.setAttribute('data-web-shell-tooltip-portal', '');
    tooltipPortal.style.position = 'fixed';
    tooltipPortal.style.inset = '0';
    tooltipPortal.style.zIndex = 'var(--web-shell-tooltip-z-index)';
    tooltipPortal.style.pointerEvents = 'none';
    const THEME_RE = /\b\S*theme(?:Dark|Light)\S*/gi;
    const syncTheme = () => {
      let el: Element | null = containerRef.current;
      let themeClass: string | null = null;
      if (containerRef.current) {
        const computedStyle = getComputedStyle(containerRef.current);
        for (let i = 0; i < computedStyle.length; i += 1) {
          const name = computedStyle[i];
          if (name.startsWith('--')) {
            tooltipPortal.style.setProperty(
              name,
              computedStyle.getPropertyValue(name),
            );
          }
        }
        if (
          !computedStyle.getPropertyValue('--web-shell-tooltip-z-index').trim()
        ) {
          tooltipPortal.style.setProperty(
            '--web-shell-tooltip-z-index',
            '1000',
          );
        }
      }
      while (el) {
        const match = el.className?.match?.(THEME_RE);
        if (match) {
          themeClass = match[0];
          break;
        }
        el = el.parentElement;
      }
      if (themeClass) {
        tooltipPortal.className = themeClass;
      }
    };
    syncTheme();
    document.body.appendChild(tooltipPortal);

    const observer = new MutationObserver(syncTheme);
    let el: Element | null = containerRef.current;
    while (el) {
      observer.observe(el, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      if (el.className?.match?.(THEME_RE)) break;
      el = el.parentElement;
    }

    const submitText = (
      view: EditorView,
      textOverride?: string,
      tagsOverride?: readonly WebShellComposerTag[],
    ) => {
      const rawText = (textOverride ?? view.state.doc.toString()).trim();
      const tags = tagsOverride ?? composerTagsRef.current;
      if (!rawText && tags.length === 0) return true;
      const text = expandLargePastePlaceholders(
        pendingPastesRef.current,
        rawText,
      );
      const prompt = buildComposerPrompt(text, tags);
      const images = pastedImagesRef.current;
      const isShellMode = shellModeRef.current;
      const accepted = onSubmitRef.current(
        isShellMode ? `!${prompt}` : prompt,
        images.length > 0 ? [...images] : undefined,
      );
      if (accepted === false) return true;
      onDismissFollowupRef.current?.();
      pendingPastesRef.current.clear();
      nextPasteIdRef.current = 1;
      if (isShellMode) {
        shellHistoryActionsRef.current.push(text);
        shellHistoryActionsRef.current.reset();
      } else {
        historyActionsRef.current.push(text);
        historyActionsRef.current.reset();
      }
      setComposerTags([]);
      setPastedImages([]);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        effects: clearInlineTagsEffect.of(),
      });
      return true;
    };
    submitTextRef.current = submitText;

    const completionSources: CompletionSource[] = [
      slashCompletionSource(
        () => commandsRef.current,
        () => skillsRef.current,
        () => languageRef.current,
        (key) => tRef.current(key),
        () => slashCommandCategoryOrderRef.current,
      ),
      createAtCompletionSource(
        () => workspaceActionsRef.current?.globWorkspace,
      ),
    ];

    const insertNewline = (view: EditorView) => {
      view.dispatch(view.state.replaceSelection('\n'));
      return true;
    };

    const submitKeymap = keymap.of([
      {
        key: 'Backspace',
        run: (view) => {
          const selection = view.state.selection.main;
          if (!selection.empty || selection.from !== 0) return false;
          let hasInlineTagAtStart = false;
          view.state.field(inlineComposerTagField).between(0, 1, (from) => {
            if (from === 0) hasInlineTagAtStart = true;
          });
          if (hasInlineTagAtStart) return false;
          let removableIndex = -1;
          for (let i = composerTagsRef.current.length - 1; i >= 0; i -= 1) {
            if (composerTagsRef.current[i]?.removable !== false) {
              removableIndex = i;
              break;
            }
          }
          if (removableIndex < 0) return false;
          setComposerTags((current) =>
            current.filter((_, index) => index !== removableIndex),
          );
          return true;
        },
      },
      {
        key: 'Delete',
        run: (view) => {
          const selection = view.state.selection.main;
          if (!selection.empty || selection.from !== 0) return false;
          let hasInlineTagAtStart = false;
          view.state.field(inlineComposerTagField).between(0, 1, (from) => {
            if (from === 0) hasInlineTagAtStart = true;
          });
          if (hasInlineTagAtStart) return false;
          const removableIndex = composerTagsRef.current.findIndex(
            (tag) => tag.removable !== false,
          );
          if (removableIndex < 0) return false;
          setComposerTags((current) =>
            current.filter((_, index) => index !== removableIndex),
          );
          return true;
        },
      },
      {
        key: 'Enter',
        run: (view) => {
          if (completionStatus(view.state) === 'active') return false;
          const followup = followupStateRef.current;
          if (
            view.state.doc.toString().length === 0 &&
            followup?.isVisible &&
            followup.suggestion
          ) {
            onAcceptFollowupRef.current?.('enter', { skipOnAccept: true });
            return submitText(view, followup.suggestion);
          }
          return submitText(view);
        },
      },
      {
        key: 'Shift-Enter',
        run: insertNewline,
      },
      {
        key: 'Ctrl-j',
        run: insertNewline,
      },
      {
        key: 'Mod-Enter',
        run: insertNewline,
      },
      {
        key: 'Alt-Enter',
        run: insertNewline,
      },
      {
        key: 'Escape',
        run: () => {
          if (shellModeRef.current) {
            setShellMode(false);
            return true;
          }
          if (queuedMessagesRef.current.length === 0) return false;
          return onClearQueuedMessagesRef.current?.() ?? false;
        },
      },
      {
        key: 'Ctrl-o',
        run: () => true,
      },
      {
        key: 'Ctrl-l',
        run: () => true,
      },
      {
        key: 'Ctrl-y',
        run: () => true,
      },
      {
        key: 'ArrowUp',
        run: (view) => {
          const history = shellModeRef.current
            ? shellHistoryActionsRef.current
            : historyActionsRef.current;
          const isBrowsingHistory = history.isNavigating();
          if (completionStatus(view.state) === 'active' && !isBrowsingHistory) {
            return moveCompletionSelection(false)(view);
          }
          if (isBrowsingHistory) {
            closeCompletion(view);
          }
          if (view.state.doc.lines > 1) return false;
          if (shellModeRef.current) {
            const current = view.state.doc.toString();
            const prev = history.navigateUp(current);
            if (prev === null) return true;
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: prev },
              selection: { anchor: prev.length },
            });
            return true;
          }
          if (queuedMessagesRef.current.length > 0) {
            const queuedText = onPopQueuedMessagesRef.current?.();
            if (queuedText) {
              const current = view.state.doc.toString();
              const next = current.trim()
                ? `${queuedText}\n${current}`
                : queuedText;
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: next },
                selection: { anchor: next.length },
              });
              return true;
            }
          }
          const current = view.state.doc.toString();
          const prev = history.navigateUp(current);
          if (prev === null) return false;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: prev },
            selection: { anchor: prev.length },
          });
          return true;
        },
      },
      {
        key: 'ArrowDown',
        run: (view) => {
          const history = shellModeRef.current
            ? shellHistoryActionsRef.current
            : historyActionsRef.current;
          const isBrowsingHistory = history.isNavigating();
          if (completionStatus(view.state) === 'active' && !isBrowsingHistory) {
            return moveCompletionSelection(true)(view);
          }
          if (isBrowsingHistory) {
            closeCompletion(view);
          }
          if (view.state.doc.lines > 1) return false;
          if (shellModeRef.current) {
            const next = history.navigateDown();
            if (next === null) return true;
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: next },
              selection: { anchor: next.length },
            });
            return true;
          }
          const next = history.navigateDown();
          if (next === null) {
            return onFocusFooterRef.current?.() ?? false;
          }
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next },
            selection: { anchor: next.length },
          });
          return true;
        },
      },
      {
        key: 'Ctrl-r',
        run: () => {
          openHistorySearchRef.current();
          return true;
        },
      },
      {
        key: 'Tab',
        run: (view) => {
          if (completionStatus(view.state) === 'active') {
            return acceptCompletion(view);
          }
          const text = view.state.doc.toString();
          const implicitResult = getImplicitTabCompletion(
            text,
            commandsRef.current,
            languageRef.current,
          );
          if (implicitResult) {
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: implicitResult,
              },
              selection: { anchor: implicitResult.length },
            });
            return true;
          }
          const missingSlash = getMissingSlashPrefixCompletion(
            text,
            commandsRef.current,
          );
          if (missingSlash) {
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: missingSlash,
              },
              selection: { anchor: missingSlash.length },
            });
            return true;
          }
          const followup = followupStateRef.current;
          if (text.length === 0 && followup?.isVisible && followup.suggestion) {
            onAcceptFollowupRef.current?.('tab');
            return true;
          }
          return true;
        },
      },
      {
        key: 'ArrowRight',
        run: (view) => {
          const followup = followupStateRef.current;
          if (
            completionStatus(view.state) !== 'active' &&
            view.state.doc.toString().length === 0 &&
            followup?.isVisible &&
            followup.suggestion
          ) {
            onAcceptFollowupRef.current?.('right');
            return true;
          }
          return false;
        },
      },
      {
        key: 'Shift-Tab',
        run: () => {
          onCycleModeRef.current?.();
          return true;
        },
      },
    ]);

    const slashCompletionRestarter = EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) {
        return;
      }
      if (update.docChanged && pendingPastesRef.current.size > 0) {
        const nextPasteId = prunePendingPastes(
          pendingPastesRef.current,
          update.state.doc.toString(),
        );
        if (nextPasteId !== null) {
          nextPasteIdRef.current = nextPasteId;
        }
      }
      const selection = update.state.selection.main;
      if (!selection.empty) return;
      const line = update.state.doc.lineAt(selection.head);
      const shouldCompleteSlash = line.from === 0 && line.text.startsWith('/');
      if (!shouldCompleteSlash) return;
      window.setTimeout(() => {
        const view = viewRef.current;
        if (!view || completionStatus(view.state) === 'active') return;
        const nextSelection = view.state.selection.main;
        if (!nextSelection.empty) return;
        const nextLine = view.state.doc.lineAt(nextSelection.head);
        if (nextLine.from === 0 && nextLine.text.startsWith('/')) {
          startCompletion(view);
        }
      }, 0);
    });

    let prevCompletionActive = false;
    const triggerCleanupListener = EditorView.updateListener.of((update) => {
      const trigger = autoTriggerRef.current;
      const nowActive = completionStatus(update.state) === 'active';
      if (trigger) {
        const doc = update.state.doc;
        const intact =
          doc.length === trigger.from + trigger.text.length &&
          doc.sliceString(trigger.from) === trigger.text;
        if (!intact) {
          autoTriggerRef.current = null;
        } else if (prevCompletionActive && !nowActive) {
          autoTriggerRef.current = null;
          const { view } = update;
          const { from } = trigger;
          window.setTimeout(() => {
            if (viewRef.current !== view) return;
            const d = view.state.doc;
            if (
              d.length === from + trigger.text.length &&
              d.sliceString(from) === trigger.text
            ) {
              view.dispatch({ changes: { from, to: d.length, insert: '' } });
            }
          }, 0);
        }
      }
      prevCompletionActive = nowActive;
    });

    const state = EditorState.create({
      doc: '',
      extensions: [
        Prec.highest(submitKeymap),
        minimalSetup,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        autocompletion({
          override: completionSources,
          activateOnTyping: true,
          icons: false,
          optionClass: (completion) =>
            completion.type === 'file'
              ? 'cm-file-completion'
              : completion.info
                ? 'cm-command-info-completion'
                : '',
          aboveCursor: true,
          positionInfo: (_view, list, option, info, space) => {
            const infoHeight = info.bottom - info.top;
            const spaceBelow = space.bottom - list.bottom;
            const placeBelow =
              spaceBelow >= infoHeight || spaceBelow > list.top;
            const side = placeBelow ? 'top' : 'bottom';
            const offset = placeBelow
              ? option.bottom - list.top
              : list.bottom - option.top;
            return {
              style: `${side}: ${offset}px`,
              class: 'cm-completionInfo-right-narrow',
            };
          },
          activateOnCompletion: (completion) =>
            typeof completion.apply === 'string' &&
            completion.apply.endsWith(' '),
        }),
        tooltips({ parent: tooltipPortal }),
        placeholderCompartment.of(placeholder('')),
        EditorView.lineWrapping,
        editableCompartment.of(EditorView.editable.of(true)),
        inputHighlight(
          () => commandsRef.current,
          () => languageRef.current,
        ),
        inputHighlightTheme,
        inlineComposerTagField,
        slashCompletionRestarter,
        triggerCleanupListener,
        // Update hasContent state when document changes
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString().trim();
            setHasContent(
              text.length > 0 ||
                composerTagsRef.current.length > 0 ||
                pastedImagesRef.current.length > 0,
            );
          }
        }),
        EditorView.inputHandler.of((view, from, to, insert) => {
          if (
            insert.length > 0 &&
            view.state.doc.toString() === '' &&
            followupStateRef.current?.isVisible
          ) {
            onDismissFollowupRef.current?.();
          }
          if (
            insert === '!' &&
            view.state.doc.toString() === '' &&
            completionStatus(view.state) !== 'active'
          ) {
            setShellMode((value) => !value);
            return true;
          }
          if (
            insert === '?' &&
            view.state.doc.toString() === '' &&
            completionStatus(view.state) !== 'active'
          ) {
            onToggleShortcutsRef.current?.();
            return true;
          }
          return false;
        }),
        EditorView.domEventHandlers({
          paste(event) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            let hasImage = false;
            for (const item of items) {
              if (
                item.type.startsWith('image/') &&
                /^image\/(png|jpeg|gif|webp)$/i.test(item.type)
              ) {
                hasImage = true;
                const file = item.getAsFile();
                if (!file) continue;
                const mediaType = item.type;
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  setPastedImages((prev) => [
                    ...prev,
                    { data: base64, media_type: mediaType },
                  ]);
                };
                reader.readAsDataURL(file);
              }
            }
            if (hasImage) {
              event.preventDefault();
              return true;
            }
            const pasted = normalizePastedText(
              event.clipboardData?.getData('text/plain') ?? '',
            );
            if (!pasted || !isLargePaste(pasted)) return false;

            event.preventDefault();
            if (
              view.state.doc.toString() === '' &&
              followupStateRef.current?.isVisible
            ) {
              onDismissFollowupRef.current?.();
            }
            const { placeholderText: pt, nextPasteId } =
              createLargePastePlaceholder(
                pendingPastesRef.current,
                nextPasteIdRef.current,
                pasted,
              );
            nextPasteIdRef.current = nextPasteId;
            const selection = view.state.selection.main;
            view.dispatch({
              changes: {
                from: selection.from,
                to: selection.to,
                insert: pt,
              },
              selection: { anchor: selection.from + pt.length },
              scrollIntoView: true,
            });
            return true;
          },
        }),
        EditorView.theme(editorTheme),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    view.focus();

    // Initial check
    const initialText = view.state.doc.toString().trim();
    setHasContent(
      initialText.length > 0 ||
        composerTagsRef.current.length > 0 ||
        pastedImagesRef.current.length > 0,
    );

    return () => {
      view.destroy();
      viewRef.current = null;
      observer.disconnect();
      tooltipPortal.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Reactions to prop changes ----

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(
        EditorView.editable.of(!disabled),
      ),
    });
    if (!disabled) {
      view.focus();
    }
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const followupSuggestion =
      followupState?.isVisible && followupState.suggestion
        ? followupState.suggestion
        : null;
    const nextPlaceholder = followupSuggestion ?? placeholderText;
    view.dispatch({
      effects: placeholderCompartment.reconfigure(placeholder(nextPlaceholder)),
    });
  }, [placeholderText, followupState?.isVisible, followupState?.suggestion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || draftText === undefined) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: draftText },
      selection: { anchor: draftText.length },
    });
    view.focus();
  }, [draftText, draftVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || completionStatus(view.state) !== 'active') return;
    closeCompletion(view);
    window.setTimeout(() => {
      if (viewRef.current === view) {
        startCompletion(view);
      }
    }, 0);
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (dialogOpen) {
      view.contentDOM.blur();
    } else {
      view.focus();
    }
  }, [dialogOpen]);

  // Global keydown handler for focus-stealing
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disabledRef.current || searchMode || dialogOpen) return;
      if (event.defaultPrevented) return;
      // Only capture keystrokes if the target is within the web-shell container
      // or if no specific element has focus (document.body is active)
      const target = event.target as Node;
      const isWithinContainer = containerRef.current?.contains(target);
      const isBodyFocused = document.activeElement === document.body;
      if (!isWithinContainer && !isBodyFocused) return;
      const view = viewRef.current;
      const followup = followupStateRef.current;
      if (
        view &&
        !view.hasFocus &&
        followup?.isVisible &&
        followup.suggestion &&
        view.state.doc.toString().length === 0 &&
        !isEditableTarget(event.target)
      ) {
        if (
          event.key === 'Tab' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          completionStatus(view.state) !== 'active'
        ) {
          event.preventDefault();
          onAcceptFollowupRef.current?.('tab');
          return;
        }
        if (
          event.key === 'ArrowRight' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          completionStatus(view.state) !== 'active'
        ) {
          event.preventDefault();
          onAcceptFollowupRef.current?.('right');
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      if (isEditableTarget(event.target)) return;

      if (!view || view.hasFocus) return;

      event.preventDefault();
      if (event.key === '!' && view.state.doc.toString() === '') {
        if (followupStateRef.current?.isVisible) {
          onDismissFollowupRef.current?.();
        }
        setShellMode((value) => !value);
        view.focus();
        return;
      }
      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: event.key },
        selection: { anchor: selection.from + event.key.length },
        scrollIntoView: true,
      });
      view.focus();
      if (event.key === '/' || event.key === '@') {
        window.setTimeout(() => {
          const nextView = viewRef.current;
          if (nextView && nextView.hasFocus) {
            startCompletion(nextView);
          }
        }, 0);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchMode, dialogOpen]);

  // ---- Imperative methods ----

  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  const insertText = useCallback(
    (text: string, options?: WebShellComposerTextOptions) => {
      const view = viewRef.current;
      if (!view || !text) {
        view?.focus();
        return;
      }
      if (options?.mode === 'replace') {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          effects: clearInlineTagsEffect.of(),
          selection: { anchor: text.length },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }
      const selection = view.state.selection.main;
      let insert = text;
      let skipInsert = false;
      let caretOverride: number | null = null;
      let openMenu = text === '/' || text === '@';
      if (text === '/') {
        const line = view.state.doc.lineAt(selection.head);
        if (line.text.startsWith('/')) {
          skipInsert = true;
        } else if (view.state.doc.length > 0) {
          skipInsert = true;
          openMenu = false;
        }
      } else if (text === '@') {
        const before =
          selection.from > 0
            ? view.state.doc.sliceString(selection.from - 1, selection.from)
            : '';
        const after = view.state.doc.sliceString(
          selection.from,
          selection.from + 1,
        );
        if (after === '@') {
          skipInsert = true;
          caretOverride = selection.from + 1;
        } else if (before === '@') {
          skipInsert = true;
        } else if (before && !/\s/.test(before)) {
          insert = ' @';
        }
      }
      if (!skipInsert) {
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert },
          selection: { anchor: selection.from + insert.length },
          scrollIntoView: true,
        });
        if (openMenu) {
          autoTriggerRef.current = { text: insert, from: selection.from };
        }
      } else if (caretOverride !== null) {
        view.dispatch({
          selection: { anchor: caretOverride },
          scrollIntoView: true,
        });
      }
      view.focus();
      if (openMenu) {
        window.setTimeout(() => {
          const nextView = viewRef.current;
          if (nextView && nextView.hasFocus) {
            startCompletion(nextView);
          }
        }, 0);
      }
    },
    [],
  );

  const getText = useCallback(() => {
    return viewRef.current?.state.doc.toString() ?? '';
  }, []);

  const setText = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      effects: clearInlineTagsEffect.of(),
      selection: { anchor: text.length },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const removeInlineTags = useCallback(
    (predicate?: (tag: WebShellComposerTag) => boolean) => {
      const view = viewRef.current;
      if (!view) return;
      const changes: Array<{ from: number; to: number; insert: string }> = [];
      view.state
        .field(inlineComposerTagField)
        .between(0, view.state.doc.length, (from, to, value) => {
          const tag = (value.spec as Partial<InlineTagDecorationSpec>).tag;
          if (tag && (!predicate || predicate(tag))) {
            changes.push({ from, to, insert: '' });
          }
        });
      view.dispatch({
        ...(changes.length > 0 ? { changes } : {}),
        effects: removeInlineTagEffect.of({ predicate }),
        scrollIntoView: true,
      });
    },
    [],
  );

  const clear = useCallback(
    (options?: { text?: boolean; tags?: boolean }) => {
      const clearTextOpt = options?.text ?? true;
      const clearTags = options?.tags ?? true;
      const view = viewRef.current;
      if (clearTextOpt && view && view.state.doc.length > 0) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: '' },
          effects: clearInlineTagsEffect.of(),
        });
      }
      if (clearTextOpt) {
        setPastedImages([]);
        pendingPastesRef.current.clear();
        nextPasteIdRef.current = 1;
      }
      if (clearTags) {
        setComposerTags([]);
        if (!clearTextOpt) {
          removeInlineTags();
        }
      }
    },
    [removeInlineTags],
  );

  const clearText = useCallback(() => {
    clear({ text: true, tags: false });
  }, [clear]);

  const addTags = useCallback(
    (
      tags: readonly WebShellComposerTag[],
      tagOptions?: WebShellComposerTagOptions,
    ) => {
      if (tags.length === 0) return;
      if (tagOptions?.placement === 'inline') {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        let at = selection.from;
        const ranges: InlineTagRange[] = [];
        const insert = tags
          .map((tag) => {
            const tagText = serializeComposerTag(tag);
            ranges.push({ from: at, to: at + tagText.length, tag });
            at += tagText.length + 1;
            return tagText;
          })
          .join(' ');
        const text = insert ? `${insert} ` : '';
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          effects:
            ranges.length > 0
              ? ranges.map((range) => addInlineTagEffect.of(range))
              : undefined,
          selection: { anchor: selection.from + text.length },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }
      setComposerTags((current) => {
        const next = [...current];
        for (const tag of tags) {
          const existingIndex = next.findIndex((item) => item.id === tag.id);
          if (existingIndex >= 0) {
            next[existingIndex] = tag;
          } else {
            next.push(tag);
          }
        }
        return next;
      });
    },
    [],
  );

  const removeTopTag = useCallback(
    (id: string) => {
      setComposerTags((current) =>
        current.filter((tag) => tag.id !== id || tag.removable === false),
      );
      removeInlineTags((tag) => tag.id === id && tag.removable !== false);
    },
    [removeInlineTags],
  );

  const hasInput = useCallback(() => {
    return (
      (viewRef.current?.state.doc.toString().trim().length ?? 0) > 0 ||
      composerTagsRef.current.length > 0 ||
      pastedImagesRef.current.length > 0
    );
  }, []);

  const submit = useCallback((input?: WebShellComposerInput) => {
    const view = viewRef.current;
    if (!view) return;
    const inlineTags = getInlineComposerTags(view);
    if (input?.tagPlacement === 'inline') {
      submitTextRef.current(
        view,
        buildComposerPrompt(input.text ?? '', input.tags ?? inlineTags),
        [],
      );
      return;
    }
    if (
      input?.text !== undefined &&
      input.tags === undefined &&
      inlineTags.length > 0
    ) {
      submitTextRef.current(
        view,
        buildComposerPrompt(input.text, inlineTags),
        [],
      );
      return;
    }
    submitTextRef.current(
      view,
      input?.text,
      input ? (input.tags ?? []) : undefined,
    );
  }, []);

  const retryLast = useCallback(() => {
    const last = historyActionsRef.current.getLastEntry(
      (e) => !e.startsWith('/') && !e.startsWith('!'),
    );
    if (!last) return;
    const accepted = onSubmitRef.current(last);
    if (accepted === false) return;
    setPastedImages([]);
  }, []);

  const replaceEditorText = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: text.length },
      scrollIntoView: true,
    });
  }, []);

  // ---- composerInput sync ----

  useEffect(() => {
    const input = composerInputRef.current;
    if (!input) return;
    const view = viewRef.current;
    if (!view) return;

    const tagPlacement = input.tagPlacement ?? 'top';
    if (input.tags !== undefined && tagPlacement === 'top') {
      setComposerTags([...input.tags]);
    }
    if (input.text !== undefined || tagPlacement === 'inline') {
      const inlineTags =
        tagPlacement === 'inline' ? [...(input.tags ?? [])] : [];
      const inlineText = inlineTags.map(serializeComposerTag).join(' ');
      const nextText =
        tagPlacement === 'inline'
          ? inlineText && input.text
            ? `${inlineText} ${input.text}`
            : inlineText || (input.text ?? '')
          : (input.text ?? '');
      const effects: StateEffect<unknown>[] = [clearInlineTagsEffect.of()];
      if (inlineTags.length > 0) {
        let from = 0;
        for (const tag of inlineTags) {
          const tagText = serializeComposerTag(tag);
          effects.push(
            addInlineTagEffect.of({
              from,
              to: from + tagText.length,
              tag,
            }),
          );
          from += tagText.length + 1;
        }
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextText },
        effects,
        selection: { anchor: nextText.length },
        scrollIntoView: true,
      });
    } else {
      view.dispatch({ effects: clearInlineTagsEffect.of() });
    }
    if (input.text !== undefined || input.submit) {
      view.focus();
    }
    let submitTimer: number | null = null;
    if (input.submit) {
      submitTimer = window.setTimeout(() => {
        const nextView = viewRef.current;
        if (!nextView) return;
        submit(input);
      }, 0);
    }
    return () => {
      if (submitTimer !== null) {
        window.clearTimeout(submitTimer);
      }
    };
  }, [composerInputVersion, submit]);

  // ---- Search state ----

  const closeSearch = useCallback(
    (restoreDraft: boolean, keepFocus = true) => {
      if (restoreDraft) {
        replaceEditorText(searchDraftRef.current);
      }
      setSearchMode(false);
      setSearchQuery('');
      setSearchMatches([]);
      setSearchActiveIndex(0);
      const history = shellModeRef.current
        ? shellHistoryActionsRef.current
        : historyActionsRef.current;
      history.resetSearch();
      if (keepFocus) {
        viewRef.current?.focus();
      }
    },
    [replaceEditorText],
  );

  useEffect(() => {
    if (!searchMode) return;
    const onPointerOutside = (event: Event) => {
      if (event instanceof MouseEvent && event.button !== 0) return;
      if (event.defaultPrevented) return;
      const panel = searchUiRef.current;
      const target = event.target;
      if (panel && target instanceof Node && !panel.contains(target)) {
        closeSearch(true, false);
      }
    };
    window.addEventListener('mousedown', onPointerOutside);
    window.addEventListener('touchstart', onPointerOutside);
    return () => {
      window.removeEventListener('mousedown', onPointerOutside);
      window.removeEventListener('touchstart', onPointerOutside);
    };
  }, [searchMode, closeSearch]);

  const submitSearchMatch = useCallback(
    (match: string) => {
      const view = viewRef.current;
      if (!view) return;
      closeSearch(false);
      const text = match.trim();
      if (!text) return;
      const images = pastedImagesRef.current;
      const isShellMode = shellModeRef.current;
      const accepted = onSubmitRef.current(
        isShellMode ? `!${text}` : text,
        images.length > 0 ? [...images] : undefined,
      );
      if (accepted === false) {
        replaceEditorText(match);
        return;
      }
      onDismissFollowupRef.current?.();
      if (isShellMode) {
        shellHistoryActionsRef.current.push(text);
        shellHistoryActionsRef.current.reset();
      } else {
        historyActionsRef.current.push(text);
        historyActionsRef.current.reset();
      }
      setPastedImages([]);
      replaceEditorText('');
    },
    [closeSearch, replaceEditorText],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const match = searchMatches[searchActiveIndex];
      if (match) {
        replaceEditorText(match);
      }
      closeSearch(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const match = searchMatches[searchActiveIndex];
      if (match) {
        submitSearchMatch(match);
      } else {
        closeSearch(false);
      }
    } else if (e.key === 'r' && e.ctrlKey) {
      e.preventDefault();
      if (searchMatches.length > 0) {
        setSearchActiveIndex((index) => (index + 1) % searchMatches.length);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        setSearchActiveIndex((index) => (index + 1) % searchMatches.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        setSearchActiveIndex(
          (index) => (index - 1 + searchMatches.length) % searchMatches.length,
        );
      }
    }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    const history = shellModeRef.current
      ? shellHistoryActionsRef.current
      : historyActionsRef.current;
    setSearchMatches(history.getReverseMatches(q));
    setSearchActiveIndex(0);
    history.resetSearch();
  };

  const removeImage = useCallback((index: number) => {
    setPastedImages((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  // ---- Computed ----

  const showShortcutHints =
    !shellMode &&
    !searchMode &&
    !followupState?.isVisible &&
    !disabled &&
    !dialogOpen;

  // ---- Imperative handle ----

  const handle: EditorHandle = {
    clearText,
    clear,
    focus,
    getText,
    hasInput,
    setText,
    addTags,
    removeTag: removeTopTag,
    insertText,
    retryLast,
    submit,
  };

  return {
    containerRef,
    viewRef,
    focus,
    submitText: useCallback(() => {
      const view = viewRef.current;
      if (!view) return;
      submitTextRef.current(view);
    }, []),
    clearText,
    getText,
    hasInput,
    hasContent,
    handle,
    pastedImages,
    removeImage,
    composerTags,
    removeTopTag,
    addTags,
    removeInlineTags,
    insertText,
    setText,
    submit,
    clear,
    retryLast,
    replaceEditorText,
    shellMode,
    setShellMode,
    currentMode,
    sessionName,
    searchState: {
      searchMode,
      searchQuery,
      searchMatches,
      searchActiveIndex,
      searchInputRef,
      searchUiRef,
      openHistorySearch,
      closeSearch,
      submitSearchMatch,
      handleSearchKeyDown,
      handleSearchInput,
    },
    navigatePrevHistory,
    navigateNextHistory,
    showShortcutHints,
    followupState:
      followupState as UseDaemonFollowupSuggestionReturn['followupState'],
    disabled,
    onAcceptFollowup:
      onAcceptFollowup as UseDaemonFollowupSuggestionReturn['onAcceptFollowup'],
    onDismissFollowup:
      onDismissFollowup as UseDaemonFollowupSuggestionReturn['onDismissFollowup'],
  };
}
