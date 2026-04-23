// packages/web/src/pages/Deals.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDeals, useDealMutations, useDealInteractions } from '../hooks/useDeals.js';
import { useCompanySearch } from '../hooks/useCompanies.js';
import { useCreateInteraction, type InteractionRow } from '../hooks/useInteractions.js';
import { Modal, StatusSelect, EmptyState, Pagination, StatusBadge, TableSkeleton } from '../components/ui/index.js';
import InteractionComposer from '../components/InteractionComposer.js';
import InteractionTimeline from '../components/InteractionTimeline.js';
import {
  CreateDealSchema, DEAL_STATUSES,
  type CreateDealPayload, type DealStatus,
  formatCurrency, timeAgo,
} from '@mtte-core/shared';

type Deal = {
  _id: string; title: string; company: string; contact: string; amount: number;
  assignedTo?: string; status: DealStatus; tenantId: string; updatedAt: string; lastTouchedAt?: string;
  ownerUserId?: string;
  lastStageChangeAt?: string;
  daysInStage?: number;
  atRisk?: { flagged: boolean; reason?: string; flaggedAt?: string; flaggedByName?: string };
  managementReview?: { reviewedAt?: string; reviewedByName?: string; status?: 'approved' | 'challenged' | 'watch'; notes?: string };
  dealExecutionState?: {
    pressureLevel: 'low' | 'medium' | 'high' | 'critical';
    pressureReasons: string[];
    lastInteractionAt?: string;
    daysSinceLastInteraction?: number;
    openFollowUps: number;
    overdueFollowUps: number;
    nextActionSummary?: string;
    isStalled: boolean;
  };
  forecastState?: {
    confidence: 'low' | 'medium' | 'high';
    forecastCategory: 'commit' | 'best_case' | 'pipeline' | 'excluded';
    forecastAmount?: number;
    needsManagementReview: boolean;
    confidenceReasons: string[];
    reviewReasons: string[];
  };
  pipelineWarnings?: string[];
  dealBuildFinancialSummary?: {
    buildCount: number;
    totalEstimatedCost: number;
    totalEstimatedSell: number;
    totalEstimatedMargin: number;
    hasIncompleteBuildCosting: boolean;
    hasHighMarginRiskBuilds: boolean;
  };
};

const STATUS_COLOR: Record<string, string> = {
  Won: '--status-won', Lost: '--status-lost', Delivered: '--status-delivered',
  Approved: '--status-approved', 'In Build': '--status-inbuild',
};

// Stale thresholds per workflow spec (days since lastTouchedAt, fallback to updatedAt)
const STALE_DAYS: Partial<Record<DealStatus, number>> = {
  Draft: 5, 'Pending Approval': 2, Approved: 7, Won: 14, 'In Build': 30,
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
}

function isDealStale(deal: Deal): boolean {
  const threshold = STALE_DAYS[deal.status];
  const clock = deal.lastTouchedAt ?? deal.updatedAt;
  return threshold !== undefined && daysSince(clock) >= threshold;
}

function isUnassigned(deal: Deal): boolean {
  return !deal.assignedTo?.trim();
}

// Terminal stages — no further workflow movement permitted
const TERMINAL_DEAL_STATUSES = new Set<DealStatus>(['Delivered', 'Lost']);

// Valid forward transitions per locked workflow spec (mirrors backend validateTransition)
const DEAL_TRANSITIONS: Partial<Record<DealStatus, DealStatus[]>> = {
  'Draft':            ['Pending Approval', 'Lost'],
  'Pending Approval': ['Approved',         'Lost'],
  'Approved':         ['Won',              'Lost'],
  'Won':              ['In Build',         'Lost'],
  'In Build':         ['Delivered',        'Lost'],
};

/** Returns [current, ...validNext] for the status dropdown; empty transitions for terminals */
function getValidDealOptions(current: DealStatus): readonly DealStatus[] {
  if (TERMINAL_DEAL_STATUSES.has(current)) return [current];
  return [current, ...(DEAL_TRANSITIONS[current] ?? [])];
}

/** Pulls the user-facing message out of an axios error response */
function extractError(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.error ?? e?.message ?? 'An error occurred';
}

