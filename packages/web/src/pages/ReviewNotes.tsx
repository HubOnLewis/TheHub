import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import ClientReviewBanner from '../components/ClientReviewBanner.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import { useAppStore } from '../store/index.js';
import {
  addReviewNote,
  formatReviewDate,
  loadReviewNotes,
  updateReviewNoteStatus,
  type ReviewNote,
  type ReviewNotePriority,
  type ReviewNoteStatus,
} from '../data/reviewNotesStorage.js';
import { logAudit } from '../audit/logAudit.js';

const STATUSES: ReviewNoteStatus[] = ['New', 'Reviewing', 'Planned', 'Done'];
const PRIORITIES: ReviewNotePriority[] = ['low', 'medium', 'high'];

export default function ReviewNotes({ embedded = false }: { embedded?: boolean }) {
  const userName = useAppStore(s => s.user?.name ?? 'Team member');
  const [notes, setNotes] = useState<ReviewNote[]>(() => loadReviewNotes());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    area: '',
    priority: 'medium' as ReviewNotePriority,
    comment: '',
  });

  const byStatus = useMemo(() => {
    const m: Record<ReviewNoteStatus, ReviewNote[]> = { New: [], Reviewing: [], Planned: [], Done: [] };
    notes.forEach(n => m[n.status].push(n));
    return m;
  }, [notes]);

  const refresh = () => setNotes(loadReviewNotes());

  const changeStatus = (note: ReviewNote, next: ReviewNoteStatus) => {
    updateReviewNoteStatus(note.id, next);
    logAudit({
      action: 'status_changed',
      entityType: 'review_note',
      entityId: note.id,
      entityName: note.title,
      beforeSummary: note.status,
      afterSummary: `${next} · status changed by ${userName}`,
      visibleToClientReview: true,
    });
    refresh();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const note = addReviewNote({
      title: form.title.trim(),
      submittedBy: userName,
      area: form.area.trim() || 'General',
      priority: form.priority,
      comment: form.comment.trim(),
    });
    logAudit({
      action: 'created',
      entityType: 'review_note',
      entityId: note.id,
      entityName: note.title,
      afterSummary: `Submitted by ${userName}`,
      visibleToClientReview: true,
    });
    setForm({ title: '', area: '', priority: 'medium', comment: '' });
    setShowForm(false);
    refresh();
  };

  return (
    <div className={`review-notes-page${embedded ? ' review-notes-page--embedded' : ''}`}>
      {!embedded && <DemoFlowNav />}
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">Review notes</h1>
            <p className="page-subtitle">Suggested edits from Jason & Hannah — guides the next build pass</p>
          </div>
          <Link to={ROUTES.settings} className="btn btn-secondary">
            Settings
          </Link>
        </div>
      )}

      <ClientReviewBanner variant="full" />

      <div className="review-notes-intro card">
        <p>
          <strong>Client review mode.</strong> Suggested edits captured here will guide the next build pass. Use this
          during tomorrow&apos;s walkthrough to log changes without losing them between sessions.
        </p>
      </div>

      <div className="review-notes-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'Add suggestion'}
        </button>
      </div>

      {showForm && (
        <form className="review-notes-form card" onSubmit={handleAdd}>
          <h3 className="review-notes-form__title">New suggestion</h3>
          <div className="review-notes-form__grid">
            <label>
              Title
              <input
                className="form-input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Page / area
              <input
                className="form-input"
                value={form.area}
                onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                placeholder="e.g. Owner briefing, Proposal templates"
              />
            </label>
            <label>
              Priority
              <select
                className="form-select"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as ReviewNotePriority }))}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Note / comment
            <textarea
              className="form-textarea"
              rows={3}
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Save suggestion
          </button>
        </form>
      )}

      <div className="review-notes-board">
        {STATUSES.map(status => (
          <section key={status} className="review-notes-column card">
            <header className="review-notes-column__head">
              <h3>{status}</h3>
              <span>{byStatus[status].length}</span>
            </header>
            <ul className="review-notes-list">
              {byStatus[status].length === 0 ? (
                <li className="review-notes-empty">None</li>
              ) : (
                byStatus[status].map(n => (
                  <li key={n.id} className={`review-note-card review-note-card--${n.priority}`}>
                    <div className="review-note-card__top">
                      <strong>{n.title}</strong>
                      <span className={`review-note-pri review-note-pri--${n.priority}`}>{n.priority}</span>
                    </div>
                    <p className="review-note-card__comment">{n.comment}</p>
                    <div className="review-note-card__meta">
                      <span>Submitted by {n.submittedBy}</span>
                      <span>{n.area}</span>
                      <span>{formatReviewDate(n.createdAt)}</span>
                    </div>
                    <div className="review-note-card__actions">
                      {status !== 'Planned' && status !== 'Done' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => changeStatus(n, 'Planned')}
                        >
                          Mark planned
                        </button>
                      )}
                      {status !== 'Done' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => changeStatus(n, 'Done')}
                        >
                          Mark done
                        </button>
                      )}
                      {status === 'New' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => changeStatus(n, 'Reviewing')}
                        >
                          Start review
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
