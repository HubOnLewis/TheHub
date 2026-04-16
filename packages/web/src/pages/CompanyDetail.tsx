// packages/web/src/pages/CompanyDetail.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCompany, useCompanyActivities,
  useCreateActivity, useCompanySummary,
} from '../hooks/useCompanies.js';
import { useDeals, useDealMutations } from '../hooks/useDeals.js';
import { Modal, EmptyState, Spinner, Pagination } from '../components/ui/index.js';
import ActivityComposer from '../components/ActivityComposer.js';
import AccountSidebar   from '../components/AccountSidebar.js';
import { timeAgo, CreateDealSchema, type CreateDealPayload, type ActivityType } from '@mtte-core/shared';

// ── Activity display maps ─────────────────────────────────────────
const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call_out:  'Call Out',  call_in:   'Call In',
  email_out: 'Email Out', email_in:  'Email In',
  text_out:  'Text Out',  text_in:   'Text In',
  visit:     'Visit',     event:     'Event',
  other:     'Note',
};
const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  call_out:  '#3b82f6', call_in:   '#22c55e',
  email_out: '#8b5cf6', email_in:  '#a78bfa',
  text_out:  '#f59e0b', text_in:   '#fbbf24',
  visit:     'var(--red)', event:  '#06b6d4',
  other:     'var(--text-secondary)',
};
const TYPE_ICON: Partial<Record<ActivityType, string>> = {
  call_out: '📞', call_in: '📲', email_out: '✉️', email_in: '📩',
  text_out: '💬', text_in: '💬', visit: '🏢', event: '📅', other: '📝',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function CompanyDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [actPage, setActPage]   = useState(1);
  const [showDealModal, setShowDealModal] = useState(false);

  const { data: company,        isLoading: companyLoading }  = useCompany(id!);
  const { data: activitiesData, isLoading: actLoading }      = useCompanyActivities(id!, { page: actPage, limit: 20 });
  const { data: summary,        isLoading: summaryLoading }  = useCompanySummary(id!);
  const createActivity = useCreateActivity(id!);

  const companyName = (company as any)?.name ?? '';
  const { data: dealsData } = useDeals({ search: companyName, limit: 50 });
  const allDeals: any[] = (dealsData as any)?.data ?? [];
  // Filter to exact company name match (case-insensitive)
  const companyDeals = allDeals.filter(
    (d: any) => d.company?.toLowerCase() === companyName.toLowerCase(),
  );

  const { create: createDeal } = useDealMutations();
  const dealForm = useForm<CreateDealPayload>({
    resolver: zodResolver(CreateDealSchema),
    defaultValues: { company: companyName, status: 'Draft', amount: 0 },
  });

  const activities = (activitiesData as any)?.data  ?? [];
  const actTotal   = (activitiesData as any)?.total ?? 0;
  const actPages   = (activitiesData as any)?.pages ?? 1;

  if (companyLoading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
        <Spinner /><span className="text-muted">Loading…</span>
      </div>
    );
  }
  if (!company) {
    return <EmptyState message="Company not found" sub="It may have been removed or you may not have access." />;
  }

  const c = company as any;

  const handleNewDeal = async (data: CreateDealPayload) => {
    await createDeal.mutateAsync(data);
    setShowDealModal(false);
    dealForm.reset({ company: companyName, status: 'Draft', amount: 0 });
  };

  return (
    <div>
      {/* ── Back nav ── */}
      <div style={{ marginBottom: 14 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 0', color: 'var(--text-secondary)' }}
          onClick={() => navigate('/companies')}
        >
          ← Companies
        </button>
      </div>

      {/* ── Account Header ── */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {c.name}
              </h2>
              {c.isStub && (
                <span className="badge" style={{ background: 'var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                  stub
                </span>
              )}
              <span className="badge badge-draft" style={{ fontSize: 11 }}>
                {c.source}
              </span>
            </div>
            {(c.address?.city || c.address?.street) && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {[c.address?.street, c.address?.city, c.address?.state, c.address?.postalCode]
                  .filter(Boolean).join(', ')}
              </div>
            )}
            {c.phone && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>📞 {c.phone}</div>
            )}
          </div>

          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <KpiChip label="Last Contact" value={c.daysSinceLastContact != null ? `${c.daysSinceLastContact}d ago` : '—'} />
            <KpiChip label="Activities"  value={String(actTotal)} />
            <KpiChip label="Added"       value={timeAgo(c.createdAt)} />
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>

        {/* ── Left: composer + timeline ── */}
        <div>
          <ActivityComposer
            companyId={id!}
            deals={companyDeals.map((d: any) => ({ _id: d._id, title: d.title, status: d.status }))}
            onSubmit={async (payload) => {
              await createActivity.mutateAsync(payload);
            }}
          />

          {/* Section header */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Activity History · {actTotal}
            </span>
          </div>

          {actLoading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
              <Spinner /><span className="text-muted">Loading…</span>
            </div>
          ) : activities.length === 0 ? (
            <EmptyState message="No activities" sub="Log the first interaction above." />
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activities.map((a: any) => (
                  <ActivityCard key={a._id} a={a} />
                ))}
              </div>
              {actPages > 1 && (
                <div style={{ marginTop: 14 }}>
                  <Pagination page={actPage} pages={actPages} total={actTotal} onPage={setActPage} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: sidebar ── */}
        <AccountSidebar
          summary={summary}
          deals={companyDeals}
          loading={summaryLoading}
          onNewDeal={() => {
            dealForm.reset({ company: companyName, status: 'Draft', amount: 0 });
            setShowDealModal(true);
          }}
        />
      </div>

      {/* ── New Deal modal ── */}
      {showDealModal && (
        <Modal title="New Deal" onClose={() => setShowDealModal(false)} width={580}>
          <form onSubmit={dealForm.handleSubmit(handleNewDeal)}>
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Deal Title *</label>
                <input className={`form-input${dealForm.formState.errors.title ? ' error' : ''}`} {...dealForm.register('title')} placeholder="e.g. 2025 Peterbilt 579 — Replacement" />
                {dealForm.formState.errors.title && <span className="form-error">{dealForm.formState.errors.title.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" {...dealForm.register('company')} readOnly style={{ background: 'var(--bg)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact *</label>
                <input className={`form-input${dealForm.formState.errors.contact ? ' error' : ''}`} {...dealForm.register('contact')} placeholder="Contact name" />
                {dealForm.formState.errors.contact && <span className="form-error">{dealForm.formState.errors.contact.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input type="number" className="form-input" min={0} {...dealForm.register('amount', { valueAsNumber: true })} />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input className="form-input" {...dealForm.register('assignedTo')} placeholder="Rep name" />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDealModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={createDeal.isPending}>
                {createDeal.isPending ? 'Creating…' : 'Create Deal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-cond)', fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ActivityCard({ a }: { a: any }) {
  const typeLabel = ACTIVITY_TYPE_LABELS[a.activityType as ActivityType] ?? a.activityTypeRaw;
  const typeColor = ACTIVITY_TYPE_COLOR[a.activityType as ActivityType] ?? 'var(--text-secondary)';
  const icon      = TYPE_ICON[a.activityType as ActivityType] ?? '•';
  const tagKeys   = Object.keys(a.tags ?? {}).filter((k: string) => a.tags[k]);
  const hasFollowUp = !!a.followUpAt;

  return (
    <div className="card" style={{ padding: '13px 16px' }}>
      {/* Row 1: type + contact + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: `${typeColor}22`, color: typeColor, whiteSpace: 'nowrap',
          }}>
            <span>{icon}</span>{typeLabel}
          </span>
          {a.contactNameRaw && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.contactNameRaw}</span>
          )}
          {a.outcome && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '1px 7px', borderRadius: 4 }}>
              {a.outcome}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>
          <div>{fmtDate(a.createdAt)}</div>
          <div>{a.createdByName}</div>
        </div>
      </div>

      {/* Title */}
      {a.title && (
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{a.title}</div>
      )}

      {/* Body */}
      {a.body && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>{a.body}</p>
      )}

      {/* Follow-up chip + tags */}
      {(hasFollowUp || tagKeys.length > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {hasFollowUp && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>
              ⏰ Follow-up: {fmtDate(a.followUpAt)}
              {a.followUpNote && ` — ${a.followUpNote}`}
            </span>
          )}
          {tagKeys.map((k: string) => (
            <span key={k} style={{ fontSize: 10, fontWeight: 600, background: 'var(--border)', color: 'var(--text-secondary)', padding: '1px 7px', borderRadius: 4 }}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

