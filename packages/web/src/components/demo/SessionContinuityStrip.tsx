import { useDemoOpsStore } from '../../state/demoOpsStore.js';
import { formatRelativeTime } from '../../lib/relativeTime.js';

export default function SessionContinuityStrip() {
  const meta = useDemoOpsStore(s => s.sessionMeta) ?? {
    continuityLabel: 'Operational session',
    lastModifiedBy: 'System',
    lastModifiedAt: new Date().toISOString(),
  };

  return (
    <div className="session-continuity" role="status">
      <span className="session-continuity__dot" aria-hidden />
      <span>
        <strong>Session continuity</strong> · {meta.continuityLabel}
      </span>
      <span>
        Last change <strong>{meta.lastModifiedBy}</strong> · {formatRelativeTime(meta.lastModifiedAt)}
      </span>
    </div>
  );
}
