import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import ClientReviewBanner from '../components/ClientReviewBanner.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import { DEMO_MANAGED_USERS, type DemoManagedUser, type DemoUserStatus } from '../data/demoUsers.js';
import { useAppStore } from '../store/index.js';
import { logAudit } from '../audit/logAudit.js';

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

export default function UserManagement({ embedded = false }: { embedded?: boolean }) {
  const actorName = useAppStore(s => s.user?.name ?? 'Admin');
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
                <td>
                  <strong>{u.name}</strong>
                </td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <span className={statusClass(u.status)}>{u.status}</span>
                </td>
                <td>{u.lastLogin}</td>
                <td className="um-perms">{u.permissionsSummary}</td>
                <td>
                  <div className="um-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        simulate(`Edit role · ${u.name}`, {
                          action: 'role_changed',
                          userId: u.id,
                          userName: u.name,
                        })
                      }
                    >
                      Edit role
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => simulate('Permissions')}>
                      View permissions
                    </button>
                    {u.status !== 'disabled' ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setUsers(prev =>
                            prev.map(x => (x.id === u.id ? { ...x, status: 'disabled' as const } : x)),
                          );
                          simulate(`Disabled · ${u.name}`);
                        }}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setUsers(prev =>
                            prev.map(x => (x.id === u.id ? { ...x, status: 'active' as const } : x)),
                          );
                          notify(`${u.name} re-enabled.`);
                        }}
                      >
                        Enable
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => simulate('Reset invite')}>
                      Reset invite
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
