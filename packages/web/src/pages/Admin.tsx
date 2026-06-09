// packages/web/src/pages/Admin.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import client from '../api/client.js';
import { Modal, EmptyState, Spinner, KPICard, VenueContextFields } from '../components/ui/index.js';
import { useAppStore } from '../store/index.js';
import {
  ROLES, CreateUserSchema, DEFAULT_ENTITY, DEFAULT_LOCATION, IS_SINGLE_VENUE,
  type Entity, type Location, type UserRole, type CreateUserPayload,
  formatCurrency, roleForDisplay, tenantForDisplay, HUB_LABELS,
  dealStatusForDisplay, leadStatusForDisplay, normalizeEntity, normalizeLocation,
} from '@hub-crm/shared';

// ── Types ─────────────────────────────────────────────────────────
type AdminUser = {
  _id: string; name: string; email: string;
  role: UserRole; entity: Entity; location: Location;
  tenantId: string; active: boolean; lastLogin?: string;
};

type Stats = {
  leadsByTenant:  Array<{ _id: string; count: number }>;
  dealsByTenant:  Array<{ _id: string; count: number; totalAmount: number }>;
  leadsByStatus:  Array<{ _id: string; count: number }>;
  dealsByStatus:  Array<{ _id: string; count: number; totalAmount: number }>;
};

