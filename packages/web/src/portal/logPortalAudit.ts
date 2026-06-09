import type { LogAuditOptions } from '../audit/logAudit.js';
import { logAudit } from '../audit/logAudit.js';
import { usePortalStore } from './portalStore.js';

/** Portal actions → shared audit trail + portal timeline */
export function logPortalAudit(opts: Omit<LogAuditOptions, 'actorId' | 'actorName' | 'actorRole' | 'source' | 'visibility'> & {
  timelineTitle?: string;
  timelineDetail?: string;
  timelineKind?: 'payment' | 'document' | 'message' | 'checklist' | 'ai' | 'system';
}): void {
  const session = usePortalStore.getState().session;
  const actorName = session?.user.name ?? 'Portal client';
  const actorId = session?.user.id ?? 'portal-client';

  logAudit({
    ...opts,
    actorId,
    actorName,
    actorRole: 'Client',
    source: 'user',
    visibility: 'client_review',
    visibleToClientReview: true,
    deviceLabel: 'Client portal',
  });

  if (opts.timelineTitle) {
    usePortalStore.getState().appendTimeline({
      title: opts.timelineTitle,
      detail: opts.timelineDetail ?? opts.afterSummary,
      kind: opts.timelineKind ?? 'system',
    });
  }
}
