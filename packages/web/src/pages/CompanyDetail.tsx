// packages/web/src/pages/CompanyDetail.tsx
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCompany, useCompanySummary } from '../hooks/useCompanies.js';
import {
  useCompanyInteractions, useCreateInteraction, type InteractionRow,
} from '../hooks/useInteractions.js';
import { useDeals, useDealMutations } from '../hooks/useDeals.js';
import { useAccountPlanMutations } from '../hooks/useAccountExpansion.js';
import { useAppStore } from '../store/index.js';
import { Modal, EmptyState, Spinner, Pagination } from '../components/ui/index.js';
import client from '../api/client.js';
import InteractionComposer from '../components/InteractionComposer.js';
import InteractionTimeline from '../components/InteractionTimeline.js';
import InteractionDetailPanel from '../components/InteractionDetailPanel.js';
import AccountSidebar   from '../components/AccountSidebar.js';
import { timeAgo, CreateDealSchema, type CreateDealPayload, HUB_LABELS } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';

type DealRow = { _id: string; company?: string; title: string; status: string; amount?: number };

export default function CompanyDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user }  = useAppStore();
  const [actPage, setActPage]   = useState(1);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(searchParams.get('plan') === '1');
  const [showQuickBuildModal, setShowQuickBuildModal] = useState(false);
  const [quickBuildName, setQuickBuildName] = useState('');
  const [quickBuildSpec, setQuickBuildSpec] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    ownerUserId: '',
    hasFollowUp: '',
    q: '',
  });
  const selectedId = searchParams.get('interactionId');
  const composeOpen = searchParams.get('compose') === '1';

  const { data: company,        isLoading: companyLoading }  = useCompany(id!);
  const { data: interactionsData, isLoading: intLoading }  = useCompanyInteractions(id!, actPage, 20, {
    type: filters.type || undefined,
    status: filters.status || undefined,
    ownerUserId: filters.ownerUserId || undefined,
    hasFollowUp: filters.hasFollowUp === '' ? undefined : filters.hasFollowUp === '1',
    q: filters.q || undefined,
  });
  const { data: summary,        isLoading: summaryLoading }  = useCompanySummary(id!);
  const createInteraction = useCreateInteraction(id!);
  const accountPlanMutations = useAccountPlanMutations(id);

  const companyName = (company as { name?: string } | undefined)?.name ?? '';
  const { data: dealsData } = useDeals({ search: companyName, limit: 50 });
  const allDeals: DealRow[] = (dealsData as { data?: DealRow[] } | undefined)?.data ?? [];
  const companyDeals = allDeals.filter(
    d => d.company?.toLowerCase() === companyName.toLowerCase(),
  );
  const dealMap = new Map(companyDeals.map(d => [d._id, d.title] as [string, string]));

  const { create: createDeal } = useDealMutations();
  const dealForm = useForm<CreateDealPayload>({
    resolver: zodResolver(CreateDealSchema),
    defaultValues: { company: companyName, status: 'Draft', amount: 0 },
  });

  const rows   = interactionsData?.data  ?? [];
  const intTotal = interactionsData?.total ?? 0;
  const intPages = interactionsData?.pages ?? 1;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  if (companyLoading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
        <Spinner /><span className="text-muted">Loading…</span>
      </div>
    );
  }
  if (!company) {
    return <EmptyState message="Account not found" sub="It may have been removed or you may not have access." />;
  }

  const c = company as { name: string; isStub?: boolean; source: string; address?: { street?: string; city?: string; state?: string; postalCode?: string }; phone?: string; daysSinceLastContact?: number; createdAt: string };

  const handleNewDeal = async (data: CreateDealPayload) => {
    await createDeal.mutateAsync(data);
    setShowDealModal(false);
    dealForm.reset({ company: companyName, status: 'Draft', amount: 0 });
  };

  const defaultPlanText = (arr?: string[]) => (arr ?? []).join('\n');

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 0', color: 'var(--text-secondary)' }}
          onClick={() => navigate(ROUTES.accounts)}
        >
          ← {HUB_LABELS.accounts}
        </button>
      </div>

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

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <KpiChip label="Last Contact" value={c.daysSinceLastContact != null ? `${c.daysSinceLastContact}d ago` : '—'} />
            <KpiChip label="Interactions" value={String(intTotal)} />
            <KpiChip label="Added" value={timeAgo(c.createdAt)} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set('compose', '1');
                  setSearchParams(p, { replace: true });
                }}
              >
                + Log interaction
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickBuildModal(true)}>
                + Create proposal
              </button>
            </div>
          </div>
          {composeOpen && (
            <>
              <div style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete('compose');
                    setSearchParams(p, { replace: true });
                  }}
                >
                  Close composer
                </button>
              </div>
              <InteractionComposer
                companyId={id!}
                deals={companyDeals.map(d => ({ _id: d._id, title: d.title, status: d.status }))}
                onSubmit={async (payload) => {
                  const data = await createInteraction.mutateAsync(payload);
                  return { _id: data._id };
                }}
                onSaved={() => {
                  const p = new URLSearchParams(searchParams);
                  p.delete('compose');
                  setSearchParams(p, { replace: true });
                }}
              />
            </>
          )}

          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Timeline · {intTotal}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
            <select className="form-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All types</option>
              <option value="call">call</option><option value="text">text</option><option value="email">email</option>
              <option value="meeting">meeting</option><option value="note">note</option><option value="task">task</option><option value="visit">visit</option>
            </select>
            <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All status</option><option value="open">open</option><option value="completed">completed</option>
            </select>
            <select className="form-select" value={filters.hasFollowUp} onChange={e => setFilters(f => ({ ...f, hasFollowUp: e.target.value }))}>
              <option value="">Follow-up any</option><option value="1">Has follow-up</option><option value="0">No follow-up</option>
            </select>
            <input className="form-input" value={filters.ownerUserId} onChange={e => setFilters(f => ({ ...f, ownerUserId: e.target.value }))} placeholder="Owner user ID" />
            <input className="form-input" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search summary/body" />
          </div>

          {intLoading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
              <Spinner /><span className="text-muted">Loading…</span>
            </div>
          ) : (
            <>
              <InteractionTimeline
                rows={rows}
                onSelect={(r: InteractionRow) => {
                  const p = new URLSearchParams(searchParams);
                  p.set('interactionId', r._id);
                  setSearchParams(p, { replace: true });
                }}
                empty="No interactions yet. Log the first one above."
              />
              {intPages > 1 && (
                <div style={{ marginTop: 14 }}>
                  <Pagination page={actPage} pages={intPages} total={intTotal} onPage={setActPage} />
                </div>
              )}
            </>
          )}
        </div>

        <AccountSidebar
          summary={summary}
          deals={companyDeals}
          loading={summaryLoading}
          onEditPlan={() => setShowPlanModal(true)}
          onNewDeal={() => {
            dealForm.reset({ company: companyName, status: 'Draft', amount: 0 });
            setShowDealModal(true);
          }}
        />
      </div>

      {showPlanModal && (
        <Modal title="Account Plan" onClose={() => {
          setShowPlanModal(false);
          const p = new URLSearchParams(searchParams);
          p.delete('plan');
          setSearchParams(p, { replace: true });
        }} width={760}>
          <AccountPlanForm
            companyId={id!}
            companyName={companyName}
            ownerUserId={summary?.accountPenetrationState?.assignedOwnerUserId}
            ownerName={summary?.accountPenetrationState?.assignedOwnerName}
            initial={summary?.accountPlan ?? null}
            onSave={async payload => {
              if (summary?.accountPlan?._id) {
                await accountPlanMutations.update.mutateAsync({ id: summary.accountPlan._id, payload });
              } else {
                await accountPlanMutations.create.mutateAsync({
                  companyId: id!,
                  companyName,
                  ownerUserId: summary?.accountPenetrationState?.assignedOwnerUserId,
                  ownerName: summary?.accountPenetrationState?.assignedOwnerName,
                  status: 'draft',
                  objectives: [],
                  opportunities: [],
                  risks: [],
                  nextSteps: [],
                  ...payload,
                });
              }
              setShowPlanModal(false);
            }}
            defaultPlanText={defaultPlanText}
          />
        </Modal>
      )}

      {showQuickBuildModal && (
        <Modal title="Quick proposal" onClose={() => setShowQuickBuildModal(false)} width={700}>
          <form onSubmit={async e => {
            e.preventDefault();
            await client.post(`/companies/${id}/builds`, {
              name: quickBuildName || undefined,
              status: 'draft',
              specItems: quickBuildSpec
                .split('\n')
                .map(x => x.trim())
                .filter(Boolean)
                .map((line: string) => {
                  const [category, description, qty, unitCost, unitSell, partNumber, vendorName] = line.split('|');
                  return {
                    category: category || 'misc',
                    description: description || line,
                    quantity: Math.max(1, Number(qty || '1')),
                    unitCostEstimate: unitCost ? Number(unitCost) : undefined,
                    unitSellPrice: unitSell ? Number(unitSell) : undefined,
                    partNumber: partNumber || undefined,
                    vendorName: vendorName || undefined,
                    costSource: 'manual',
                    pricingSource: 'manual',
                    isStandard: false,
                  };
                }),
              unit: { make: 'Unknown', model: 'TBD' },
            });
            setShowQuickBuildModal(false);
            setQuickBuildName('');
            setQuickBuildSpec('');
          }}>
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">{HUB_LABELS.proposal} name</label>
                <input className="form-input" value={quickBuildName} onChange={e => setQuickBuildName(e.target.value)} placeholder="Summit logistics package" />
              </div>
              <div className="form-group full">
                <label className="form-label">{HUB_LABELS.requirements} lines (category|description|qty|unitCost|unitSell|partNumber|vendor)</label>
                <textarea className="form-textarea" rows={6} value={quickBuildSpec} onChange={e => setQuickBuildSpec(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
              <button type="submit" className="btn btn-primary">Create {HUB_LABELS.proposal.toLowerCase()}</button>
            </div>
          </form>
        </Modal>
      )}

      {showDealModal && (
        <Modal title="New opportunity" onClose={() => setShowDealModal(false)} width={580}>
          <form onSubmit={dealForm.handleSubmit(handleNewDeal)}>
            <div className="form-grid">
              <div className="form-group full">
                <label className="form-label">Opportunity title *</label>
                <input className={`form-input${dealForm.formState.errors.title ? ' error' : ''}`} {...dealForm.register('title')} placeholder="e.g. Q3 client summit — logistics" />
                {dealForm.formState.errors.title && <span className="form-error">{dealForm.formState.errors.title.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Account</label>
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
                {createDeal.isPending ? 'Creating…' : 'Create opportunity'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <InteractionDetailPanel
        id={selectedId}
        onClose={() => {
          const p = new URLSearchParams(searchParams);
          p.delete('interactionId');
          setSearchParams(p, { replace: true });
        }}
        currentUserId={user?.id ?? ''}
        isAdmin={!!isAdmin}
        companyId={id!}
        companyName={c.name}
        dealTitles={dealMap}
      />
    </div>
  );
}

function AccountPlanForm({
  companyId,
  companyName,
  ownerUserId,
  ownerName,
  initial,
  onSave,
  defaultPlanText,
}: {
  companyId: string;
  companyName: string;
  ownerUserId?: string;
  ownerName?: string;
  initial: {
    _id: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    objectives: string[];
    opportunities: string[];
    risks: string[];
    nextSteps: string[];
  } | null;
  onSave: (payload: {
    companyId?: string;
    companyName?: string;
    ownerUserId?: string;
    ownerName?: string;
    status?: 'draft' | 'active' | 'paused' | 'completed';
    objectives?: string[];
    opportunities?: string[];
    risks?: string[];
    nextSteps?: string[];
  }) => Promise<void>;
  defaultPlanText: (arr?: string[]) => string;
}) {
  const [status, setStatus] = useState<'draft' | 'active' | 'paused' | 'completed'>(initial?.status ?? 'draft');
  const [objectives, setObjectives] = useState(defaultPlanText(initial?.objectives));
  const [opportunities, setOpportunities] = useState(defaultPlanText(initial?.opportunities));
  const [risks, setRisks] = useState(defaultPlanText(initial?.risks));
  const [nextSteps, setNextSteps] = useState(defaultPlanText(initial?.nextSteps));

  const toList = (v: string) => v.split('\n').map(x => x.trim()).filter(Boolean);

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        await onSave({
          companyId,
          companyName,
          ownerUserId,
          ownerName,
          status,
          objectives: toList(objectives),
          opportunities: toList(opportunities),
          risks: toList(risks),
          nextSteps: toList(nextSteps),
        });
      }}
    >
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value as any)}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
        </div>
        <div className="form-group full">
          <label className="form-label">Objectives (one per line)</label>
          <textarea className="form-textarea" rows={4} value={objectives} onChange={e => setObjectives(e.target.value)} />
        </div>
        <div className="form-group full">
          <label className="form-label">Opportunities (one per line)</label>
          <textarea className="form-textarea" rows={4} value={opportunities} onChange={e => setOpportunities(e.target.value)} />
        </div>
        <div className="form-group full">
          <label className="form-label">Risks (one per line)</label>
          <textarea className="form-textarea" rows={4} value={risks} onChange={e => setRisks(e.target.value)} />
        </div>
        <div className="form-group full">
          <label className="form-label">Next Steps (one per line)</label>
          <textarea className="form-textarea" rows={4} value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
        </div>
      </div>
      <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
        <button type="submit" className="btn btn-primary">{initial ? 'Update Plan' : 'Create Plan'}</button>
      </div>
    </form>
  );
}

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
