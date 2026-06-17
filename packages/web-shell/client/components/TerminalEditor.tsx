import {
  forwardRef,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { CommandInfo } from '../adapters/types';
import type { UseDaemonFollowupSuggestionReturn } from '@qwen-code/webui/daemon-react-sdk';
import type { CommandDisplayCategoryOrder } from '../utils/commandDisplay';
import type { SkillInfo } from '../completions/slashCompletion';
import { useI18n } from '../i18n';
import { PromptChevron } from './PromptChevron';
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

export type { EditorHandle } from '../hooks/useComposerCore';
import styles from './Editor.module.css';

interface TerminalEditorProps {
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

const TERMINAL_EDITOR_THEME = {
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
    fontFamily: 'var(--font-mono, "SF Mono", "Fira Code", monospace)',
    color: 'var(--text-primary, #e0e0e0)',
    caretColor: 'var(--accent-color, #4a9eff)',
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

function getModeClass(mode: string, shellMode: boolean): string {
  if (shellMode) return '';
  switch (mode) {
    case 'plan':
      return styles.modePlan;
    case 'auto-edit':
      return styles.modeAutoEdit;
    case 'yolo':
      return styles.modeYolo;
    default:
      return '';
  }
}

export const TerminalEditor = forwardRef<EditorHandle, TerminalEditorProps>(
  function TerminalEditor(props, ref) {
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
      editorTheme: TERMINAL_EDITOR_THEME,
    });

    const { t } = useI18n();

    useImperativeHandle(ref, () => core.handle, [core.handle]);

    const modeClass = getModeClass(core.currentMode, core.shellMode);
    const containerClass = [
      styles.container,
      core.shellMode ? styles.shellMode : '',
      modeClass,
    ]
      .filter(Boolean)
      .join(' ');

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

    const prefixClass = [
      styles.prefix,
      core.shellMode
        ? styles.prefixShell
        : core.currentMode === 'yolo'
          ? styles.prefixYolo
          : core.currentMode === 'auto-edit'
            ? styles.prefixAutoEdit
            : '',
    ]
      .filter(Boolean)
      .join(' ');
    const prefixContent = core.shellMode ? (
      '!'
    ) : core.currentMode === 'yolo' ? (
      '*'
    ) : (
      <PromptChevron />
    );

    const hintProps = (
      handler: () => void,
      haspopup?: 'dialog' | 'listbox',
    ) => ({
      type: 'button' as const,
      className: styles.hintItem,
      ...(haspopup ? { 'aria-haspopup': haspopup } : {}),
      onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) =>
        e.preventDefault(),
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        handler();
      },
    });

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

    return (
      <div className={containerClass} onClick={core.focus}>
        <div className={styles.borderTop}>
          {core.sessionName && (
            <span className={styles.borderTopLabel}>{core.sessionName}</span>
          )}
        </div>
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
        <div className={styles.line}>
          <span className={prefixClass}>{prefixContent}</span>
          <div ref={core.containerRef} className={styles.wrapper} />
        </div>
        {core.showShortcutHints && (
          <div className={styles.hints}>
            <button {...hintProps(core.navigatePrevHistory)}>
              <span className={styles.hintKey}>↑</span>
              {t('editor.hintPrev')}
            </button>
            <span className={styles.hintSep}>·</span>
            <button {...hintProps(core.navigateNextHistory)}>
              <span className={styles.hintKey}>↓</span>
              {t('editor.hintNext')}
            </button>
            <span className={styles.hintSep}>·</span>
            <button
              {...hintProps(core.searchState.openHistorySearch, 'dialog')}
            >
              <span className={styles.hintKey}>ctrl+r</span>
              {t('editor.hintSearch')}
            </button>
            <span className={styles.hintSep}>·</span>
            <button {...hintProps(() => core.insertText('/'), 'listbox')}>
              <span className={styles.hintKey}>/</span>
              {t('editor.hintCommands')}
            </button>
            <span className={styles.hintSep}>·</span>
            <button {...hintProps(() => core.insertText('@'), 'listbox')}>
              <span className={styles.hintKey}>@</span>
              {t('editor.hintFiles')}
            </button>
          </div>
        )}
        <div className={styles.borderBottom} />
      </div>
    );
  },
);
