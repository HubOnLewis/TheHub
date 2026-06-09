import { useState } from 'react';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';
import { useAuditStore } from '../../audit/auditStore.js';
import { DEMO_OPS_STORAGE_KEY } from '../../state/demoOpsStore.js';
import { AUDIT_STORAGE_KEY } from '../../audit/auditStore.js';

const REVIEW_NOTES_KEY = 'hub-crm-review-notes';

function confirmAction(message: string): boolean {
  return window.confirm(message);
}

export default function DemoControlsPanel() {
  const resetDemoOps = useDemoOpsStore(s => s.resetDemoOps);
  const resetAuditTrail = useAuditStore(s => s.resetAuditTrail);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const resetReviewNotes = () => {
    if (!confirmAction('Reset all review notes to seed defaults?')) return;
    localStorage.removeItem(REVIEW_NOTES_KEY);
    notify('Review notes reset — reload Review notes page to see seed data.');
  };

  const resetInteractions = () => {
    if (!confirmAction('Reset demo interactions (tasks, approvals, deal, inbox)? Audit trail is kept.')) return;
    resetDemoOps();
    notify('Interaction state reset.');
  };

  const resetAudit = () => {
    if (!confirmAction('Reset audit trail to seed events?')) return;
    resetAuditTrail();
    notify('Audit trail reset.');
  };

  const resetAll = () => {
    if (
      !confirmAction(
        'Reset ALL local demo data (interactions, review notes, audit trail)? This cannot be undone.',
      )
    )
      return;
    localStorage.removeItem(DEMO_OPS_STORAGE_KEY);
    localStorage.removeItem(REVIEW_NOTES_KEY);
    localStorage.removeItem(AUDIT_STORAGE_KEY);
    resetDemoOps();
    resetAuditTrail();
    notify('All demo state cleared. Reloading…');
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="settings-deep demo-controls">
      {toast && <div className="demo-controls__toast">{toast}</div>}

      <p className="settings-lede">
        Use these controls before tomorrow&apos;s walkthrough to start from a clean, predictable state.
        All data stays in this browser only.
      </p>

      <div className="demo-controls__grid">
        <section className="card demo-controls__card">
          <h4>Reset interaction state</h4>
          <p className="settings-muted">
            Tasks, Autopilot approvals, Miller/Harris deal workspace, inbox drafts, and activity feed.
          </p>
          <button type="button" className="btn btn-secondary" onClick={resetInteractions}>
            Reset interactions
          </button>
        </section>

        <section className="card demo-controls__card">
          <h4>Reset review notes</h4>
          <p className="settings-muted">Jason &amp; Hannah seed suggestions for the build pass.</p>
          <button type="button" className="btn btn-secondary" onClick={resetReviewNotes}>
            Reset review notes
          </button>
        </section>

        <section className="card demo-controls__card">
          <h4>Reset audit trail</h4>
          <p className="settings-muted">Operational attribution timeline returns to seed events.</p>
          <button type="button" className="btn btn-secondary" onClick={resetAudit}>
            Reset audit trail
          </button>
        </section>

        <section className="card demo-controls__card demo-controls__card--warn">
          <h4>Reset everything</h4>
          <p className="settings-muted">Clears all three local stores and reloads the app.</p>
          <button type="button" className="btn btn-primary" onClick={resetAll}>
            Reset all demo state
          </button>
        </section>
      </div>

      <section className="demo-controls__console card">
        <h4>Console fallback</h4>
        <pre className="demo-controls__pre">{`localStorage.removeItem('hub-crm-demo-ops');
localStorage.removeItem('hub-crm-review-notes');
localStorage.removeItem('hub-crm-audit-trail');
location.reload();`}</pre>
      </section>
    </div>
  );
}
