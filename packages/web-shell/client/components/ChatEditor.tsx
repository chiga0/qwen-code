import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { DAEMON_APPROVAL_MODES } from '@qwen-code/webui/daemon-react-sdk';
import type { CommandInfo } from '../adapters/types';
import type { UseDaemonFollowupSuggestionReturn } from '@qwen-code/webui/daemon-react-sdk';
import type { CommandDisplayCategoryOrder } from '../utils/commandDisplay';
import type { SkillInfo } from '../completions/slashCompletion';
import { useI18n } from '../i18n';
import type {
  WebShellComposerInput,
  WebShellComposerTag,
} from '../customization';
import {
  useComposerCore,
  type EditorHandle,
  getComposerTagDisplay,
  getComposerTagLabel,
  getComposerTagValue,
} from '../hooks/useComposerCore';
import styles from './ChatEditor.module.css';

interface ChatEditorProps {
  onSubmit: (
    text: string,
    images?: import('../adapters/promptTypes').PromptImage[],
  ) => boolean | void;
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
  currentModel?: string;
  availableModels?: Array<{ id: string; label?: string }>;
  onSelectMode?: (mode: string) => void;
  onSelectModel?: (model: string) => void;
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

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2V12M10 2C7 2 5 4 5 7V12C5 15 7 17 10 17C13 17 15 15 15 12V7C15 4 13 2 10 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 10C3 10 3 16 10 16C17 16 17 10 17 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DropdownItem {
  id: string;
  label: string;
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
}: {
  open: boolean;
  items: DropdownItem[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
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

  return (
    <div ref={dropdownRef} className={styles.dropdown}>
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
          {item.label}
        </button>
      ))}
    </div>
  );
}

export const ChatEditor = forwardRef<EditorHandle, ChatEditorProps>(
  function ChatEditor(props, ref) {
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
      currentModel = '',
      availableModels = [],
      onSelectMode,
      onSelectModel,
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

    useImperativeHandle(ref, () => core.handle, [core.handle]);

    const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const modeBtnRef = useRef<HTMLButtonElement>(null);
    const modelBtnRef = useRef<HTMLButtonElement>(null);

    const modeItems: DropdownItem[] = DAEMON_APPROVAL_MODES.map((id) => ({
      id,
      label: getModeLabel(id, t),
    }));

    const modelItems: DropdownItem[] = availableModels.map((m) => ({
      id: m.id,
      label: m.label || m.id,
    }));

    const handleModeSelect = useCallback(
      (modeId: string) => {
        onSelectMode?.(modeId);
        setModeDropdownOpen(false);
      },
      [onSelectMode],
    );

    const handleModelSelect = useCallback(
      (modelId: string) => {
        onSelectModel?.(modelId);
        setModelDropdownOpen(false);
      },
      [onSelectModel],
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
    const modelLabel =
      currentModel ||
      (availableModels.length > 0
        ? availableModels[0].label || availableModels[0].id
        : '');

    return (
      <div className={styles.container} onClick={core.focus}>
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
          <div ref={core.containerRef} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
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
                <span className={styles.toolBtnText}>{modeLabel}</span>
                <span className={styles.toolBtnArrow}>
                  <ChevronDownIcon />
                </span>
              </button>
            </div>
            <div className={styles.dropdownWrapper}>
              <ToolbarDropdown
                open={modelDropdownOpen}
                items={modelItems}
                activeId={currentModel}
                onClose={() => setModelDropdownOpen(false)}
                onSelect={handleModelSelect}
                anchorRef={modelBtnRef}
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
                <span className={styles.toolBtnText}>{modelLabel}</span>
                <span className={styles.toolBtnArrow}>
                  <ChevronDownIcon />
                </span>
              </button>
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <button
              className={styles.toolBtn}
              onClick={(e) => {
                e.stopPropagation();
                core.insertText('/');
              }}
              aria-label={t('editor.hintCommands')}
            >
              <span className={styles.toolBtnIcon}>/</span>
            </button>
            <button
              className={styles.toolBtn}
              onClick={(e) => {
                e.stopPropagation();
                core.insertText('@');
              }}
              aria-label={t('editor.hintFiles')}
            >
              <span className={styles.toolBtnIcon}>@</span>
            </button>
            <button className={styles.toolBtn} disabled aria-label="Voice">
              <span className={styles.toolBtnIcon}>
                <MicIcon />
              </span>
            </button>
            <button
              className={styles.sendBtn}
              disabled={core.disabled || !core.hasContent}
              onClick={(e) => {
                e.stopPropagation();
                core.submitText();
              }}
              aria-label={t('editor.placeholder')}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    );
  },
);
