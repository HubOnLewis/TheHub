import { useEffect, useMemo, useState } from 'react';
import { formatRelativeTime } from '../../lib/relativeTime.js';
import { useDemoOpsStore, type DemoActivityEntry } from '../../state/demoOpsStore.js';

const CATEGORY_LABEL: Record<DemoActivityEntry['category'], string> = {
  agent: 'Agent',
  task: 'Task',
  inbox: 'Inbox',
  deal: 'Event',
  approval: 'Approval',
  system: 'System',
};

interface ActivityTimelineProps {
  limit?: number;
  dense?: boolean;
  filterCategory?: DemoActivityEntry['category'];
  title?: string;
  className?: string;
}

export default function ActivityTimeline({
  limit = 8,
  dense,
  filterCategory,
  title = 'Live activity',
  className = '',
}: ActivityTimelineProps) {
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

  const rows = useMemo(() => {
    let list = feed;
    if (filterCategory) list = list.filter(r => r.category === filterCategory);
    return list.slice(0, limit).map(r => ({ ...r, rel: formatRelativeTime(r.atIso) }));
  }, [feed, limit, filterCategory, tick]);

  return (
    <section className={`activity-timeline${dense ? ' activity-timeline--dense' : ''} ${className}`.trim()}>
      <header className="activity-timeline__head">
        <h3>{title}</h3>
        <span className="activity-timeline__live">
          <span className="activity-timeline__dot" aria-hidden />
          Updating
        </span>
      </header>
      <ol className="activity-timeline__list">
        {rows.map(row => (
          <li key={row.id} className="activity-timeline__row">
            <div className="activity-timeline__rail">
              <span className="activity-timeline__node" />
            </div>
            <div className="activity-timeline__body">
              <div className="activity-timeline__meta">
                <span className="activity-timeline__badge">{CATEGORY_LABEL[row.category]}</span>
                <time>{row.rel}</time>
              </div>
              {row.agent && <span className="activity-timeline__agent">{row.agent}</span>}
              <p>{row.summary}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
