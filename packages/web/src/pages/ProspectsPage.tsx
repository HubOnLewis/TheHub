import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PROSPECT_STATUSES, type ProspectStatus } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import PageIntro from '../components/layout/PageIntro.js';
import { useProspectsStore } from '../store/prospectsStore.js';

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'manual',
  status: 'new' as ProspectStatus,
  notes: '',
  tags: '',
};

export default function ProspectsPage() {
  const prospects = useProspectsStore(s => s.prospects);
  const addProspect = useProspectsStore(s => s.addProspect);
  const updateProspect = useProspectsStore(s => s.updateProspect);
  const removeProspect = useProspectsStore(s => s.removeProspect);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company.trim()) return;
    addProspect({
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source.trim() || 'manual',
      status: form.status,
      notes: form.notes.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  return (
    <div className="page-simple">
      <PageIntro
        title="Target prospects"
        subtitle="Organizations you are actively pursuing. Add real targets manually — no auto-generated list."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : 'Add prospect'}
          </button>
        }
      />
      <p className="page-crosslink">
        <Link to={ROUTES.leads}>← Back to leads</Link>
      </p>

      {showForm && (
        <form className="card page-section prospects-form" onSubmit={handleAdd}>
          <h2 className="page-section__title">New prospect</h2>
          <div className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <input className="form-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProspectStatus }))}>
                {PROSPECT_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>Save</button>
        </form>
      )}

      <div className="card page-section">
        <h2 className="page-section__title">{prospects.length} prospect{prospects.length === 1 ? '' : 's'}</h2>
        {prospects.length === 0 ? (
          <p className="empty-hint">No prospects yet. Start with organizations you want to pursue this quarter.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.company}</td>
                  <td className="text-sm">{p.email || '—'}</td>
                  <td>
                    <select className="form-select form-select--compact" value={p.status} onChange={e => updateProspect(p.id, { status: e.target.value as ProspectStatus })}>
                      {PROSPECT_STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeProspect(p.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
