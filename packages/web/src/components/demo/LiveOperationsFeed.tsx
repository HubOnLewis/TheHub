import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

function pulseLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Updated just now';
  if (diff < 300_000) return 'Updated moments ago';
  return 'Updated earlier';
}

export default function LiveOperationsFeed({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const feed = useDemoOpsStore(s => s.activityFeed);
  const lastPulse = useDemoOpsStore(s => s.lastPulseAt);
  const pending = useDemoOpsStore(s => Object.values(s.approvals).filter(a => a.status === 'pending').length);
  const openTasks = useDemoOpsStore(s => s.tasks.filter(t => t.status === 'open').length);

  const rows = feed.slice(0, limit);

  return (
    <section className={`live-ops-feed${compact ? ' live-ops-feed--compact' : ''}`}>
      <div className="live-ops-feed__head">
        <div>
          <h3 className="live-ops-feed__title">Live operations</h3>
          <p className="live-ops-feed__sub">
            {pulseLabel(lastPulse)} · {pending} awaiting approval · {openTasks} open tasks
          </p>
        </div>
        <Link to={ROUTES.autopilot} className="live-ops-feed__link">
          Autopilot →
        </Link>
      </div>
      <ul className="live-ops-feed__list">
        {rows.map(row => (
          <li key={row.id} className={`live-ops-feed__item live-ops-feed__item--${row.category}`}>
            <span className="live-ops-feed__time">{row.at}</span>
            <span className="live-ops-feed__body">
              {row.agent ? <span className="live-ops-feed__agent">{row.agent} · </span> : null}
              {row.summary}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