// ── Admin Page ────────────────────────────────────────────────────
export default function Admin() {
  const { user: currentUser } = useAppStore();
  const [tab, setTab]            = useState<'users' | 'stats' | 'integrations'>('users');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState<AdminUser | null>(null);
  const qc = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn:  () => client.get<AdminUser[]>('/admin/users').then(r => r.data),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn:  () => client.get<Stats>('/admin/stats').then(r => r.data),
    staleTime: 60_000,
    enabled: tab === 'stats',
  });

  const { data: syncStatus = [] } = useQuery({
    queryKey: ['admin', 'sync'],
    queryFn:  () => client.get<unknown[]>('/admin/sync-status').then(r => r.data),
    enabled: tab === 'integrations',
  });

  const { data: mailchimpStatus } = useQuery({
    queryKey: ['integrations', 'mailchimp', 'status'],
    queryFn:  () => client.get<{ configured: boolean; audienceIdMasked: string | null; message: string }>('/integrations/mailchimp/status').then(r => r.data),
    enabled: tab === 'integrations',
    retry: false,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => client.delete(`/admin/users/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const create = useMutation({
    mutationFn: (d: CreateUserPayload) => client.post('/admin/users', d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setShowModal(false); setEditUser(null); },
  });

  const openCreate = () => { setEditUser(null); setShowModal(true); };
  const openEdit   = (u: AdminUser) => { setEditUser(u); setShowModal(true); };

  const byTenant: Record<string, AdminUser[]> = {};
  users.forEach(u => { (byTenant[u.tenantId] ??= []).push(u); });

  const totalPipeline = (stats?.dealsByStatus ?? [])
    .filter(s => !['Lost', 'Delivered'].includes(s._id))
    .reduce((n, s) => n + s.totalAmount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{HUB_LABELS.adminWorkspace}</h1>
          <div className="page-subtitle">Admin tools · users, stats, and integrations</div>
        </div>
        {tab === 'users' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to={ROUTES.userManagement} className="btn btn-secondary">
              HuB user roster (demo)
            </Link>
            <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {(['users', 'stats', 'integrations'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-cond)', fontSize: 15, fontWeight: 600, letterSpacing: '0.5px',
              color: tab === t ? 'var(--red)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2px solid var(--red)' : '2px solid transparent',
              marginBottom: -2, textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Users tab ────────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <KPICard label="Total Users"  value={users.length}                                                         colorVar="--status-new" />
            <KPICard label="Active"       value={users.filter(u => u.active).length}                                   colorVar="--status-approved" />
            <KPICard label="Venue"        value={IS_SINGLE_VENUE ? 1 : Object.keys(byTenant).length}                      colorVar="--status-inbuild" />
            <KPICard label="Mgmt / Admin" value={users.filter(u => ['management','admin','super_admin'].includes(u.role)).length} colorVar="--red" />
          </div>

          {usersLoading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
              <Spinner /> <span className="text-muted">Loading users…</span>
            </div>
          ) : (
            Object.entries(byTenant)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tenantId, tenantUsers]) => (
                <div key={tenantId} className="card" style={{ marginBottom: 14 }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
                    <span style={{ fontFamily: 'var(--font-cond)', fontSize: 14, fontWeight: 700, letterSpacing: '0.5px' }}>{tenantForDisplay(tenantId)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tenantUsers.length} users</span>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr>
                    </thead>
                    <tbody>
                      {tenantUsers.map(u => (
                        <tr key={u._id}>
                          <td className="table-company">{u.name}</td>
                          <td className="text-sm">{u.email}</td>
                          <td>
                            <span className={`badge ${u.role === 'management' || u.role === 'admin' || u.role === 'super_admin' ? 'badge-approved' : 'badge-inbuild'}`}>{roleForDisplay(u.role)}</span>
                          </td>
                          <td>
                            <span className={`badge ${u.active ? 'badge-new' : 'badge-lost'}`}>{u.active ? 'Active' : 'Inactive'}</span>
                          </td>
                          <td className="text-sm text-muted">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEdit(u)}>Edit</button>
                              {u._id !== currentUser?.id && u.active && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: '3px 8px', fontSize: 11, color: '#dc2626' }}
                                  disabled={deactivate.isPending}
                                  onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivate.mutate(u._id); }}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
          )}
        </>
      )}

      {/* ── Stats tab ────────────────────────────────────────── */}
      {tab === 'stats' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>Leads overview</div>
              <table className="data-table">
                <thead><tr><th>Venue</th><th>Leads</th></tr></thead>
                <tbody>{stats.leadsByTenant.map(row => (<tr key={row._id}><td className="table-company">{tenantForDisplay(row._id)}</td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600, fontSize: 16 }}>{row.count}</td></tr>))}</tbody>
              </table>
            </div>
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>
                Pipeline overview <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>{formatCurrency(totalPipeline)} active</span>
              </div>
              <table className="data-table">
                <thead><tr><th>Venue</th><th>{HUB_LABELS.opportunities}</th><th>Value</th></tr></thead>
                <tbody>{stats.dealsByTenant.map(row => (<tr key={row._id}><td className="table-company">{tenantForDisplay(row._id)}</td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600 }}>{row.count}</td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600, color: 'var(--red)' }}>{formatCurrency(row.totalAmount)}</td></tr>))}</tbody>
              </table>
            </div>
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>{HUB_LABELS.lead} pipeline</div>
              <table className="data-table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>{stats.leadsByStatus.sort((a,b) => b.count - a.count).map(row => (<tr key={row._id}><td><span className={`badge badge-${row._id.toLowerCase().replace(' ','')}`}>{leadStatusForDisplay(row._id)}</span></td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 18 }}>{row.count}</td></tr>))}</tbody>
              </table>
            </div>
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>{HUB_LABELS.opportunity} pipeline</div>
              <table className="data-table">
                <thead><tr><th>Status</th><th>Count</th><th>Value</th></tr></thead>
                <tbody>{stats.dealsByStatus.sort((a,b) => b.totalAmount - a.totalAmount).map(row => (<tr key={row._id}><td><span className={`badge badge-${row._id.toLowerCase().replace(' ','')}`}>{dealStatusForDisplay(row._id)}</span></td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 16 }}>{row.count}</td><td style={{ fontFamily: 'var(--font-cond)', fontWeight: 600, color: 'var(--red)' }}>{formatCurrency(row.totalAmount)}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Integrations tab ─────────────────────────────────── */}
      {tab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Mailchimp</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Audience sync — explicit trigger only; no blast sending in this build
                {mailchimpStatus?.audienceIdMasked ? ` · ${mailchimpStatus.audienceIdMasked}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`badge ${mailchimpStatus?.configured ? 'badge-new' : 'badge-quoted'}`}>
                {mailchimpStatus?.configured ? 'Configured' : 'Not configured'}
              </span>
              <Link to={`${ROUTES.settings}/integrations`} className="btn btn-secondary" style={{ fontSize: 12 }}>Settings</Link>
            </div>
          </div>
          {[
            { name: 'Google Calendar', description: 'Sync venue holds, tours, and event blocks',   status: 'planned' },
            { name: 'Email Ingest',    description: 'Create leads from inbound venue inquiries', status: 'stub' },
            { name: 'Excel Import',      description: 'Bulk lead import from spreadsheets',        status: 'planned' },
            { name: 'Stripe / Billing', description: 'Deposits, invoices, and payment links',     status: 'planned' },
          ].map(integration => (
            <div key={integration.name} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{integration.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{integration.description}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge ${integration.status === 'active' ? 'badge-new' : integration.status === 'stub' ? 'badge-quoted' : 'badge-lost'}`}>{integration.status}</span>
                <button className="btn btn-secondary" style={{ fontSize: 12 }} disabled={integration.status !== 'active'}>Configure</button>
              </div>
            </div>
          ))}
          {syncStatus.length > 0 && (
            <div className="card">
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-cond)', fontSize: 16, fontWeight: 700 }}>Sync History</div>
              <table className="data-table">
                <thead><tr><th>Service</th><th>Venue</th><th>Last Sync</th><th>Records</th></tr></thead>
                <tbody>
                  {(syncStatus as any[]).map((s, i) => (
                    <tr key={i}>
                      <td className="table-company">{s.service}</td>
                      <td className="text-sm">{tenantForDisplay(s.tenantId)}</td>
                      <td className="text-sm text-muted">{s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : '—'}</td>
                      <td className="text-sm">{s.customersSynced ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* User modal */}
      {showModal && (
        <Modal
          title={editUser ? `Edit User — ${editUser.name}` : 'New User'}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditUser(null); }}>Cancel</button>
              <button type="submit" form="user-form" className="btn btn-primary" disabled={create.isPending}>
                {create.isPending ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}
              </button>
            </>
          }
        >
          <UserForm existingUser={editUser} onSubmit={d => create.mutate(d)} />
        </Modal>
      )}
    </div>
  );
}

// ── UserForm ──────────────────────────────────────────────────────
function UserForm({ existingUser, onSubmit }: { existingUser: AdminUser | null; onSubmit: (d: CreateUserPayload) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUserPayload>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name:     existingUser?.name     ?? '',
      email:    existingUser?.email    ?? '',
      password: '',
      role:     existingUser?.role     ?? 'sales',
      entity:   normalizeEntity(existingUser?.entity),
      location: normalizeLocation(existingUser?.location),
    },
  });

  return (
    <form id="user-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Full Name *</label>
          <input {...register('name')} className={`form-input${errors.name ? ' error' : ''}`} placeholder="Joey R." />
          {errors.name && <span className="form-error">{errors.name.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input {...register('email')} type="email" className={`form-input${errors.email ? ' error' : ''}`} placeholder="admin@yourcompany.com" />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">{existingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <input {...register('password')} type="password" className={`form-input${errors.password ? ' error' : ''}`} placeholder="Min 8 characters" />
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select {...register('role')} className="form-select">
            {ROLES.map(r => <option key={r} value={r}>{roleForDisplay(r)}</option>)}
          </select>
        </div>
        <VenueContextFields register={register} />
      </div>
    </form>
  );
}
