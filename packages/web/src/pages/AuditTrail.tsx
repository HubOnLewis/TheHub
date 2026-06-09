import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AuditAction, AuditEntityType, AuditSource } from '@hub-crm/shared';
import { ROUTES } from '../config/paths.js';
import AuditSummaryCard from '../components/audit/AuditSummaryCard.js';
import AuditTimeline from '../components/audit/AuditTimeline.js';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import { useAuditStore } from '../audit/auditStore.js';

const ENTITY_TYPES: AuditEntityType[] = [
  'opportunity',
  'event',
  'task',
  'message',
  'agent_approval',
  'user',
  'review_note',
  'automation',
  'settings',
  'payment',
];

const ACTIONS: AuditAction[] = [
  'created',
  'updated',
  'status_changed',
  'note_added',
  'message_drafted',
  'message_queued',
  'task_completed',
  'approval_approved',
  'approval_dismissed',
  'approval_queued',
  'user_invited',
  'role_changed',
];

const SOURCES: AuditSource[] = ['user', 'agent', 'automation', 'system'];

export default function AuditTrail() {
  const [params] = useSearchParams();
  const ensureInitialized = useAuditStore(s => s.ensureInitialized);
  const events = useAuditStore(s => s.events);

  const [actor, setActor] = useState('');
  const [entityType, setEntityType] = useState<AuditEntityType | ''>(
    (params.get('entity') as AuditEntityType) || '',
  );
  const [entityId, setEntityId] = useState(params.get('id') ?? '');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [source, setSource] = useState<AuditSource | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const filtered = useMemo(() => {
    let list = [...events];
    if (actor) list = list.filter(e => e.actorName.toLowerCase().includes(actor.toLowerCase()));
    if (entityType) list = list.filter(e => e.entityType === entityType);
    if (entityId) list = list.filter(e => e.entityId === entityId);
    if (action) list = list.filter(e => e.action === action);
    if (source) list = list.filter(e => e.source === source);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.entityName.toLowerCase().includes(q) ||
          e.afterSummary?.toLowerCase().includes(q) ||
          e.beforeSummary?.toLowerCase().includes(q) ||
          e.actorName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [events, actor, entityType, entityId, action, source, search]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = events.filter(e => new Date(e.timestamp) >= todayStart).length;
  const automationCount = events.filter(e => e.source === 'agent' || e.source === 'automation').length;
  const userChangeCount = events.filter(
    e => e.entityType === 'user' || e.action === 'role_changed' || e.action === 'user_invited',
  ).length;
  const approvalCount = events.filter(e => e.entityType === 'agent_approval').length;

  const actors = useMemo(() => [...new Set(events.map(e => e.actorName))].sort(), [events]);

  return (
    <div className="audit-trail-page command-page">
      <DemoFlowNav />
      <header className="audit-trail-page__hero">
        <div>
          <span className="audit-trail-page__badge">Operational accountability</span>
          <h1 className="page-title">Audit trail</h1>
          <p className="page-subtitle">
            Every operational change is traceable — human, agent, and automation actions are logged with who did what and when.
          </p>
          <ul className="audit-trail-page__points">
            <li>Approvals create a permanent audit trail.</li>
            <li>Client review changes can be tracked from request to completion.</li>
            <li>No outbound SMS or payments are sent from this build without future configuration.</li>
          </ul>
        </div>
        <Link to={ROUTES.settings} className="btn btn-secondary btn-sm">
          Venue settings →
        </Link>
      </header>

      <section className="command-region surface-2 audit-replay-hero">
        <h2>Operational replay</h2>
        <p>
          Enterprise-grade attribution — human vs agent actions, before/after state, approvals granted by, and
          automation intervention points. Every record is locally persisted for client review continuity.
        </p>
        <div className="audit-replay-hero__tags">
          <span>Event lifecycle summaries</span>
          <span>What changed before event day</span>
          <span>Client communication timeline</span>
          <span>Viewed by owner</span>
        </div>
      </section>

      <div className="audit-summary-row">
        <AuditSummaryCard label="Actions today" value={todayCount} hint="Since midnight local" />
        <AuditSummaryCard label="Automations logged" value={automationCount} tone="positive" hint="Agents + workflows" />
        <AuditSummaryCard label="User changes" value={userChangeCount} hint="Invites & roles" />
        <AuditSummaryCard label="Approvals" value={approvalCount} tone="warn" hint="Agent approval queue" />
      </div>

      <div className="audit-filters card">
        <div className="audit-filters__grid">
          <label>
            <span>Search</span>
            <input
              className="form-input"
              placeholder="Event, task, client, actor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span>Actor</span>
            <select className="form-select" value={actor} onChange={e => setActor(e.target.value)}>
              <option value="">All actors</option>
              {actors.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Entity type</span>
            <select
              className="form-select"
              value={entityType}
              onChange={e => setEntityType(e.target.value as AuditEntityType | '')}
            >
              <option value="">All types</option>
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Action</span>
            <select
              className="form-select"
              value={action}
              onChange={e => setAction(e.target.value as AuditAction | '')}
            >
              <option value="">All actions</option>
              {ACTIONS.map(a => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Source</span>
            <select
              className="form-select"
              value={source}
              onChange={e => setSource(e.target.value as AuditSource | '')}
            >
              <option value="">All sources</option>
              {SOURCES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {entityId && (
          <p className="audit-filters__scoped">
            Scoped to entity <code>{entityId}</code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEntityId('')}>
              Clear
            </button>
          </p>
        )}
      </div>

      <AuditTimeline events={filtered} />
    </div>
  );
}
