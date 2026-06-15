import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '../config/paths.js';
import { roleForDisplay } from '@hub-crm/shared';
import ClientReviewBanner from '../components/ClientReviewBanner.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import LiveEmptyState from '../components/live/LiveEmptyState.js';
import { Spinner } from '../components/ui/index.js';
import { isProductionCRM } from '../config/productionData.js';
import client from '../api/client.js';
import { DEMO_MANAGED_USERS, type DemoManagedUser, type DemoUserStatus } from '../data/demoUsers.js';
import { logAudit } from '../audit/logAudit.js';

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin?: string;
};

function statusClass(s: DemoUserStatus): string {
  switch (s) {
    case 'active':
      return 'um-status um-status--active';
    case 'invited':
      return 'um-status um-status--invited';
    case 'disabled':
      return 'um-status um-status--disabled';
    default:
      return 'um-status';
  }
}

function UserManagementDemo({ embedded = false }: { embedded?: boolean }) {
  const [users, setUsers] = useState<DemoManagedUser[]>(() => [...DEMO_MANAGED_USERS]);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const simulate = (label: string, audit?: { action: 'user_invited' | 'role_changed'; userId: string; userName: string }) => {
    notify(`${label} — recorded locally with audit trail.`);
    if (audit) {
      logAudit({
        action: audit.action,
        entityType: 'user',
        entityId: audit.userId,
        entityName: audit.userName,
        afterSummary: label,
        visibleToClientReview: true,
      });
    }
  };

  return (
    <div className={`user-mgmt-page${embedded ? ' user-mgmt-page--embedded' : ''}`}>
      {!embedded && <DemoFlowNav />}
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">User management</h1>
            <p className="page-subtitle">HuB on Lewis team · roles, access, and invites</p>
          </div>
          <Link to={ROUTES.settings} className="btn btn-secondary">
            Venue settings
          </Link>
        </div>
      )}
      {embedded ? null : <ClientReviewBanner variant="full" />}
      {toast && <div className="um-toast">{toast}</div>}
      <div className="um-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            simulate('Invite sent', { action: 'user_invited', userId: 'invite-pending', userName: 'New team member' })
          }
        >
          Invite user
        </button>
        <span className="um-toolbar__hint">
          Invites and role changes are recorded in the audit trail. Email delivery is not enabled yet.
        </span>
      </div>
      <div className="um-table-wrap card">
        <table className="data-table um-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><span className={statusClass(u.status)}>{u.status}</span></td>
                <td>{u.lastLogin}</td>
                <td className="um-perms">{u.permissionsSummary}</td>
                <td>
                  <div className="um-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => simulate(`Edit role · ${u.name}`, { action: 'role_changed', userId: u.id, userName: u.name })}>
                      Edit role
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserManagementLive({ embedded = false }: { embedded?: boolean }) {
  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => client.get<AdminUser[]>('/admin/users').then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });

  return (
    <div className={`user-mgmt-page${embedded ? ' user-mgmt-page--embedded' : ''}`}>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">User management</h1>
            <p className="page-subtitle">HuB on Lewis team · roles and access from CRM</p>
          </div>
          <Link to={ROUTES.admin} className="btn btn-secondary">
            Admin workspace
          </Link>
        </div>
      )}
      <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
        Live users from MongoDB. Create and edit users in Admin workspace.
      </p>
      <div className="um-table-wrap card">
        {isLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <Spinner /> <span className="text-muted">Loading users…</span>
          </div>
        ) : isError ? (
          <div style={{ padding: 24 }}>
            <LiveEmptyState hint="Could not load users from the API." />
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 24 }}>
            <LiveEmptyState />
          </div>
        ) : (
          <table className="data-table um-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>{roleForDisplay(u.role)}</td>
                  <td>
                    <span className={`um-status${u.active ? ' um-status--active' : ' um-status--disabled'}`}>
                      {u.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function UserManagement({ embedded = false }: { embedded?: boolean }) {
  if (isProductionCRM()) return <UserManagementLive embedded={embedded} />;
  return <UserManagementDemo embedded={embedded} />;
}