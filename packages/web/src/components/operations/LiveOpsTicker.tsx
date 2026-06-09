import { useEffect, useMemo, useState } from 'react';
import { formatRelativeTime } from '../../lib/relativeTime.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

const CATEGORY_DOT: Record<string, string> = {
  agent: 'live-dot live-dot--ai',
  task: 'live-dot live-dot--task',
  inbox: 'live-dot live-dot--inbox',
  deal: 'live-dot live-dot--deal',
  approval: 'live-dot live-dot--approval',
  system: 'live-dot live-dot--system',
};

interface LiveOpsTickerProps {
  limit?: number;
  className?: string;
  /** Inline strip for operational rail */
  compact?: boolean;
}

/** Horizontal live activity strip — subtle marquee without gimmicks */
export default function LiveOpsTicker({ limit = 6, className = '', compact = false }: LiveOpsTickerProps) {
  const feed = useDemoOpsStore(s => s.activityFeed);
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const [, tick] = useState(0);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  useEffect(() => {
    const id = window.setInterval(() => tick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const items = useMemo(
    () =>
      feed.slice(0, limit).map(row => ({
        ...row,
        rel: formatRelativeTime(row.atIso),
      })),
    [feed, limit, tick],
  );

  if (items.length === 0) return null;

  return (
    <div
      className={`live-ops-ticker${compact ? ' live-ops-ticker--compact' : ''} ${className}`.trim()}
      role="region"
      aria-label="Live operations"
    >
      <span className="live-ops-ticker__pulse" aria-hidden />
      <span className="live-ops-ticker__label">Live</span>
      <div className="live-ops-ticker__track">
        <div className="live-ops-ticker__inner">
          {[...items, ...items].map((row, i) => (
            <span key={`${row.id}-${i}`} className="live-ops-ticker__item">
              <span className={CATEGORY_DOT[row.category] ?? 'live-dot'} />
              {row.agent && <strong className="live-ops-ticker__agent">{row.agent}</strong>}
              <span className="live-ops-ticker__text">{row.summary}</span>
              <time className="live-ops-ticker__time">{row.rel}</time>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
