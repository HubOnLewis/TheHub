import { useState } from 'react';
import { useDemoOpsStore } from '../../state/demoOpsStore.js';
import { useAuditStore } from '../../audit/auditStore.js';
import { resetHubLocalDemoCache } from '../../lib/hubLocalCacheCleanup.js';

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
    localStorage.removeItem('hub-crm-review-notes');
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
    localStorage.removeItem('hub-crm-demo-ops');
    localStorage.removeItem('hub-crm-review-notes');
    localStorage.removeItem('hub-crm-audit-trail');
    resetDemoOps();
    resetAuditTrail();
    notify('All demo state cleared. Reloading…');
    window.setTimeout(() => window.location.reload(), 600);
  };

  const resetLocalCache = () => {
    if (
      !confirmAction(
        'Reset local demo and cache data in this browser? Auth/session will be kept. The page will reload.',
      )
    )
      return;
    resetHubLocalDemoCache();
    resetDemoOps();
    resetAuditTrail();
    notify('Local demo/cache cleared. Reloading…');
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

        <section className="card demo-controls__card">
          <h4>Reset local demo/cache data</h4>
          <p className="settings-muted">
            Clears browser demo ops, audit trail, review notes, and stale imported cache. Keeps your login session.
          </p>
          <button type="button" className="btn btn-secondary" onClick={resetLocalCache}>
            Reset local demo/cache data
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
        <pre className="demo-controls__pre">{`hubDemoCacheReset()
// or manually:
localStorage.removeItem('hub-crm-demo-ops');
localStorage.removeItem('hub-crm-review-notes');
localStorage.removeItem('hub-crm-audit-trail');
location.reload();`}</pre>
      </section>
    </div>
  );
}
