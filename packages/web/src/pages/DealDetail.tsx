import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatCurrency, dealStatusForDisplay, HUB_LABELS } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import { useDeal } from '../hooks/useDeal.js';
import { DEMO_DEAL_WORKSPACE } from '../data/demoVenue.js';
import DealAutopilotRail from '../components/DealAutopilotRail.js';
import EventOperationsTimeline from '../components/deals/EventOperationsTimeline.js';
import EmbeddedAgentPanel from '../components/agents/EmbeddedAgentPanel.js';
import { DEAL_INSIGHTS } from '../data/embeddedAgentInsights.js';
import AuditEntityHistory from '../components/audit/AuditEntityHistory.js';
import { useAuditStore } from '../audit/auditStore.js';
import ContextAgentDock from '../components/agents/ContextAgentDock.js';
import { Spinner } from '../components/ui/index.js';
import { useDemoOpsStore, type DemoEventStage } from '../state/demoOpsStore.js';
import EventFinalizationChecklist from '../components/deals/EventFinalizationChecklist.js';
import { trackEvent } from '../analytics/index.js';

const STAGES: DemoEventStage[] = [
  'Lead',
  'Qualified',
  'Proposal Sent',
  'Confirmed',
  'Balance Due',
  'Completed',
  'Lost / Archived',
];

