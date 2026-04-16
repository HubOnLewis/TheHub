// packages/web/src/pages/Leads.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLeads, useLeadMutations } from '../hooks/useLeads.js';
import { Modal, StatusSelect, EmptyState, Spinner, Pagination } from '../components/ui/index.js';
import { CompanySearchInput } from '../components/CompanySearchInput.js';
import {
  CreateLeadSchema, LEAD_STATUSES,
  type CreateLeadPayload, type LeadStatus,
  timeAgo,
} from '@mtte-core/shared';

type Lead = {
  _id: string; company: string; contact: string; email?: string; phone?: string;
  source?: string; notes?: string; assignedTo?: string; status: LeadStatus;
  tenantId: string; createdAt: string; updatedAt: string; lastTouchedAt?: string;
};

// Stale thresholds per workflow spec (days since lastTouchedAt, fallback to updatedAt)
const STALE_DAYS: Partial<Record<LeadStatus, number>> = {
  New: 1, Contacted: 3, Working: 5, Quoted: 7,
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
}

function isLeadStale(lead: Lead): boolean {
  const threshold = STALE_DAYS[lead.status];
  const clock = lead.lastTouchedAt ?? lead.updatedAt;
  return threshold !== undefined && daysSince(clock) >= threshold;
}

function isUnassigned(lead: Lead): boolean {
  return !lead.assignedTo?.trim();
}

// Terminal lead statuses — set by system or admin, no further workflow movement
const TERMINAL_LEAD_STATUSES = new Set<LeadStatus>(['Converted', 'Lost']);

/** Pulls the user-facing message out of an axios error response */
function extractError(err: unknown): string {
  const e = err as any;
  return e?.response?.data?.error ?? e?.message ?? 'An error occurred';
}

export default function Leads() {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeOnly,   setActiveOnly]   = useState(true);
  const [unassigned,   setUnassigned]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [showModal,    setShowModal]    = useState(false);
  const [selected,     setSelected]     = useState<Lead | null>(null);
  const [mutErr,       setMutErr]       = useState<string | null>(null);

  const params = {
    search:     search || undefined,
    status:     statusFilter || undefined,
    active:     !statusFilter && activeOnly ? true : undefined,
    assignedTo: unassigned ? '__unassigned__' : undefined,
    page,
    limit:      25,
    sort:       'updatedAt',
    // Oldest-first surfaces stale records naturally; flip when a specific status is chosen
    order:      'asc' as const,
  };

  const { data, isLoading } = useLeads(params);
  const mutations = useLeadMutations();

  const leads = (data as any)?.data  ?? [];
  const total = (data as any)?.total ?? 0;
  const pages = (data as any)?.pages ?? 1;

  function handleStatusFilter(s: string) {
    setStatusFilter(f => f === s ? '' : s);
    setActiveOnly(false); // specific status chosen — disable active-only
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
          <h1 className="page-title">Leads</h1>
          <div className="page-subtitle">{total} leads</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Lead</button>
      </div>

      {/* Filter strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Quick-view toggles */}
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
        {/* Individual status buttons */}
        {LEAD_STATUSES.map(s => (
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

      {/* Search */}
      <div className="filter-bar">
        <div className="search-wrap">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.5 1a5.5 5.5 0 014.227 9.02l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input className="search-input" placeholder="Search company, contact…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}><Spinner /><span className="text-muted">Loading…</span></div>
        ) : leads.length === 0 ? (
          <EmptyState message="No leads found" sub="Try clearing filters or create a new lead" />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Company</th><th>Contact</th><th>Status</th><th>Owner</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {leads.map((l: Lead) => {
                const stale  = isLeadStale(l);
                const noOwner = isUnassigned(l);
                return (
                  <tr
                    key={l._id}
                    className={`${selected?._id === l._id ? 'selected' : ''} ${stale ? 'row-stale' : ''}`}
                    onClick={() => setSelected(s => s?._id === l._id ? null : l)}
                  >
                    <td className="table-company">{l.company}</td>
                    <td>
                      <div>{l.contact}</div>
                      {l.email && <div className="table-sub">{l.email}</div>}
                    </td>
                    <td>
                      <StatusSelect
                        status={l.status}
                        options={LEAD_STATUSES}
                        disabled={TERMINAL_LEAD_STATUSES.has(l.status)}
                        onChange={status => {
                          setMutErr(null);
                          mutations.update.mutate(
                            { id: l._id, data: { status: status as LeadStatus } },
                            { onError: e => setMutErr(extractError(e)) },
                          );
                        }}
                      />
                    </td>
                    <td>
                      {noOwner
                        ? <span className="badge badge-unassigned">unassigned</span>
                        : <span className="text-sm">{l.assignedTo}</span>
                      }
                    </td>
                    <td className="text-sm text-muted">
                      {timeAgo(l.lastTouchedAt ?? l.updatedAt)}
                      {stale && <span className="badge badge-stale" style={{ marginLeft: 6 }}>stale</span>}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#dc2626' }}
                        onClick={e => { e.stopPropagation(); if (confirm('Delete lead?')) mutations.remove.mutate(l._id); }}
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
          title="New Lead"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="lead-form" className="btn btn-primary" disabled={mutations.create.isPending}>
                {mutations.create.isPending ? 'Saving…' : 'Create Lead'}
              </button>
            </>
          }
        >
          <LeadForm onSubmit={d => mutations.create.mutate(d, {
            onSuccess: () => setShowModal(false),
            onError:   e  => { setShowModal(false); setMutErr(extractError(e)); },
          })} />
        </Modal>
      )}
    </div>
  );
}

function LeadForm({ onSubmit }: { onSubmit: (d: CreateLeadPayload) => void }) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CreateLeadPayload>({
    resolver: zodResolver(CreateLeadSchema),
  });

  return (
    <form id="lead-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Search Existing Company</label>
          <CompanySearchInput
            onSelect={name => setValue('company', name)}
            placeholder="Type to search imported companies…"
          />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Select to pre-fill the company name below
          </div>
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
          <label className="form-label">Email</label>
          <input {...register('email')} type="email" className="form-input" placeholder="john@acme.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input {...register('phone')} className="form-input" placeholder="(316) 555-0100" />
        </div>
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <input {...register('assignedTo')} className="form-input" placeholder="Salesperson name" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select {...register('status')} className="form-select">
            {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Source</label>
          <input {...register('source')} className="form-input" placeholder="Walk-in, Referral, Website…" />
        </div>
        <div className="form-group full">
          <label className="form-label">Notes</label>
          <textarea {...register('notes')} className="form-textarea" placeholder="Interested in T680 spec…" />
        </div>
      </div>
    </form>
  );
}
