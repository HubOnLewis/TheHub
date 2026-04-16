// packages/web/src/pages/Units.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUnits, useUnitSummary, useUnitMutations } from '../hooks/useUnits';
import { Modal, StatusSelect, EmptyState, Spinner, Pagination } from '../components/ui/index';
import { useAppStore } from '../store/index';
import {
  CreateUnitSchema, UNIT_STATUSES, ENTITIES, LOCATIONS,
  type CreateUnitPayload, type UnitStatus, formatCurrency, timeAgo,
} from '@mtte-core/shared';

type Unit = { _id: string; vin: string; stockNumber: string; year: number; make: string; model: string; spec: string; color: string; status: UnitStatus; entity: string; location: string; msrp: number; dealId: string | null; notes: string; updatedAt: string };

const STATUS_COLORS: Record<string, string> = {
  Available: '--status-new', Reserved: '--status-contacted', 'In Build': '--status-inbuild',
  Delivered: '--red', Demo: '--status-quoted',
};

export default function Units() {
  const { user } = useAppStore();
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(1);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [showModal,    setShowModal]    = useState(false);

  const { data, isLoading } = useUnits({
    search:  search  || undefined,
    status:  statusFilter || undefined,
    page, limit: 25, sort: 'createdAt', order: 'desc',
  });

  const { data: summary } = useUnitSummary();
  const mutations = useUnitMutations();

  const units    = (data as any)?.data  ?? [];
  const total    = (data as any)?.total ?? 0;
  const pages    = (data as any)?.pages ?? 1;
  const selected = units.find((u: Unit) => u._id === selectedId) ?? null;

  const summaryMap = Object.fromEntries(
    ((summary ?? []) as Array<{ _id: string; count: number; totalMsrp: number }>).map(s => [s._id, s])
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Units <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-secondary)' }}>/ Inventory</span></h1>
          <div className="page-subtitle">{total} units tracked</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Unit</button>
      </div>

      {/* Status summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {UNIT_STATUSES.map(s => {
          const d   = summaryMap[s];
          const col = STATUS_COLORS[s] ?? '--text-primary';
          return (
            <div
              key={s}
              className="card"
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderTop: `3px solid var(${col})`,
                border: statusFilter === s ? `2px solid var(${col})` : undefined,
              }}
              onClick={() => setStatusFilter(f => f === s ? '' : s)}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: 4 }}>{s}</div>
              <div style={{ fontFamily: 'var(--font-cond)', fontSize: 28, fontWeight: 800, color: `var(${col})` }}>{d?.count ?? 0}</div>
              {d?.totalMsrp ? <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{formatCurrency(d.totalMsrp)}</div> : null}
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-wrap">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6.5 1a5.5 5.5 0 014.227 9.02l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input className="search-input" placeholder="Search VIN, stock #, model…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {UNIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>}
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}><Spinner /><span className="text-muted">Loading…</span></div>
        ) : units.length === 0 ? (
          <EmptyState message="No units found" sub="Add your first unit to start tracking inventory" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>VIN / Stock #</th>
                <th>Unit</th>
                <th>Spec</th>
                <th>Status</th>
                <th>Location</th>
                <th>MSRP</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u: Unit) => (
                <tr key={u._id} className={selectedId === u._id ? 'selected' : ''} onClick={() => setSelectedId(id => id === u._id ? null : u._id)}>
                  <td>
                    <div className="table-num" style={{ fontSize: 11, letterSpacing: '0.5px' }}>{u.vin}</div>
                    <div className="table-sub">{u.stockNumber}</div>
                  </td>
                  <td>
                    <div className="table-company">{u.year} {u.make} {u.model}</div>
                    {u.color && <div className="table-sub">{u.color}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.spec || '—'}
                    </div>
                  </td>
                  <td>
                    <StatusSelect
                      status={u.status}
                      options={UNIT_STATUSES}
                      onChange={status => mutations.setStatus.mutate({ id: u._id, status: status as UnitStatus })}
                    />
                  </td>
                  <td className="text-sm text-muted">{u.location}</td>
                  <td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600 }}>{u.msrp ? formatCurrency(u.msrp) : '—'}</td>
                  <td className="text-sm text-muted">{timeAgo(u.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pages} total={total} onPage={setPage} />
      </div>

      {/* Create modal */}
      {showModal && (
        <Modal
          title="Add Unit"
          onClose={() => setShowModal(false)}
          width={620}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="unit-form" className="btn btn-primary" disabled={mutations.create.isPending}>
                {mutations.create.isPending ? 'Saving…' : 'Add Unit'}
              </button>
            </>
          }
        >
          <UnitForm
            defaultEntity={user?.entity}
            defaultLocation={user?.location}
            onSubmit={d => mutations.create.mutate(d, { onSuccess: () => setShowModal(false) })}
          />
        </Modal>
      )}
    </div>
  );
}

function UnitForm({ defaultEntity, defaultLocation, onSubmit }: {
  defaultEntity?: string; defaultLocation?: string; onSubmit: (d: CreateUnitPayload) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUnitPayload>({
    resolver: zodResolver(CreateUnitSchema),
    defaultValues: {
      year: new Date().getFullYear(), make: 'Kenworth',
      entity: (defaultEntity as never) ?? 'MTTE',
      location: (defaultLocation as never) ?? 'Wichita',
    },
  });

  return (
    <form id="unit-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">VIN * (17 chars)</label>
          <input {...register('vin')} className={`form-input${errors.vin ? ' error' : ''}`}
            placeholder="1FD6W3GT2SED12345" style={{ fontFamily: 'monospace', letterSpacing: '1px' }} />
          {errors.vin && <span className="form-error">{errors.vin.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Stock Number *</label>
          <input {...register('stockNumber')} className={`form-input${errors.stockNumber ? ' error' : ''}`} placeholder="WKI-2025-041" />
          {errors.stockNumber && <span className="form-error">{errors.stockNumber.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Year *</label>
          <input {...register('year', { valueAsNumber: true })} type="number" className="form-input" />
        </div>
        <div className="form-group">
          <label className="form-label">Make *</label>
          <input {...register('make')} className="form-input" placeholder="Kenworth" />
        </div>
        <div className="form-group">
          <label className="form-label">Model *</label>
          <input {...register('model')} className="form-input" placeholder="T680" />
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <input {...register('color')} className="form-input" placeholder="White" />
        </div>
        <div className="form-group">
          <label className="form-label">Entity</label>
          <select {...register('entity')} className="form-select">
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Location</label>
          <select {...register('location')} className="form-select">
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">MSRP</label>
          <input {...register('msrp', { valueAsNumber: true })} type="number" className="form-input" placeholder="165000" />
        </div>
        <div className="form-group full">
          <label className="form-label">Spec / Equipment</label>
          <textarea {...register('spec')} className="form-textarea" placeholder="192&quot; Service Body, Air Compressor, Welder, Lighting Package, Pintle Hitch" />
        </div>
        <div className="form-group full">
          <label className="form-label">Notes</label>
          <textarea {...register('notes')} className="form-textarea" />
        </div>
      </div>
    </form>
  );
}
