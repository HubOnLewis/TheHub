// packages/web/src/components/AccountSidebar.tsx
import type { CompanySummary } from '../hooks/useCompanies.js';
import { dealStatusForDisplay, HUB_LABELS } from '@hub-crm/shared';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface Deal {
  _id:    string;
  title:  string;
  status: string;
  amount?: number;
}

interface Props {
  summary:  CompanySummary | undefined;
  deals:    Deal[];
  loading?: boolean;
  onNewDeal?: () => void;
  onEditPlan?: () => void;
}

const DEAL_STATUS_CSS: Record<string, string> = {
  'Draft':            'badge-draft',
  'Pending Approval': 'badge-pendingapproval',
  'Approved':         'badge-approved',
  'Won':              'badge-won',
  'In Build':         'badge-inbuild',
  'Delivered':        'badge-delivered',
  'Lost':             'badge-lost',
};

export default function AccountSidebar({ summary, deals, loading, onNewDeal, onEditPlan }: Props) {
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Snapshot card */}
      <div className="card">
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-cond)', fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Snapshot
          </span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {loading || !summary ? (
            <div style={{ color: 'var(--text-light)', fontSize: 12 }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SnapRow label="Opportunities" value={String(summary.dealCount)} />
              <SnapRow label="Open Pipeline" value={fmt.format(summary.openPipelineTotal)} />
              <SnapRow label="Won / completed" value={fmt.format(summary.wonTotal)} />
              {summary.engagementState && (
                <>
                  <SnapRow
                    label="Days Since Interaction"
                    value={summary.engagementState.daysSinceLastInteraction != null ? String(summary.engagementState.daysSinceLastInteraction) : '—'}
                  />
                  <SnapRow label="Open Follow-ups" value={String(summary.engagementState.openFollowUps)} />
                  <SnapRow label="Overdue Follow-ups" value={String(summary.engagementState.overdueFollowUps)} />
                  {summary.engagementState.isStale && (
                    <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>Stale activity ({'>'}{14} days)</div>
                  )}
                </>
              )}
              {summary.accountPenetrationState && (
                <>
                  <SnapRow label="Penetration" value={summary.accountPenetrationState.penetrationLevel} />
                  <SnapRow label="Coverage Risk" value={summary.accountPenetrationState.coverageRiskLevel} />
                  {summary.accountExpansionState && <SnapRow label="Expansion Readiness" value={summary.accountExpansionState.expansionReadiness} />}
                  {summary.accountExpansionState && <SnapRow label="Planning Priority" value={summary.accountExpansionState.planningPriority} />}
                  {summary.accountPlan && <SnapRow label="Plan Status" value={summary.accountPlan.status} />}
                  <SnapRow label="Unique Contacts (30/90)" value={`${summary.accountPenetrationState.uniqueContacts30d}/${summary.accountPenetrationState.uniqueContacts90d}`} />
                  <SnapRow label={`Open / stalled / critical ${HUB_LABELS.opportunities.toLowerCase()}`} value={`${summary.accountPenetrationState.openDeals}/${summary.accountPenetrationState.stalledDeals}/${summary.accountPenetrationState.criticalDeals}`} />
                </>
              )}
              {onEditPlan && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={onEditPlan}>
                    {summary?.accountPlan ? 'Edit Account Plan' : 'Create Account Plan'}
                  </button>
                </div>
              )}
              {!!summary.accountCoverageWarnings?.length && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Coverage Warnings</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12 }}>
                    {summary.accountCoverageWarnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {summary.accountPenetrationState && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Whitespace Signals</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12 }}>
                    {(summary.accountPenetrationState.whitespaceSignals ?? []).slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {!!summary.accountExpansionState && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Expansion Signals</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12 }}>
                    {(summary.accountExpansionState.opportunitySignals ?? []).slice(0, 3).map((x, i) => <li key={`o-${i}`}>{x}</li>)}
                    {(summary.accountExpansionState.blockers ?? []).slice(0, 2).map((x, i) => <li key={`b-${i}`} style={{ color: 'var(--red)' }}>{x}</li>)}
                  </ul>
                </div>
              )}
              {!!summary.customerDeliveryContext && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Client closeout</div>
                  <SnapRow label="Pending post-event follow-ups" value={String(summary.customerDeliveryContext.pendingPostDeliveryFollowUps.length)} />
                  {summary.customerDeliveryContext.recentDeliveredUnits.slice(0, 3).map(u => (
                    <div key={u.deliveryRecordId} style={{ fontSize: 11, marginTop: 6, color: 'var(--text-secondary)' }}>
                      {u.unitSummary} · client packet {u.packetStatus} · {u.deliveryHandoffState?.readinessLevel ?? '—'}
                    </div>
                  ))}
                  {!!summary.customerDeliveryContext.customerHandoffWarnings?.length && (
                    <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 11, color: 'var(--red)' }}>
                      {summary.customerDeliveryContext.customerHandoffWarnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {!!summary.accountPenetrationState?.penetrationReasons?.length && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Penetration Reasons</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12 }}>
                    {(summary.accountPenetrationState.penetrationReasons ?? []).slice(0, 3).map((x, i) => <li key={`pr-${i}`}>{x}</li>)}
                  </ul>
                </div>
              )}
              {!!summary.accountPenetrationState?.coverageRiskReasons?.length && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>Coverage Risk Reasons</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12 }}>
                    {(summary.accountPenetrationState.coverageRiskReasons ?? []).slice(0, 3).map((x, i) => <li key={`cr-${i}`}>{x}</li>)}
                  </ul>
                </div>
              )}
              {summary.nextFollowUp && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: summary.nextFollowUp.isOverdue ? 'var(--red)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                    {summary.nextFollowUp.isOverdue ? '⏰ Overdue follow-up' : '⏰ Next follow-up'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(summary.nextFollowUp.date)}</div>
                  {summary.nextFollowUp.summary && (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4, fontWeight: 600 }}>{summary.nextFollowUp.summary}</div>
                  )}
                  {summary.nextFollowUp.ownerName && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Owner: {summary.nextFollowUp.ownerName}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Opportunities */}
      <div className="card">
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-cond)', fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Opportunities
          </span>
          {onNewDeal && (
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onNewDeal}>
              + New
            </button>
          )}
        </div>
        <div>
          {deals.length === 0 ? (
            <div style={{ padding: '14px', color: 'var(--text-light)', fontSize: 12, textAlign: 'center' }}>No opportunities yet</div>
          ) : (
            deals.map(deal => (
              <div
                key={deal._id}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {deal.title}
                  </span>
                  <span className={`badge ${DEAL_STATUS_CSS[deal.status] ?? 'badge-draft'}`}>
                    {dealStatusForDisplay(deal.status)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {fmt.format(deal.amount ?? 0)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </aside>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-cond)' }}>{value}</span>
    </div>
  );
}
