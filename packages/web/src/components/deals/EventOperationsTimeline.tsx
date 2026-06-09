import { useMemo } from 'react';
import { formatRelativeTime } from '../../lib/relativeTime.js';
import {
  MILLER_HARRIS_TIMELINE,
  CATEGORY_LABELS,
  type EventTimelineSeedEntry,
  type EventTimelineCategory,
} from '../../data/eventOperationsSeed.js';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';

export interface EventTimelineRow {
  id: string;
  at: string;
  atIso: string;
  rel: string;
  category: EventTimelineCategory;
  title: string;
  detail?: string;
  actor: string;
  source: 'system' | 'user' | 'ai';
}

function mapDealTimeline(
  rows: Array<{ title: string; channel: string; actor: string; at: string }>,
): EventTimelineRow[] {
  return rows.map((r, i) => ({
    id: `deal-local-${i}-${r.title}`,
    at: r.at,
    atIso: new Date().toISOString(),
    rel: 'just now',
    category: 'coordination' as const,
    title: r.title,
    detail: r.channel,
    actor: r.actor,
    source: 'user' as const,
  }));
}

function mapActivityToTimeline(
  feed: ReturnType<typeof useDemoOpsStore.getState>['activityFeed'],
): EventTimelineRow[] {
  return feed
    .filter(a => a.category === 'deal' || a.category === 'approval' || a.category === 'agent')
    .slice(0, 6)
    .map(a => ({
      id: `act-${a.id}`,
      at: a.at,
      atIso: a.atIso,
      rel: formatRelativeTime(a.atIso),
      category: (a.category === 'approval' ? 'automation' : a.agent ? 'automation' : 'coordination') as EventTimelineCategory,
      title: a.summary,
      actor: a.agent ?? 'System',
      source: a.agent ? ('ai' as const) : ('system' as const),
    }));
}

function mergeTimeline(seed: EventTimelineSeedEntry[], dynamic: EventTimelineRow[]): EventTimelineRow[] {
  const seedRows: EventTimelineRow[] = seed.map(s => ({
    id: s.id,
    at: s.at,
    atIso: s.atIso,
    rel: formatRelativeTime(s.atIso),
    category: s.category,
    title: s.title,
    detail: s.detail,
    actor: s.actor,
    source: s.source,
  }));
  const seen = new Set<string>();
  const out: EventTimelineRow[] = [];
  for (const row of [...dynamic, ...seedRows]) {
    const key = row.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime());
}

interface EventOperationsTimelineProps {
  className?: string;
}

export default function EventOperationsTimeline({ className = '' }: EventOperationsTimelineProps) {
  const dealOps = useDemoOpsStore(s => s.deal);
  const activityFeed = useDemoOpsStore(s => s.activityFeed);
  const depositQueued = dealOps.depositReminderQueued;
  const draftQueued = dealOps.draftQueued;

  const rows = useMemo(() => {
    const dynamic = [
      ...mapDealTimeline(dealOps.timeline),
      ...mapActivityToTimeline(activityFeed),
    ];
    if (depositQueued) {
      dynamic.unshift({
        id: 'dyn-deposit',
        at: 'Today',
        atIso: new Date().toISOString(),
        rel: 'just now',
        category: 'balance',
        title: 'Deposit reminder queued',
        actor: 'Balance Guardian',
        source: 'ai',
      });
    }
    if (draftQueued) {
      dynamic.unshift({
        id: 'dyn-draft',
        at: 'Today',
        atIso: new Date().toISOString(),
        rel: 'just now',
        category: 'automation',
        title: 'AI drafted follow-up',
        detail: 'Queued for coordinator approval',
        actor: 'Follow-Up Hunter',
        source: 'ai',
      });
    }
    return mergeTimeline(MILLER_HARRIS_TIMELINE, dynamic);
  }, [dealOps.timeline, activityFeed, depositQueued, draftQueued]);

  return (
    <section className={`event-ops-timeline ${className}`.trim()}>
      <header className="event-ops-timeline__head">
        <div>
          <span className="event-ops-timeline__eyebrow">Event operations</span>
          <h2>Operational timeline</h2>
          <p>Inquiry through closeout — system, coordinator, and agent attribution.</p>
        </div>
        <span className="event-ops-timeline__count">{rows.length} milestones</span>
      </header>
      <ol className="event-ops-timeline__list">
        {rows.map((row, idx) => (
          <li key={row.id} className={`event-ops-timeline__row event-ops-timeline__row--${row.source}`}>
            <div className="event-ops-timeline__rail">
              <span className={`event-ops-timeline__node event-ops-timeline__node--${row.category}`} />
              {idx < rows.length - 1 && <span className="event-ops-timeline__line" />}
            </div>
            <div className="event-ops-timeline__card">
              <div className="event-ops-timeline__meta">
                <span className={`event-ops-timeline__cat event-ops-timeline__cat--${row.category}`}>
                  {CATEGORY_LABELS[row.category]}
                </span>
                <time dateTime={row.atIso}>{row.at}</time>
                <span className="event-ops-timeline__rel">{row.rel}</span>
              </div>
              <h3>{row.title}</h3>
              {row.detail && <p className="event-ops-timeline__detail">{row.detail}</p>}
              <footer>
                <span className={`event-ops-timeline__actor event-ops-timeline__actor--${row.source}`}>
                  {row.source === 'ai' ? 'AI · ' : row.source === 'system' ? 'System · ' : ''}
                  {row.actor}
                </span>
              </footer>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
