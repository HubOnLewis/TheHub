import { HUB_PUBLIC_CONTACT_EMAIL, HUB_TEAM_ACCESS } from '@hub-crm/shared';

export default function TeamAccessPanel() {
  return (
    <div className="settings-deep">
      <p className="settings-lede">
        Typed access configuration for demo and future auth. Public contact:{' '}
        <a href={`mailto:${HUB_PUBLIC_CONTACT_EMAIL}`}>{HUB_PUBLIC_CONTACT_EMAIL}</a>
      </p>
      <table className="data-table settings-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Access</th>
            <th>CRM role</th>
            <th>Login</th>
          </tr>
        </thead>
        <tbody>
          {HUB_TEAM_ACCESS.map(m => (
            <tr key={m.email}>
              <td>{m.name}</td>
              <td className="text-sm">{m.email}</td>
              <td>
                <span className={`badge ${m.accessLevel === 'admin' ? 'badge-new' : 'badge-quoted'}`}>
                  {m.accessLevel}
                </span>
              </td>
              <td className="text-sm">{m.crmRole ?? '—'}</td>
              <td className="text-sm">{m.isLoginUser ? 'Yes' : 'No (shared inbox)'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="settings-muted" style={{ marginTop: 12 }}>
        Admin notification emails route to Hannah, Jason, and Jaden unless architecture requires separate fields.
      </p>
    </div>
  );
}