export default function DealDetail() {
  const { dealId } = useParams<{ dealId: string }>();
  const { data: apiDeal, isLoading } = useDeal(dealId);
  const ensureInitialized = useDemoOpsStore(s => s.ensureInitialized);
  const dealOps = useDemoOpsStore(s => s.deal);
  const setDealStage = useDemoOpsStore(s => s.setDealStage);
  const addDealNote = useDemoOpsStore(s => s.addDealNote);
  const auditEvents = useAuditStore(s => s.events);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const model = useMemo(() => {
    const d = DEMO_DEAL_WORKSPACE;
    if (!apiDeal || typeof apiDeal !== 'object') {
      return { ...d, id: dealId ?? d.id };
    }
    const a = apiDeal as Record<string, unknown>;
    const title = typeof a.title === 'string' ? a.title : d.title;
    const company = typeof a.company === 'string' ? a.company : d.client;
    const amount = typeof a.amount === 'number' ? a.amount : d.revenue;
    const status = typeof a.status === 'string' ? a.status : 'Won';
    const collected =
      typeof a.collected === 'number'
        ? (a.collected as number)
        : Math.round(amount * (d.collected / Math.max(1, d.revenue)));
    return {
      ...d,
      id: String(a._id ?? dealId),
      title,
      client: company,
      revenue: amount,
      collected,
      proposalStatus: dealStatusForDisplay(status),
    };
  }, [apiDeal, dealId]);

  useEffect(() => {
    if (!dealId) return;
    const status = model.proposalStatus?.toLowerCase() ?? '';
    if (status.includes('sent') || status.includes('viewed') || status.includes('proposal')) {
      trackEvent('proposal_viewed', { deal_id: dealId });
    }
  }, [dealId, model.proposalStatus]);

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  const paidPct = model.revenue > 0 ? Math.round((model.collected / model.revenue) * 100) : 0;

  return (
    <div className="deal-flagship-page command-page">
      <div style={{ marginBottom: 16 }}>
        <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12 }}>
          ← Events
        </Link>
      </div>

      <div className="deal-layout-main deal-layout-main--simple">
      <header className="flagship-hero flagship-hero--cinematic">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <span className="ai-chip">Event</span>
            <h1>{model.title}</h1>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {HUB_LABELS.client}: <strong style={{ color: 'var(--text-primary)' }}>{model.client}</strong>
              {' · '}
              <Link style={{ color: 'var(--red)' }} to={ROUTES.accounts}>
                {HUB_LABELS.accounts}
              </Link>
            </div>
            <div className="deal-stage-control" style={{ marginTop: 14 }}>
              <label className="deal-stage-control__label">Event stage</label>
              <select
                className="form-select"
                value={dealOps.stage}
                onChange={e => setDealStage(e.target.value as DemoEventStage)}
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-light)' }}>
              AI booking outlook
            </div>
            <div style={{ fontFamily: 'var(--font-cond)', fontSize: 42, fontWeight: 800, color: 'var(--green)' }}>
              {model.aiClosePct}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 220, marginTop: 6 }}>
              Based on deposit timing, reply cadence, and similar Wichita nonprofit events.
            </div>
          </div>
        </div>

        <div className="flagship-grid" style={{ marginTop: 22 }}>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Event window</div>
            <div className="flagship-stat__value" style={{ fontSize: 15, fontWeight: 600 }}>
              {new Date(model.eventStart).toLocaleString()} →{' '}
              {new Date(model.eventEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Guest count</div>
            <div className="flagship-stat__value">{model.guestCount}</div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">{HUB_LABELS.bookings} / spaces</div>
            <div className="flagship-stat__value" style={{ fontSize: 15 }}>
              {model.spacesBooked.join(' · ')}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Revenue</div>
            <div className="flagship-stat__value">{formatCurrency(model.revenue)}</div>
          </div>
          <div className="flagship-stat flagship-stat--span">
            <div className="flagship-stat__label">Payment progress</div>
            <div className="flagship-stat__value">
              {formatCurrency(model.collected)} ({paidPct}%)
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${paidPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--green), var(--blue))',
                }}
              />
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">{HUB_LABELS.proposal} status</div>
            <div className="flagship-stat__value" style={{ fontSize: 14 }}>
              {model.proposalStatus}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Contract</div>
            <div className="flagship-stat__value" style={{ fontSize: 14 }}>
              {model.contractStatus}
            </div>
          </div>
        </div>
      </header>

      <EventFinalizationChecklist dealId={model.id} />

      <div className="deal-detail-grid">
        <section className="card deal-panel">
          <div className="deal-panel__title">Payment milestones</div>
          <div className="milestone-stack">
            {model.paymentMilestones.map((m, i) => (
              <div key={i} className={`milestone-row milestone-row--${m.status}`}>
                <div className="milestone-row__main">
                  <span className="milestone-label">{m.label}</span>
                  <span className="milestone-amt">{formatCurrency(m.amount)}</span>
                </div>
                <div className="milestone-meta">
                  {m.status === 'paid' && <span className="badge badge-new">Paid</span>}
                  {m.status === 'due' && (
                    <>
                      <span className="badge badge-quoted">Due</span>
                      {m.dueDate ? <span>by {m.dueDate}</span> : null}
                    </>
                  )}
                  {m.status === 'scheduled' && (
                    <>
                      <span className="milestone-pill">Scheduled</span>
                      {m.dueDate ? <span>{m.dueDate}</span> : null}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card deal-panel">
          <div className="deal-panel__title">Contract & proposal progression</div>
          <ul className="contract-steps">
            {model.contractSteps.map((s, i) => (
              <li key={i} className={s.complete ? 'contract-steps__done' : 'contract-steps__open'}>
                <span className="contract-steps__dot" aria-hidden />
                <div>
                  <strong>{s.label}</strong>
                  {s.detail ? <span className="contract-steps__detail">{s.detail}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card deal-panel deal-panel--wide">
          <div className="deal-panel__title">Room & package selections</div>
          <table className="data-table deal-package-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th>Qty</th>
                <th style={{ textAlign: 'right' }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {model.selectedPackages.map(p => (
                <tr key={p.code}>
                  <td>
                    <code className="sku-code">{p.code}</code>
                  </td>
                  <td>{p.name}</td>
                  <td>{p.qty}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(p.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card deal-panel">
          <div className="deal-panel__title">Guest notes & preferences</div>
          <ul className="guest-pref-list">
            {model.guestPreferences.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>

        <section className="card deal-panel deal-panel--wide deal-panel--timeline">
          <EventOperationsTimeline />
        </section>

        <section className="card deal-panel">
          <div className="deal-panel__title">Internal notes</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{model.notesInternal}</p>
          <ul className="deal-notes-list">
            {dealOps.internalNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <div className="deal-note-compose">
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Add internal note…"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                addDealNote(noteDraft);
                setNoteDraft('');
              }}
            >
              Add note
            </button>
          </div>
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-light)', marginBottom: 8 }}>
              NEXT BEST ACTION
            </div>
            <div style={{ fontWeight: 600 }}>
              {dealOps.nextActionComplete ? '✓ Complete' : model.nextAction}
            </div>
          </div>
        </section>

        <details className="deal-advanced card">
          <summary className="deal-advanced__summary">Insights & audit (optional)</summary>
          <div className="deal-advanced__body">
            <ContextAgentDock context="deal" compact />
            <EmbeddedAgentPanel title="Event agents" insights={DEAL_INSIGHTS} compact />
            <section className="deal-panel deal-panel--ai" style={{ marginTop: 14 }}>
              <div className="deal-panel__title">Booking playbook</div>
              <p className="ai-playbook-headline">{model.aiPlaybook.headline}</p>
            </section>
            <DealAutopilotRail />
            <AuditEntityHistory events={auditEvents} entityType="opportunity" entityId={model.id} limit={6} />
          </div>
        </details>
      </div>
      </div>
    </div>
  );
}
