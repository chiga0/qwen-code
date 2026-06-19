import {
  forwardRef,
  memo,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { DAEMON_APPROVAL_MODES } from '@qwen-code/webui/daemon-react-sdk';
import type { CommandInfo } from '../adapters/types';
import type { UseDaemonFollowupSuggestionReturn } from '@qwen-code/webui/daemon-react-sdk';
import type { CommandDisplayCategoryOrder } from '../utils/commandDisplay';
import type { SkillInfo } from '../completions/slashCompletion';
import { useI18n } from '../i18n';
import {
  useWebShellCustomization,
  type WebShellComposerInput,
  type WebShellComposerTag,
} from '../customization';
import {
  useComposerCore,
  type EditorHandle,
  getComposerTagDisplay,
  getComposerTagLabel,
  getComposerTagValue,
} from '../hooks/useComposerCore';
import './Editor.module.css';
import styles from './ChatEditor.module.css';

export type ComposerToolbarAction =
  | 'approvalMode'
  | 'model'
  | 'commands'
  | 'files'
  | 'widthMode';

interface ChatEditorProps {
  onSubmit: (
    text: string,
    images?: import('../adapters/promptTypes').PromptImage[],
  ) => boolean | void;
  onCycleMode?: () => void;
  onToggleShortcuts?: () => void;
  onCancel?: () => void;
  isRunning?: boolean;
  disabled?: boolean;
  placeholderText?: string;
  commands: CommandInfo[];
  skills?: SkillInfo[];
  slashCommandCategoryOrder?: CommandDisplayCategoryOrder;
  queuedMessages?: string[];
  onPopQueuedMessages?: () => string | null;
  onClearQueuedMessages?: () => boolean;
  currentMode?: string;
  currentModel?: string;
  chatWidthMode?: '1000' | 'wide';
  showChatWidthToggle?: boolean;
  chatWidthToggleMin?: number;
  visibleToolbarActions?: readonly ComposerToolbarAction[];
  availableModels?: Array<{ id: string; label?: string }>;
  onSelectMode?: (mode: string) => void;
  onSelectModel?: (model: string) => void;
  onChatWidthModeChange?: (mode: '1000' | 'wide') => void;
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
}

const CHAT_EDITOR_THEME = {
  '&': {
    fontSize: '14px',
    background: 'transparent',
    border: 'none',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'visible',
  },
  '.cm-content': {
    padding: '0',
    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    color: 'var(--text-primary, #e0e0e0)',
    caretColor: 'var(--accent-color, #4a9eff)',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-placeholder': {
    color: 'var(--text-dimmed, #666)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent-color, #4a9eff)',
    borderLeftWidth: '2px',
  },
};

function SendIcon() {
  return (
    <svg
      className={styles.sendIcon}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1 1L15 8L1 15V9.5L10 8L1 6.5V1Z" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return <span className={styles.stopIcon} aria-hidden="true" />;
}

function WidthModeIcon({ mode }: { mode: '1000' | 'wide' }) {
  if (mode === 'wide') {
    return (
      <svg viewBox="0 0 1024 1024" aria-hidden="true">
        <path
          d="M550.012 486.537a8.16 8.16 0 0 1 8.17-8.17h305.36l-111.88-111.89c-3.19-3.19-3.19-8.4 0-11.59l25.08-25.08c3.19-3.19 8.4-3.19 11.59 0l168.61 168.6c3.19 3.19 3.19 8.4 0 11.59l-164.47 168.67c-3.19 3.19-8.4 3.19-11.59 0l-25.61-25.61c-3.19-3.19-3.19-8.4 0-11.59l106.58-110.78-303.62 0.11c-4.52 0-8.23-3.71-8.23-8.23v-36.03z"
          fill="currentColor"
          transform="translate(-483.41 0)"
        />
        <path
          d="M473.532 524.327a8.16 8.16 0 0 1-8.17 8.17h-305.36l111.88 111.88c3.19 3.19 3.19 8.4 0 11.59l-25.09 25.09c-3.19 3.19-8.4 3.19-11.59 0l-168.6-168.61c-3.19-3.19-3.19-8.4 0-11.59l164.47-168.67c3.19-3.19 8.4-3.19 11.59 0l25.61 25.61c3.19 3.19 3.19 8.4 0 11.59l-106.59 110.78 303.62-0.11c4.52 0 8.23 3.71 8.23 8.23v36.04z"
          fill="currentColor"
          transform="translate(483.41 0)"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 1024 1024" aria-hidden="true">
      <path
        d="M473.532 524.327a8.16 8.16 0 0 1-8.17 8.17h-305.36l111.88 111.88c3.19 3.19 3.19 8.4 0 11.59l-25.09 25.09c-3.19 3.19-8.4 3.19-11.59 0l-168.6-168.61c-3.19-3.19-3.19-8.4 0-11.59l164.47-168.67c3.19-3.19 8.4-3.19 11.59 0l25.61 25.61c3.19 3.19 3.19 8.4 0 11.59l-106.59 110.78 303.62-0.11c4.52 0 8.23 3.71 8.23 8.23v36.04zM550.012 486.537a8.16 8.16 0 0 1 8.17-8.17h305.36l-111.88-111.89c-3.19-3.19-3.19-8.4 0-11.59l25.08-25.08c3.19-3.19 8.4-3.19 11.59 0l168.61 168.6c3.19 3.19 3.19 8.4 0 11.59l-164.47 168.67c-3.19 3.19-8.4 3.19-11.59 0l-25.61-25.61c-3.19-3.19-3.19-8.4 0-11.59l106.58-110.78-303.62 0.11c-4.52 0-8.23-3.71-8.23-8.23v-36.03z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return <span className={styles.chevronDown} aria-hidden="true" />;
}

function ModelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5 19.4 7.8v8.4L12 20.5l-7.4-4.3V7.8L12 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m8.2 9.7 3.8 2.2 3.8-2.2M12 11.9v4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === 'default') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7.8 11.8V5.6a1.4 1.4 0 0 1 2.8 0v5.2M10.6 10V4.7a1.4 1.4 0 0 1 2.8 0v6.1M13.4 10.8V6.1a1.4 1.4 0 0 1 2.8 0v6.2M16.2 12.2V8.7a1.4 1.4 0 0 1 2.8 0v4.9c0 4-2.7 6.8-6.4 6.8h-.9c-2.4 0-4.2-1-5.5-3.1L4.4 14a1.45 1.45 0 0 1 2.5-1.45l1.2 2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (mode === 'auto-edit' || mode === 'auto') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 10h.01M8 14h.01M11 12h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (mode === 'yolo') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.5 19 6v5.2c0 4.1-2.8 7.8-7 9.3-4.2-1.5-7-5.2-7-9.3V6l7-2.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 8v4.2M12 15.6h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 18c.7-2.7 2.2-4 4.5-4H12M7 6h10M7 10h7M17.5 14.5l2 2-2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="m3 8.3 3.1 3.1L13 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getModeLabel(modeId: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    plan: t('mode.label.plan'),
    default: t('mode.label.default'),
    'auto-edit': t('mode.label.auto-edit'),
    auto: t('mode.label.auto'),
    yolo: t('mode.label.yolo'),
  };
  return labels[modeId] ?? modeId;
}

function ToolbarDropdown({
  open,
  items,
  activeId,
  onClose,
  onSelect,
  anchorRef,
  showCheck = false,
}: {
  open: boolean;
  items: DropdownItem[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  showCheck?: boolean;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerOutside = (event: Event) => {
      if (event instanceof MouseEvent && event.button !== 0) return;
      if (event.defaultPrevented) return;
      const dropdown = dropdownRef.current;
      const anchor = anchorRef.current;
      const target = event.target;
      if (
        dropdown &&
        target instanceof Node &&
        !dropdown.contains(target) &&
        anchor &&
        !anchor.contains(target)
      ) {
        onClose();
      }
    };
    window.addEventListener('mousedown', onPointerOutside);
    return () => window.removeEventListener('mousedown', onPointerOutside);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) return null;

  const hasRichItems = items.some((item) => item.description || item.icon);
  const hasCheckItems = hasRichItems || showCheck;

  return (
    <div
      ref={dropdownRef}
      className={`${styles.dropdown} ${
        hasRichItems
          ? styles.dropdownRich
          : showCheck
            ? styles.dropdownCheck
            : ''
      }`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.dropdownItem} ${
            item.id === activeId ? styles.dropdownItemActive : ''
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.id);
          }}
        >
          {hasCheckItems ? (
            <>
              {hasRichItems && (
                <span className={styles.dropdownItemIcon}>{item.icon}</span>
              )}
              <span className={styles.dropdownItemContent}>
                <span className={styles.dropdownItemLabel}>{item.label}</span>
                {item.description && (
                  <span className={styles.dropdownItemDesc}>
                    {item.description}
                  </span>
                )}
              </span>
              <span className={styles.dropdownItemCheck}>
                {item.id === activeId ? <CheckIcon /> : null}
              </span>
            </>
          ) : (
            item.label
          )}
        </button>
      ))}
    </div>
  );
}

