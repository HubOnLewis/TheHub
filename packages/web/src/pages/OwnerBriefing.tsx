import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import BrandLogo from '../components/BrandLogo.js';
import {
  EXEC_OWNER_NAME,
  OWNER_BRIEFING_META,
} from '../data/executiveDemo.js';
import { getOwnerBriefingMemo } from '../data/operationalIntelligence.js';
import { useDemoOpsStore, countPendingApprovals } from '../state/demoOpsStore.js';

export default function OwnerBriefing() {
  const approvals = useDemoOpsStore(s => s.approvals);
  const memo = getOwnerBriefingMemo();
  const pending = countPendingApprovals(approvals);

  const eventsThisWeek = memo.eventsThisWeek ?? [];
  const loadIn = memo.loadInPressure ?? [];
  const lostReasons = memo.lostReasons ?? [];
  const repeatOps = memo.repeatOpportunities ?? [];
  const velocity = memo.bookingVelocity;

  return (
    <div className="exec-page exec-page--briefing command-page">
      <div className="exec-page__glow exec-page__glow--rose" aria-hidden />

      <header className="briefing-deck__masthead command-panel-shimmer" style={{ marginBottom: 16 }}>
        <BrandLogo size="lg" watermark className="briefing-brand-watermark" />
        <div>
          <p className="briefing-deck__edition">Executive intelligence memo · {OWNER_BRIEFING_META.periodLabel}</p>
          <h1 className="exec-page__title">Morning intelligence</h1>
          <p className="exec-page__subtitle">
            {OWNER_BRIEFING_META.venue} · {OWNER_BRIEFING_META.location}
          </p>
          <p className="briefing-deck__for">
            Prepared for <strong>{EXEC_OWNER_NAME}</strong> · {OWNER_BRIEFING_META.generatedAt}
          </p>
          <p className="ops-intel-hero__source" style={{ marginTop: 8 }}>
            {memo.meta}
          </p>
        </div>
      </header>

      <DemoFlowNav />

      <div className="briefing-memo">
        <article className="briefing-memo__block" style={{ borderColor: 'var(--amber-muted)' }}>
          <h2>Today&apos;s focus</h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{memo.focus}</p>
          {velocity ? (
            <p className="briefing-memo__meta" style={{ marginTop: 8, fontSize: 13 }}>
              {velocity.label}
            </p>
          ) : null}
        </article>

        <article className="briefing-memo__block">
          <h2>Top 3 decisions today</h2>
          <ol>
            {memo.decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
          <p style={{ margin: '12px 0 0', fontSize: 13 }}>
            <strong>{pending}</strong> Autopilot approvals need human sign-off.
            <Link to={ROUTES.autopilot} className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }}>
              Open queue →
            </Link>
          </p>
        </article>

        <article className="briefing-memo__block">
          <h2>Events this week</h2>
          {eventsThisWeek.length ? (
            <ul>
              {eventsThisWeek.map(e => (
                <li key={e.id}>
                  {e.title} · {e.date} · {e.guests} guests · {e.status}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 13 }}>No dated events in the next 7 days from export.</p>
          )}
        </article>

        <article className="briefing-memo__block">
          <h2>Balances & money at risk</h2>
          <ul>
            {memo.balances.map(b => (
              <li key={`${b.client}-${b.amount}`}>
                {b.client} · {formatCurrency(b.amount)} due {b.due} · {b.event}
              </li>
            ))}
          </ul>
        </article>

        <article className="briefing-memo__block">
          <h2>Load-in pressure (next 14 days)</h2>
          <ul>
            {loadIn.length ? loadIn.map((l, i) => <li key={i}>{l}</li>) : <li>No imminent confirmed load-ins flagged.</li>}
          </ul>
        </article>

        <article className="briefing-memo__block">
          <h2>Stale proposals</h2>
          <ul>
            {memo.staleProposals.map(s => (
              <li key={s.title}>
                {s.title} · {s.days}d open · {formatCurrency(s.value)}
              </li>
            ))}
          </ul>
        </article>

        <article className="briefing-memo__block">
          <h2>Repeat account opportunities</h2>
          <ul>
            {repeatOps.length ? (
              repeatOps.map(r => (
                <li key={r.name}>
                  {r.name} · {r.events} events · {formatCurrency(r.spend)} — {r.note}
                </li>
              ))
            ) : (
              <li>Review VIP accounts in Accounts for re-engagement.</li>
            )}
          </ul>
          <Link to={ROUTES.accounts} className="exec-panel__link" style={{ marginTop: 8, display: 'inline-block' }}>
            Accounts →
          </Link>
        </article>

        <article className="briefing-memo__block">
          <h2>Lost reason intelligence</h2>
          <ul>
            {lostReasons.length ? (
              lostReasons.map(l => (
                <li key={l.reason}>
                  {l.reason} · {l.count} events
                </li>
              ))
            ) : (
              <li>No lost-reason notes aggregated from export.</li>
            )}
          </ul>
        </article>

        <article className="briefing-memo__block">
          <h2>Overnight automation</h2>
          <ul>
            {memo.overnight.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </article>

        <article className="briefing-memo__block">
          <h2>Occupancy & staffing pressure</h2>
          <ul>
            {memo.occupancyWeak.map((o, i) => (
              <li key={i}>
                {o.day} · {o.note}
              </li>
            ))}
          </ul>
          <Link to={ROUTES.calendar} style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}>
            Calendar intelligence →
          </Link>
        </article>
      </div>
    </div>
  );
}
