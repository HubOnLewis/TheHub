// packages/web/src/components/AccountSidebar.tsx
import type { CompanySummary } from '../hooks/useCompanies.js';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface Deal {
  _id:    string;
  title:  string;
  status: string;
  amount: number;
}

interface Props {
  summary:  CompanySummary | undefined;
  deals:    Deal[];
  loading?: boolean;
  onNewDeal?: () => void;
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

export default function AccountSidebar({ summary, deals, loading, onNewDeal }: Props) {
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
              <SnapRow label="Deals" value={String(summary.dealCount)} />
              <SnapRow label="Open Pipeline" value={fmt.format(summary.openPipelineTotal)} />
              <SnapRow label="Won / Delivered" value={fmt.format(summary.wonTotal)} />
              {summary.nextFollowUp && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                    ⏰ Next Follow-up
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(summary.nextFollowUp.date)}</div>
                  {summary.nextFollowUp.note && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{summary.nextFollowUp.note}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deals card */}
      <div className="card">
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-cond)', fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Deals
          </span>
          {onNewDeal && (
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onNewDeal}>
              + New Deal
            </button>
          )}
        </div>
        <div>
          {deals.length === 0 ? (
            <div style={{ padding: '14px', color: 'var(--text-light)', fontSize: 12, textAlign: 'center' }}>No deals yet</div>
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
                    {deal.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {fmt.format(deal.amount)}
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
