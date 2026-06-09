import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import { DonutPct, MiniSparkline } from '../components/executive/ExecutiveCharts.js';
import ExecutiveIntelStrip from '../components/executive/ExecutiveIntelStrip.js';
import {
  AUTOMATION_HIGHLIGHTS,
  AUTOMATION_IMPACT_SUMMARY,
  AUTOMATION_METRICS,
  AUTOMATION_WEEKLY_ACTIVITY,
  AUTOMATION_WORKFLOW_EFFICIENCY,
} from '../data/executiveDemo.js';

export default function AutomationImpact() {
  return (
    <div className="exec-page exec-page--automation">
      <div className="exec-page__glow exec-page__glow--emerald" aria-hidden />

      <header className="exec-page__hero">
        <div>
          <span className="exec-page__badge">The Hub Autopilot</span>
          <h1 className="exec-page__title">Automation impact</h1>
          <p className="exec-page__subtitle">
            Measurable labor reduction at HuB on Lewis — follow-ups, reminders, and booking workflows your team no longer
            chases manually.
          </p>
          <p className="exec-page__meta">{AUTOMATION_IMPACT_SUMMARY.period}</p>
        </div>
        <div className="exec-hero-kpis">
          <div className="exec-hero-kpi exec-hero-kpi--primary">
            <span className="exec-hero-kpi__label">Hours saved (30d)</span>
            <span className="exec-hero-kpi__value">{AUTOMATION_IMPACT_SUMMARY.hoursSaved30d}h</span>
            <span className="exec-hero-kpi__sub">{AUTOMATION_IMPACT_SUMMARY.hoursSavedDelta} vs prior month</span>
          </div>
          <div className="exec-hero-kpi">
            <span className="exec-hero-kpi__label">Labor cost avoided (est.)</span>
            <span className="exec-hero-kpi__value">${AUTOMATION_IMPACT_SUMMARY.laborCostAvoided}</span>
            <span className="exec-hero-kpi__sub">At $30/hr coordinator blend</span>
          </div>
          <div className="exec-hero-kpi">
            <DonutPct pct={88} color="var(--green)" />
            <span className="exec-hero-kpi__sub" style={{ marginTop: 8 }}>
              Approval pass rate
            </span>
          </div>
        </div>
      </header>

      <div className="exec-metric-grid">
        {AUTOMATION_METRICS.map(m => (
          <div key={m.id} className="exec-metric-card">
            <span className="exec-metric-card__label">{m.label}</span>
            <span className="exec-metric-card__value">{m.value}</span>
            <span className="exec-metric-card__sub">{m.sub}</span>
            <span className="exec-metric-card__delta">{m.delta}</span>
          </div>
        ))}
      </div>

      <div className="exec-layout-2">
        <section className="exec-panel exec-panel--layered">
          <div className="exec-panel__head">
            <h2>Booking workflow efficiency</h2>
            <span className="exec-panel__hint">Before Autopilot → after (rolling 90d)</span>
          </div>
          <ul className="exec-efficiency-list">
            {AUTOMATION_WORKFLOW_EFFICIENCY.map(w => (
              <li key={w.stage}>
                <div className="exec-efficiency__head">
                  <strong>{w.stage}</strong>
                  <span className="exec-efficiency__pct">−{w.pct}%</span>
                </div>
                <div className="exec-efficiency__compare">
                  <span>{w.before}</span>
                  <span aria-hidden>→</span>
                  <span className="exec-efficiency__after">{w.after}</span>
                </div>
                <div className="exec-efficiency__bar" aria-hidden>
                  <div style={{ width: `${w.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="exec-panel exec-panel--chart">
          <div className="exec-panel__head">
            <h2>Autopilot activity (7d)</h2>
            <Link to={ROUTES.autopilot} className="exec-panel__link-inline">
              Command center
            </Link>
          </div>
          <MiniSparkline values={AUTOMATION_WEEKLY_ACTIVITY} color="var(--green)" id="auto-week" width={280} height={56} />
          <p className="exec-panel__foot">
            {AUTOMATION_IMPACT_SUMMARY.workflowsCompleted} workflows completed in period · human-in-the-loop on outbound
          </p>
          <ul className="exec-highlight-list">
            {AUTOMATION_HIGHLIGHTS.map(h => (
              <li key={h.id}>
                <strong>{h.title}</strong>
                <span>{h.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ExecutiveIntelStrip title="Executive suite" />
    </div>
  );
}
