import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Markdown } from './Markdown';
import { CompactModeContext } from '../../App';
import { useI18n } from '../../i18n';
import styles from './AssistantMessage.module.css';

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export const AssistantMessage = memo(function AssistantMessage({
  content,
  isStreaming,
}: AssistantMessageProps) {
  return (
    <div className={styles.message}>
      {content && (
        <div className={styles.content}>
          <div className={styles.contentBody}>
            <Markdown
              content={content}
              source="assistant"
              deferMermaid={isStreaming}
            />
          </div>
        </div>
      )}
    </div>
  );
});

interface ThinkingMessageProps {
  content: string;
  isStreaming?: boolean;
  timestamp?: number;
}

export const ThinkingMessage = memo(function ThinkingMessage({
  content,
  isStreaming,
  timestamp,
}: ThinkingMessageProps) {
  const { t } = useI18n();
  const compactMode = useContext(CompactModeContext);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const thinkingSummaryKey = getThinkingSummaryKey({ isStreaming });
  const thinkingActive = thinkingSummaryKey === 'thinking.running';
  const startTimeRef = useRef(timestamp ?? Date.now());
  const sawActiveRef = useRef(thinkingActive);
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!content || !thinkingActive) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [content, thinkingActive]);

  useEffect(() => {
    if (!content) return;
    if (thinkingActive) {
      sawActiveRef.current = true;
      setFinishedAt(null);
      return;
    }
    if (sawActiveRef.current && finishedAt === null) {
      setFinishedAt(Date.now());
    }
  }, [content, finishedAt, thinkingActive]);

  const thinkingDuration =
    thinkingActive || finishedAt
      ? formatThinkingDuration(
          (thinkingActive ? now : finishedAt!) - startTimeRef.current,
        )
      : '';

  const handleToggle = useCallback(() => {
    setThinkingExpanded((v) => !v);
  }, []);

  return (
    <div className={styles.message}>
      {content && !compactMode && (
        <div className={styles.thinking}>
          <div className={styles.thinkingBody}>
            <button
              type="button"
              className={styles.thinkingSummary}
              onClick={handleToggle}
              aria-expanded={thinkingExpanded}
              title={
                thinkingExpanded ? t('thinking.collapse') : t('thinking.expand')
              }
            >
              <span className={styles.thinkingSummaryIcon} aria-hidden="true">
                {thinkingActive ? <ThinkingActiveIcon /> : <ThinkingDoneIcon />}
              </span>
              <span
                className={
                  thinkingActive
                    ? `${styles.thinkingSummaryText} ${styles.thinkingSummaryTextActive}`
                    : styles.thinkingSummaryText
                }
              >
                {t(thinkingSummaryKey, {
                  duration: thinkingActive ? thinkingDuration : '',
                })}
              </span>
              <span
                className={
                  thinkingExpanded
                    ? styles.thinkingChevronDown
                    : styles.thinkingChevronRight
                }
                aria-hidden="true"
              />
            </button>
            <div
              className={
                thinkingExpanded
                  ? styles.thinkingExpandedClip
                  : `${styles.thinkingExpandedClip} ${styles.thinkingExpandedCollapsed}`
              }
            >
              <div className={styles.thinkingExpandedInner}>
                <div className={styles.thinkingExpandedWrap}>
                  <Markdown
                    content={content}
                    source="thinking"
                    deferMermaid={isStreaming}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function ThinkingActiveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="5.6" cy="8" r="0.75" fill="currentColor" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" />
      <circle cx="10.4" cy="8" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function getThinkingSummaryKey({
  isStreaming,
}: {
  isStreaming?: boolean;
}): 'thinking.running' | 'thinking.done' {
  return isStreaming ? 'thinking.running' : 'thinking.done';
}

export function formatThinkingDuration(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function ThinkingDoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.2 15.2h4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M6.5 13.1h5.4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M9.1 2.8c-3 0-5.1 2.3-5.1 5 0 1.7.8 3.1 2.1 4 .5.4.8.8.8 1.4h4.5c0-.6.3-1 .8-1.4 1.3-.9 2.1-2.3 2.1-4 0-.8-.2-1.6-.6-2.3"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.2 1.8 14 3.6l1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
