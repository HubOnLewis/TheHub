import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import { MiniBars, MiniSparkline } from '../components/executive/ExecutiveCharts.js';
import ExecutiveIntelStrip from '../components/executive/ExecutiveIntelStrip.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import {
  REVENUE_AI_RECOVERY_ACTIONS,
  REVENUE_DORMANT_CLIENTS,
  REVENUE_LEAKS_SUMMARY,
  REVENUE_LEAK_TREND,
  REVENUE_LOW_WEEKDAYS,
  REVENUE_MISSED_ADDONS,
  REVENUE_REENGAGEMENT,
  REVENUE_STALE_LEADS,
  REVENUE_UNDERPERFORMING_CATEGORIES,
  REVENUE_UNPAID_BALANCES,
} from '../data/executiveDemo.js';

export default function RevenueLeaks() {
  return (
    <div className="exec-page exec-page--revenue">
      <DemoFlowNav />
      <div className="exec-page__glow exec-page__glow--amber" aria-hidden />

      <header className="exec-page__hero">
        <div>
          <span className="exec-page__badge">Revenue Lift Agent</span>
          <h1 className="exec-page__title">Revenue opportunity intelligence</h1>
          <p className="exec-page__subtitle">
            HuB on Lewis · surfaces balances, dormant accounts, dark calendar days, and add-ons clients often accept.
          </p>
          <p className="exec-page__meta">{REVENUE_LEAKS_SUMMARY.period}</p>
        </div>
        <div className="exec-hero-kpis">
          <div className="exec-hero-kpi exec-hero-kpi--primary">
            <span className="exec-hero-kpi__label">Estimated recoverable</span>
            <span className="exec-hero-kpi__value">{formatCurrency(REVENUE_LEAKS_SUMMARY.recoverableEstimate)}</span>
            <span className="exec-hero-kpi__sub">{REVENUE_LEAKS_SUMMARY.activePursuits} active pursuits</span>
          </div>
          <div className="exec-hero-kpi">
            <span className="exec-hero-kpi__label">Recovered YTD (tracked)</span>
            <span className="exec-hero-kpi__value">{formatCurrency(REVENUE_LEAKS_SUMMARY.recoveredYtd)}</span>
          </div>
          <div className="exec-hero-kpi exec-hero-kpi--chart">
            <span className="exec-hero-kpi__label">Leak signals (7d)</span>
            <MiniSparkline values={REVENUE_LEAK_TREND} color="var(--amber)" id="leak-trend" width={160} height={40} />
          </div>
        </div>
      </header>

      <div className="exec-layout-2">
        <section className="exec-panel exec-panel--layered">
          <div className="exec-panel__head">
            <h2>Unpaid balances</h2>
            <Link to={ROUTES.ownerBriefing} className="exec-panel__link-inline">
              Owner briefing
            </Link>
          </div>
          <ul className="exec-balance-list">
            {REVENUE_UNPAID_BALANCES.map(b => (
              <li key={b.id} className={`exec-balance exec-balance--${b.severity}`}>
                <div className="exec-balance__top">
                  <strong>{b.client}</strong>
                  <span>{formatCurrency(b.amount)}</span>
                </div>
                <div className="exec-balance__event">{b.event}</div>
                <div className="exec-balance__foot">
                  <span>Due {b.due}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="exec-panel exec-panel--layered">
          <div className="exec-panel__head">
            <h2>Stale leads</h2>
            <Link to={ROUTES.leads} className="exec-panel__link-inline">
              Leads
            </Link>
          </div>
          <ul className="exec-stale-list">
            {REVENUE_STALE_LEADS.map(l => (
              <li key={l.id}>
                <strong>{l.who}</strong>
                <span>
                  {l.org} · {l.age} · {formatCurrency(l.value)} · {l.channel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="exec-layout-2">
        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Dormant repeat clients</h2>
          </div>
          <ul className="exec-dormant-list">
            {REVENUE_DORMANT_CLIENTS.map(d => (
              <li key={d.id} className="exec-dormant">
                <div className="exec-dormant__top">
                  <strong>{d.org}</strong>
                  <span>LTV {formatCurrency(d.ltv)}</span>
                </div>
                <span className="exec-dormant__last">Last event · {d.lastEvent}</span>
                <p className="exec-dormant__suggest">{d.suggestion}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Missed add-on opportunities</h2>
          </div>
          <ul className="exec-addon-list">
            {REVENUE_MISSED_ADDONS.map(a => (
              <li key={a.id}>
                <div className="exec-addon__top">
                  <strong>{a.item}</strong>
                  <span>+{formatCurrency(a.est)}</span>
                </div>
                <span className="exec-addon__event">{a.event}</span>
                <span className="exec-addon__why">{a.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="exec-layout-2">
        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Low occupancy weekdays</h2>
            <Link to={ROUTES.calendar} className="exec-panel__link-inline">
              Calendar
            </Link>
          </div>
          <MiniBars
            items={REVENUE_LOW_WEEKDAYS.map(d => ({ label: d.day, value: d.pct, hint: d.note }))}
          />
        </section>

        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Underperforming event categories</h2>
          </div>
          <ul className="exec-category-list">
            {REVENUE_UNDERPERFORMING_CATEGORIES.map((c, i) => (
              <li key={i} className={c.vsGoal.startsWith('+') ? 'exec-category--up' : 'exec-category--down'}>
                <strong>{c.category}</strong>
                <span className="exec-category__vs">{c.vsGoal} vs goal</span>
                <span>{c.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="exec-layout-2">
        <section className="exec-panel exec-panel--accent">
          <div className="exec-panel__head">
            <h2>AI recovery actions</h2>
            <span className="exec-panel__hint">Queued · nothing sends without approval</span>
          </div>
          <ul className="exec-recovery-list">
            {REVENUE_AI_RECOVERY_ACTIONS.map(x => (
              <li key={x.id}>
                <div className="exec-recovery__top">
                  <strong>{x.title}</strong>
                  <span>{x.impact}</span>
                </div>
                <span>
                  {x.agent} · <em className={`exec-status-pill exec-status-pill--${x.status}`}>{x.status.replace('_', ' ')}</em>
                </span>
              </li>
            ))}
          </ul>
          <Link to={ROUTES.autopilot} className="exec-panel__link">
            Review in Autopilot →
          </Link>
        </section>

        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Re-engagement recommendations</h2>
          </div>
          <ul className="exec-reengage-list">
            {REVENUE_REENGAGEMENT.map(g => (
              <li key={g.id}>
                <strong>{g.target}</strong>
                <p>{g.action}</p>
                <span className="exec-reengage__when">{g.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ExecutiveIntelStrip title="Executive suite" />
    </div>
  );
}
