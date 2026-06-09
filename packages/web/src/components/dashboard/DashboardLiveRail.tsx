import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { formatRelativeTime } from '../../lib/relativeTime.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

const CAT_CLASS: Record<string, string> = {
  agent: 'live-rail__cat--agent',
  approval: 'live-rail__cat--approval',
  task: 'live-rail__cat--task',
  inbox: 'live-rail__cat--inbox',
  deal: 'live-rail__cat--deal',
  system: 'live-rail__cat--system',
};

/** Horizontal operational feed — no card chrome */
export default function DashboardLiveRail() {
  const feed = useDemoOpsStore(s => s.activityFeed);
  const pending = useDemoOpsStore(s =>
    Object.values(s.approvals).filter(a => a.status === 'pending' || a.status === 'edited'),
  );

  const items = feed.slice(0, 8);

  return (
    <section className="live-rail" aria-label="Live operations">
      <div className="live-rail__head">
        <h2 className="live-rail__title">Live operations</h2>
        <Link to={ROUTES.autopilot} className="live-rail__link">
          Autopilot
        </Link>
      </div>
      <div className="live-rail__track" role="list">
        {pending.slice(0, 2).map(a => (
          <Link
            key={a.id}
            to={ROUTES.autopilot}
            className="live-rail__item live-rail__item--approval"
            role="listitem"
          >
            <span className="live-rail__cat live-rail__cat--approval">Approval</span>
            <span className="live-rail__text">{a.title}</span>
          </Link>
        ))}
        {items.map(row => (
          <div
            key={row.id}
            className={`live-rail__item ${CAT_CLASS[row.category] ?? ''}`}
            role="listitem"
          >
            <span className={`live-rail__cat ${CAT_CLASS[row.category] ?? ''}`}>
              {row.category}
            </span>
            <span className="live-rail__text">
              {row.agent ? `${row.agent} · ` : ''}
              {row.summary}
            </span>
            <time className="live-rail__time">{formatRelativeTime(row.atIso)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}
