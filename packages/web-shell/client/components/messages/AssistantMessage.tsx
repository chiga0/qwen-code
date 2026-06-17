import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Markdown } from './Markdown';
import { CompactModeContext } from '../../App';
import { useWebShellCustomization } from '../../customization';
import { useI18n } from '../../i18n';
import type { TurnCollapseHead } from '../../adapters/types';
import styles from './AssistantMessage.module.css';

interface AssistantMessageProps {
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  turnCollapse?: TurnCollapseHead;
}

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

function formatTokenCount(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
}

function InputIcon() {
  return (
    <svg
      className={styles.metricsIcon}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path
        d="M6 2L6 10M6 2L3 5M6 2L9 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutputIcon() {
  return (
    <svg
      className={styles.metricsIcon}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path
        d="M6 10L6 2M6 10L3 7M6 10L9 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function assistantMetrics(
  collapse: TurnCollapseHead,
  t: Translate,
): ReactNode[] {
  const parts: ReactNode[] = [];
  if (
    collapse.inputTokens !== undefined &&
    collapse.outputTokens !== undefined
  ) {
    const cachedTokens = collapse.cachedTokens ?? 0;
    const cached =
      cachedTokens > 0 && collapse.inputTokens > 0
        ? ` (${formatTokenCount(cachedTokens)} ${t('turn.cached')}, ${Math.round(
            (cachedTokens / collapse.inputTokens) * 100,
          )}%)`
        : '';
    parts.push(
      <span key="tokens" className={styles.metricsItem}>
        <InputIcon />
        {formatTokenCount(collapse.inputTokens)}
        {cached}
        <span className={styles.metricsSpacer} />
        <OutputIcon />
        {formatTokenCount(collapse.outputTokens)}
      </span>,
    );
  }
  if (collapse.toolCallCount !== undefined && collapse.toolCallCount > 0) {
    parts.push(
      <span key="tools">
        {t('turn.toolCalls', { count: collapse.toolCallCount })}
      </span>,
    );
  }
  return parts;
}

export const AssistantMessage = memo(function AssistantMessage({
  content,
  thinking,
  isStreaming,
  turnCollapse,
}: AssistantMessageProps) {
  const { t } = useI18n();
  const compactMode = useContext(CompactModeContext);
  const { compactThinking, composerVariant } = useWebShellCustomization();
  const isChatMode = composerVariant === 'chat';
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const collapsed = compactThinking && !thinkingExpanded;
  // Re-check on content growth: the clamped box stops resizing once it
  // hits 5 lines, so a ResizeObserver alone misses later overflow.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !collapsed) return;
    setOverflowing(el.scrollHeight > el.clientHeight);
  }, [collapsed, thinking]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !collapsed) return;
    let animationFrame = 0;

    const check = () => {
      setOverflowing(el.scrollHeight > el.clientHeight);
    };

    const checkAfterLayout = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(check);
    };

    checkAfterLayout();

    const observer = new ResizeObserver(checkAfterLayout);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [collapsed]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !collapsed) return;
    if (isStreaming && !content) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = 0;
    }
  }, [collapsed, isStreaming, thinking, content]);

  const handleToggle = useCallback(() => {
    setThinkingExpanded((v) => !v);
  }, []);

  return (
    <div className={styles.message}>
      {thinking && !compactMode && (
        <div className={styles.thinking}>
          {!isChatMode && <span className={styles.prefix}>✦</span>}
          <div className={styles.thinkingBody}>
            {collapsed ? (
              <div
                className={
                  overflowing
                    ? `${styles.thinkingPreviewWrap} ${styles.thinkingPreviewOverflow}`
                    : styles.thinkingPreviewWrap
                }
              >
                <div
                  ref={previewRef}
                  className={`${styles.thinkingPreview} ${
                    isStreaming ? styles.thinkingPreviewTail : ''
                  }`}
                >
                  <Markdown
                    content={thinking}
                    source="thinking"
                    deferMermaid={isStreaming}
                  />
                </div>
                {overflowing && (
                  <button
                    className={styles.expandToggle}
                    onClick={handleToggle}
                    aria-expanded={false}
                    aria-label={t('thinking.expand')}
                    title={t('thinking.expand')}
                  >
                    ▼
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.thinkingExpandedWrap}>
                <Markdown
                  content={thinking}
                  source="thinking"
                  deferMermaid={isStreaming}
                />
                {compactThinking && thinkingExpanded && (
                  <button
                    className={styles.expandToggle}
                    onClick={handleToggle}
                    aria-expanded={true}
                    aria-label={t('thinking.collapse')}
                    title={t('thinking.collapse')}
                  >
                    ▲
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {content && (
        <div className={styles.content}>
          {!isChatMode && <span className={styles.prefix}>✦</span>}
          <div className={styles.contentBody}>
            <Markdown
              content={content}
              source="assistant"
              deferMermaid={isStreaming}
            />
          </div>
        </div>
      )}

      {turnCollapse && (
        <div className={styles.metricsRow}>
          {assistantMetrics(turnCollapse, t).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className={styles.metricsDot}> · </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