export default function Deals() {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeOnly,   setActiveOnly]   = useState(true);
  const [unassigned,   setUnassigned]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [showModal,    setShowModal]    = useState(false);
  const [execDeal,     setExecDeal]     = useState<Deal | null>(null);
  const [quickMode,    setQuickMode]    = useState<'log_call' | 'schedule_follow_up' | 'add_note'>('log_call');
  const [mutErr,       setMutErr]       = useState<string | null>(null);

  const params = {
    search:     search || undefined,
    status:     statusFilter || undefined,
    active:     !statusFilter && activeOnly ? true : undefined,
    assignedTo: unassigned ? '__unassigned__' : undefined,
    page,
    limit:      25,
    sort:       'updatedAt',
    order:      'asc' as const,
  };

  const { data, isLoading } = useDeals(params);
  const mutations = useDealMutations();
  const { data: dealInteractions = [] } = useDealInteractions(execDeal?._id ?? null);
  const { data: companyOptions = [] } = useCompanySearch(execDeal?.company ?? '');
  const companyId = ((companyOptions as Array<{ _id: string; name: string }>).find(c => c.name.toLowerCase() === (execDeal?.company ?? '').toLowerCase())
    ?? (companyOptions as Array<{ _id: string }>)[0])?._id;
  const createInteraction = useCreateInteraction(companyId ?? '');

  const deals = (data as any)?.data  ?? [];
  const total = (data as any)?.total ?? 0;
  const pages = (data as any)?.pages ?? 1;

  const pipeline = deals
    .filter((d: Deal) => !['Lost', 'Delivered'].includes(d.status))
    .reduce((n: number, d: Deal) => n + d.amount, 0);

  function handleStatusFilter(s: string) {
    setStatusFilter(f => f === s ? '' : s);
    setActiveOnly(false);
    setPage(1);
  }

  function handleActiveToggle() {
    setActiveOnly(v => !v);
    setStatusFilter('');
    setPage(1);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deals</h1>
          <div className="page-subtitle">
            {total} deals · {formatCurrency(pipeline)} active pipeline
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Deal</button>
      </div>

      {/* Filter strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`btn ${activeOnly && !statusFilter ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12 }}
          onClick={handleActiveToggle}
        >
          Active
        </button>
        <button
          className={`btn ${unassigned ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12 }}
          onClick={() => { setUnassigned(v => !v); setPage(1); }}
        >
          Unassigned
        </button>
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
        {DEAL_STATUSES.map(s => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12 }}
            onClick={() => handleStatusFilter(s)}
          >
            {s}
          </button>
        ))}
        {(statusFilter || unassigned || !activeOnly) && (
          <button className="btn btn-ghost" onClick={() => { setStatusFilter(''); setUnassigned(false); setActiveOnly(true); setPage(1); }}>
            Reset
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.5 1a5.5 5.5 0 014.227 9.02l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input className="search-input" placeholder="Search deal title, company…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {mutErr && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{mutErr}</span>
          <button className="btn btn-ghost" style={{ padding: '0 6px', fontSize: 16, lineHeight: 1, color: '#dc2626' }} onClick={() => setMutErr(null)}>×</button>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 24 }}><TableSkeleton rows={8} /></div>
        ) : deals.length === 0 ? (
          <EmptyState message="No deals found" sub="Try clearing filters or create a new deal" />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Company</th><th>Amount</th><th>Status</th><th>Owner</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {deals.map((d: Deal) => {
                const stale   = isDealStale(d);
                const noOwner = isUnassigned(d);
                return (
                  <tr key={d._id} className={stale ? 'row-stale' : ''}>
                    <td className="table-company">{d.title}</td>
                    <td>
                      <div>{d.company}</div>
                      <div className="table-sub">{d.contact}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, color: `var(${STATUS_COLOR[d.status] ?? '--text-primary'})` }}>
                      {formatCurrency(d.amount)}
                    </td>
                    <td>
                      <div className="status-cell">
                        <StatusBadge domain="deal" value={d.status}>{d.status}</StatusBadge>
                        <StatusSelect
                          status={d.status}
                          options={getValidDealOptions(d.status)}
                          disabled={TERMINAL_DEAL_STATUSES.has(d.status)}
                          onChange={status => {
                            setMutErr(null);
                            mutations.update.mutate(
                              { id: d._id, data: { status: status as DealStatus } },
                              { onError: e => setMutErr(extractError(e)) },
                            );
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      {noOwner
                        ? <span className="badge badge-unassigned">unassigned</span>
                        : <span className="text-sm">{d.assignedTo}</span>
                      }
                    </td>
                    <td className="text-sm text-muted">
                      {timeAgo(d.lastTouchedAt ?? d.updatedAt)}
                      {stale && <span className="badge badge-stale" style={{ marginLeft: 6 }}>stale</span>}
                    </td>
                    <td>
                      {d.dealExecutionState && (
                        <StatusBadge
                          tone={
                            d.dealExecutionState.pressureLevel === 'critical' ? 'critical' :
                              d.dealExecutionState.pressureLevel === 'high' ? 'warning' :
                                d.dealExecutionState.pressureLevel === 'medium' ? 'info' : 'success'
                          }
                          style={{ marginRight: 6 }}
                        >
                          {d.dealExecutionState.pressureLevel}
                        </StatusBadge>
                      )}
                      {d.atRisk?.flagged && <StatusBadge tone="warning" style={{ marginRight: 8 }}>At risk</StatusBadge>}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => setExecDeal(d)}
                      >
                        Execution
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#dc2626' }}
                        onClick={() => { if (confirm('Delete deal?')) mutations.remove.mutate(d._id); }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pages} total={total} onPage={setPage} />
      </div>

      {showModal && (
        <Modal
          title="New Deal"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="deal-form" className="btn btn-primary" disabled={mutations.create.isPending}>
                {mutations.create.isPending ? 'Saving…' : 'Create Deal'}
              </button>
            </>
          }
        >
          <DealForm onSubmit={d => mutations.create.mutate(d, {
            onSuccess: () => setShowModal(false),
            onError:   e  => { setShowModal(false); setMutErr(extractError(e)); },
          })} />
        </Modal>
      )}

      {execDeal && (
        <Modal title={`Deal Execution — ${execDeal.title}`} onClose={() => setExecDeal(null)} width={980}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Execution Panel</div>
              <div style={{ fontSize: 12, marginBottom: 6 }}>Pressure: <strong>{execDeal.dealExecutionState?.pressureLevel ?? '—'}</strong></div>
              <ul style={{ margin: '0 0 8px 16px', fontSize: 12 }}>
                {(execDeal.dealExecutionState?.pressureReasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <div style={{ fontSize: 12 }}>Last Interaction: {execDeal.dealExecutionState?.lastInteractionAt ? timeAgo(execDeal.dealExecutionState.lastInteractionAt) : 'none'}</div>
              <div style={{ fontSize: 12 }}>Open Follow-ups: {execDeal.dealExecutionState?.openFollowUps ?? 0}</div>
              <div style={{ fontSize: 12 }}>Overdue Follow-ups: {execDeal.dealExecutionState?.overdueFollowUps ?? 0}</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>Next Action: {execDeal.dealExecutionState?.nextActionSummary ?? '—'}</div>
              {execDeal.forecastState && (
                <>
                  <div style={{ fontSize: 12 }}>Forecast: <strong>{execDeal.forecastState.forecastCategory}</strong> · confidence {execDeal.forecastState.confidence}</div>
                  <ul style={{ margin: '4px 0 8px 16px', fontSize: 12 }}>
                    {execDeal.forecastState.confidenceReasons.map((r, i) => <li key={`fc-${i}`}>{r}</li>)}
                  </ul>
                  {execDeal.forecastState.needsManagementReview && (
                    <ul style={{ margin: '4px 0 8px 16px', fontSize: 12 }}>
                      {execDeal.forecastState.reviewReasons.map((r, i) => <li key={`fr-${i}`}>{r}</li>)}
                    </ul>
                  )}
                </>
              )}
              {execDeal.pipelineWarnings?.length ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>Pipeline Warnings</div>
                  <ul style={{ margin: '0 0 8px 16px', fontSize: 12 }}>
                    {execDeal.pipelineWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </>
              ) : null}
              {execDeal.dealBuildFinancialSummary && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>Build Financials</div>
                  <div>Builds: {execDeal.dealBuildFinancialSummary.buildCount}</div>
                  <div>Estimated Cost: {formatCurrency(execDeal.dealBuildFinancialSummary.totalEstimatedCost)}</div>
                  <div>Estimated Sell: {formatCurrency(execDeal.dealBuildFinancialSummary.totalEstimatedSell)}</div>
                  <div>Estimated Margin: {formatCurrency(execDeal.dealBuildFinancialSummary.totalEstimatedMargin)}</div>
                  <div>
                    Economics trusted:{' '}
                    {execDeal.dealBuildFinancialSummary.hasIncompleteBuildCosting || execDeal.dealBuildFinancialSummary.hasHighMarginRiskBuilds
                      ? 'no'
                      : 'yes'}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setQuickMode('log_call')}>Log Call</button>
                <button className="btn btn-secondary" onClick={() => setQuickMode('schedule_follow_up')}>Schedule Follow-Up</button>
                <button className="btn btn-secondary" onClick={() => setQuickMode('add_note')}>Add Note</button>
                <Link className="btn btn-secondary" to={`/builds?dealId=${encodeURIComponent(execDeal._id)}`}>Create Build</Link>
                <Link className="btn btn-secondary" to={`/builds?dealId=${encodeURIComponent(execDeal._id)}&incompleteCosting=1`}>Build Financials</Link>
                <button className="btn btn-secondary" onClick={() => mutations.update.mutate({ id: execDeal._id, data: { atRisk: { flagged: true, reason: 'Manual risk flag' } } })}>Mark Deal At Risk</button>
                <button className="btn btn-ghost" onClick={() => mutations.update.mutate({ id: execDeal._id, data: { atRisk: { flagged: false } } })}>Clear Risk</button>
              </div>
            </div>
            <div>
              {!companyId ? (
                <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Could not resolve company for quick actions. Ensure company exists in Companies.
                </div>
              ) : (
                <InteractionComposer
                  companyId={companyId}
                  initialValues={{
                    relatedDealId: execDeal._id,
                    parentInteractionId: (dealInteractions as InteractionRow[])[0]?._id,
                    type: quickMode === 'add_note' ? 'note' : quickMode === 'schedule_follow_up' ? 'task' : 'call',
                    summary:
                      quickMode === 'add_note'
                        ? `Deal note: ${execDeal.title}`
                        : quickMode === 'schedule_follow_up'
                          ? `Schedule follow-up: ${execDeal.title}`
                          : `Deal call: ${execDeal.title}`,
                    followUpAt: quickMode === 'schedule_follow_up' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
                  }}
                  onSubmit={async payload => {
                    const out = await createInteraction.mutateAsync(payload);
                    return { _id: out._id };
                  }}
                />
              )}
              <div style={{ fontFamily: 'var(--font-cond)', fontSize: 13, marginBottom: 8 }}>Linked Interaction Timeline</div>
              <InteractionTimeline
                rows={(dealInteractions as InteractionRow[])}
                onSelect={() => undefined}
                empty="No linked interactions yet."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DealForm({ onSubmit }: { onSubmit: (d: CreateDealPayload) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDealPayload>({
    resolver: zodResolver(CreateDealSchema),
  });

  return (
    <form id="deal-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Deal Title *</label>
          <input {...register('title')} className={`form-input${errors.title ? ' error' : ''}`} placeholder="2025 Kenworth T680 — Acme Trucking" />
          {errors.title && <span className="form-error">{errors.title.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Company *</label>
          <input {...register('company')} className={`form-input${errors.company ? ' error' : ''}`} placeholder="Acme Trucking" />
          {errors.company && <span className="form-error">{errors.company.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Contact *</label>
          <input {...register('contact')} className={`form-input${errors.contact ? ' error' : ''}`} placeholder="John Smith" />
          {errors.contact && <span className="form-error">{errors.contact.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input {...register('amount', { valueAsNumber: true })} type="number" className="form-input" placeholder="165000" />
        </div>
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <input {...register('assignedTo')} className="form-input" placeholder="Salesperson name" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select {...register('status')} className="form-select">
            {DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group full">
          <label className="form-label">Notes</label>
          <textarea {...register('notes')} className="form-textarea" />
        </div>
      </div>
    </form>
  );
}
