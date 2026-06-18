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
  thinking?: string;
  isStreaming?: boolean;
  timestamp?: number;
}

export const AssistantMessage = memo(function AssistantMessage({
  content,
  thinking,
  isStreaming,
  timestamp,
}: AssistantMessageProps) {
  const { t } = useI18n();
  const compactMode = useContext(CompactModeContext);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const thinkingSummaryKey = getThinkingSummaryKey({ content, isStreaming });
  const thinkingActive = thinkingSummaryKey === 'thinking.running';
  const startTimeRef = useRef(timestamp ?? Date.now());
  const sawActiveRef = useRef(thinkingActive);
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!thinking || !thinkingActive) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [thinking, thinkingActive]);

  useEffect(() => {
    if (!thinking) return;
    if (thinkingActive) {
      sawActiveRef.current = true;
      setFinishedAt(null);
      return;
    }
    if (sawActiveRef.current && finishedAt === null) {
      setFinishedAt(Date.now());
    }
  }, [finishedAt, thinking, thinkingActive]);

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
      {thinking && !compactMode && (
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
                {t(thinkingSummaryKey, { duration: thinkingDuration })}
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
            {thinkingExpanded && (
              <div className={styles.thinkingExpandedWrap}>
                <Markdown
                  content={thinking}
                  source="thinking"
                  deferMermaid={isStreaming}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}): 'thinking.running' | 'thinking.done' {
  return isStreaming && !content ? 'thinking.running' : 'thinking.done';
}

export function formatThinkingDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function ThinkingDoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5.1 8.1 7.1 10 11 6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