export const ChatEditor = memo(
  forwardRef<EditorHandle, ChatEditorProps>(function ChatEditor(props, ref) {
    const {
      onSubmit,
      onCycleMode,
      onToggleShortcuts,
      onCancel,
      isRunning = false,
      disabled = false,
      placeholderText = 'Type a message...',
      commands,
      skills = [],
      slashCommandCategoryOrder,
      queuedMessages = [],
      onPopQueuedMessages,
      onClearQueuedMessages,
      currentMode = 'default',
      currentModel = '',
      chatWidthMode = '1000',
      showChatWidthToggle = true,
      chatWidthToggleMin,
      visibleToolbarActions,
      availableModels = [],
      onSelectMode,
      onSelectModel,
      onChatWidthModeChange,
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
    } = props;

    const core = useComposerCore({
      onSubmit,
      onCycleMode,
      onToggleShortcuts,
      disabled,
      placeholderText,
      commands,
      skills,
      slashCommandCategoryOrder,
      queuedMessages,
      onPopQueuedMessages,
      onClearQueuedMessages,
      currentMode,
      draftText,
      draftVersion,
      onFocusFooter,
      dialogOpen,
      followupState,
      onAcceptFollowup,
      onDismissFollowup,
      sessionName,
      composerInput,
      composerInputVersion,
      editorTheme: CHAT_EDITOR_THEME,
    });

    const { t } = useI18n();
    const { renderComposerToolbarStart: ToolbarStart } =
      useWebShellCustomization();

    useImperativeHandle(ref, () => core.handle, [core.handle]);

    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const modeBtnRef = useRef<HTMLButtonElement>(null);
    const modelBtnRef = useRef<HTMLButtonElement>(null);
    const [widthToggleFits, setWidthToggleFits] = useState(false);

    useEffect(() => {
      const container = containerRef.current;
      const minWidth = chatWidthToggleMin;
      if (!container || minWidth === undefined) {
        setWidthToggleFits(false);
        return;
      }

      const update = () => {
        setWidthToggleFits(
          container.getBoundingClientRect().width >= minWidth - 50,
        );
      };
      update();

      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, [chatWidthToggleMin]);

    const modeItems: DropdownItem[] = DAEMON_APPROVAL_MODES.map((id) => ({
      id,
      label: getModeLabel(id, t),
      description: t(`mode.desc.${id}`),
      icon: <ModeIcon mode={id} />,
    }));
    const visibleActionSet = visibleToolbarActions
      ? new Set(visibleToolbarActions)
      : null;
    const showToolbarAction = (action: ComposerToolbarAction) => {
      if (!visibleActionSet) return true;
      return visibleActionSet.has(action);
    };

    const modelItems: DropdownItem[] = availableModels.map((m) => ({
      id: m.id,
      label: m.label || m.id,
    }));

    const handleModeSelect = useCallback(
      (modeId: string) => {
        onSelectMode?.(modeId);
        setModeDropdownOpen(false);
        core.focus();
      },
      [onSelectMode, core],
    );

    const handleModelSelect = useCallback(
      (modelId: string) => {
        onSelectModel?.(modelId);
        setModelDropdownOpen(false);
        core.focus();
      },
      [onSelectModel, core],
    );

    const {
      searchMode,
      searchQuery,
      searchMatches,
      searchActiveIndex,
      searchInputRef,
      searchUiRef,
      closeSearch,
      handleSearchKeyDown,
      handleSearchInput,
    } = core.searchState;

    const visibleSearchStart = Math.max(
      0,
      Math.min(searchActiveIndex - 2, searchMatches.length - 6),
    );
    const visibleSearchMatches = searchMatches.slice(
      visibleSearchStart,
      visibleSearchStart + 6,
    );

    const renderComposerTagContent = (tag: WebShellComposerTag) => {
      const tagLabel = getComposerTagLabel(tag);
      const tagValue = getComposerTagValue(tag);
      if (!tagLabel && !tagValue) {
        return <span className={styles.tagLabel}>{tag.id}</span>;
      }
      return (
        <>
          {tagLabel && <span className={styles.tagLabel}>{tagLabel}</span>}
          {tagValue && <span className={styles.tagValue}>{tagValue}</span>}
        </>
      );
    };

    // Mode display label
    const modeLabel = getModeLabel(currentMode, t);

    // Model display label
    const modelLabel = currentModel;

    return (
      <div ref={containerRef} className={styles.container} onClick={core.focus}>
        {searchMode && (
          <div ref={searchUiRef}>
            <div className={styles.searchBar}>
              <span className={styles.searchLabel}>
                {t('editor.searchLabel')}
              </span>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                value={searchQuery}
                onChange={handleSearchInput}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('editor.searchPlaceholder')}
              />
              <span className={styles.searchHint}>
                {t('editor.searchHint')}
              </span>
            </div>
            {searchMatches.length > 0 && (
              <div className={styles.searchResults}>
                {visibleSearchMatches.map((match, index) => {
                  const matchIndex = visibleSearchStart + index;
                  return (
                    <button
                      key={`${match}-${matchIndex}`}
                      type="button"
                      className={`${styles.searchResult} ${
                        matchIndex === searchActiveIndex
                          ? styles.searchResultActive
                          : ''
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        core.replaceEditorText(match);
                        closeSearch(false);
                      }}
                    >
                      <span className={styles.searchResultMarker}>
                        {matchIndex === searchActiveIndex ? '›' : ''}
                      </span>
                      <span className={styles.searchResultText}>{match}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {searchMatches.length === 0 && (
              <div className={styles.searchEmpty}>{t('editor.noHistory')}</div>
            )}
          </div>
        )}
        {core.composerTags.length > 0 && (
          <div className={styles.tags}>
            {core.composerTags.map((tag) => (
              <span key={tag.id} className={styles.tag}>
                {renderComposerTagContent(tag)}
                {tag.removable !== false && (
                  <button
                    type="button"
                    className={styles.tagRemove}
                    aria-label={`Remove ${getComposerTagDisplay(tag)}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      core.removeTopTag(tag.id);
                      core.viewRef.current?.focus();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Backspace' && event.key !== 'Delete') {
                        return;
                      }
                      event.preventDefault();
                      core.removeTopTag(tag.id);
                      core.viewRef.current?.focus();
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {core.pastedImages.length > 0 && (
          <div className={styles.images}>
            {core.pastedImages.map((img, i) => (
              <div key={i} className={styles.imageThumb}>
                <img src={`data:${img.media_type};base64,${img.data}`} alt="" />
                <button
                  className={styles.imageRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    core.removeImage(i);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.editorArea}>
          {core.shellMode && (
            <span className={styles.shellPrefix} aria-hidden="true">
              !
            </span>
          )}
          <div ref={core.containerRef} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeading}>
            {ToolbarStart && (
              <div className={styles.toolbarStart}>
                <ToolbarStart
                  disabled={disabled}
                  isRunning={isRunning}
                  currentMode={currentMode}
                  currentModel={currentModel}
                  sessionName={sessionName}
                />
              </div>
            )}
            <div className={styles.toolbarLeft}>
              {showToolbarAction('approvalMode') && (
                <div className={styles.dropdownWrapper}>
                  <ToolbarDropdown
                    open={modeDropdownOpen}
                    items={modeItems}
                    activeId={currentMode}
                    onClose={() => setModeDropdownOpen(false)}
                    onSelect={handleModeSelect}
                    anchorRef={modeBtnRef}
                  />
                  <button
                    ref={modeBtnRef}
                    className={styles.toolBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModeDropdownOpen((v) => !v);
                      setModelDropdownOpen(false);
                    }}
                    aria-label={t('status.mode')}
                  >
                    <span className={styles.toolBtnModeIcon}>
                      <ModeIcon mode={currentMode} />
                    </span>
                    <span className={styles.toolBtnText}>{modeLabel}</span>
                    <span className={styles.toolBtnArrow}>
                      <ChevronDownIcon />
                    </span>
                  </button>
                </div>
              )}
              {showToolbarAction('model') && (
                <div className={styles.dropdownWrapper}>
                  <ToolbarDropdown
                    open={modelDropdownOpen}
                    items={modelItems}
                    activeId={currentModel}
                    onClose={() => setModelDropdownOpen(false)}
                    onSelect={handleModelSelect}
                    anchorRef={modelBtnRef}
                    showCheck
                  />
                  <button
                    ref={modelBtnRef}
                    className={styles.toolBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModelDropdownOpen((v) => !v);
                      setModeDropdownOpen(false);
                    }}
                    aria-label={t('model.select')}
                  >
                    <span className={styles.toolBtnModelIcon}>
                      <ModelIcon />
                    </span>
                    <span className={styles.toolBtnText}>{modelLabel}</span>
                    <span className={styles.toolBtnArrow}>
                      <ChevronDownIcon />
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={styles.toolbarRight}>
            {showToolbarAction('commands') && (
              <button
                className={styles.toolBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  core.insertText('/');
                }}
                aria-label={t('editor.hintCommands')}
                title={t('editor.hintCommands')}
                data-tooltip={t('editor.hintCommands')}
              >
                <span className={styles.toolBtnIcon}>/</span>
              </button>
            )}
            {showToolbarAction('files') && (
              <button
                className={styles.toolBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  core.insertText('@');
                }}
                aria-label={t('editor.hintFiles')}
                title={t('editor.hintFiles')}
                data-tooltip={t('editor.hintFiles')}
              >
                <span className={styles.toolBtnIcon}>@</span>
              </button>
            )}
            {showChatWidthToggle &&
              widthToggleFits &&
              showToolbarAction('widthMode') && (
                <button
                  className={`${styles.toolBtn} ${styles.widthModeBtn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatWidthModeChange?.(
                      chatWidthMode === 'wide' ? '1000' : 'wide',
                    );
                  }}
                  disabled={!onChatWidthModeChange}
                  aria-label={
                    chatWidthMode === 'wide'
                      ? t('settings.option.ui.chatWidth.1000')
                      : t('settings.option.ui.chatWidth.wide')
                  }
                  title={
                    chatWidthMode === 'wide'
                      ? t('settings.option.ui.chatWidth.1000')
                      : t('settings.option.ui.chatWidth.wide')
                  }
                  data-tooltip={
                    chatWidthMode === 'wide'
                      ? t('settings.option.ui.chatWidth.1000')
                      : t('settings.option.ui.chatWidth.wide')
                  }
                >
                  <span className={styles.toolBtnIcon}>
                    <WidthModeIcon mode={chatWidthMode} />
                  </span>
                </button>
              )}
            <button
              className={
                isRunning
                  ? `${styles.sendBtn} ${styles.sendBtnRunning}`
                  : styles.sendBtn
              }
              disabled={
                isRunning ? !onCancel : core.disabled || !core.hasContent
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isRunning) {
                  onCancel?.();
                  return;
                }
                core.submitText();
              }}
              aria-label={isRunning ? t('stream.cancel') : t('editor.send')}
            >
              {isRunning ? <StopIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
      </div>
    );
  }),
);
