import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import type { AuditEntityType } from '@hub-crm/shared';
import { getEntityAttribution } from '../../audit/entityAttribution.js';
import { useAuditStore } from '../../audit/auditStore.js';

interface EntityAttributionBarProps {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  fallbackCreated?: { by: string; at: string };
  compact?: boolean;
  showHistoryLink?: boolean;
}

export default function EntityAttributionBar({
  entityType,
  entityId,
  entityName,
  fallbackCreated,
  compact,
  showHistoryLink = true,
}: EntityAttributionBarProps) {
  const events = useAuditStore(s => s.events);
  const attr = getEntityAttribution(events, entityType, entityId, fallbackCreated);

  if (!attr) return null;

  return (
    <div className={`entity-attribution${compact ? ' entity-attribution--compact' : ''}`}>
      <div className="entity-attribution__row">
        <span className="entity-attribution__label">Created by</span>
        <strong>{attr.createdBy}</strong>
        <time dateTime={attr.createdAt}>{attr.createdAtRel}</time>
      </div>
      <div className="entity-attribution__row">
        <span className="entity-attribution__label">Last edited by</span>
        <strong>{attr.lastEditedBy}</strong>
        <span className={`entity-attribution__source entity-attribution__source--${attr.lastSource}`}>
          {attr.lastSource}
        </span>
        <time dateTime={attr.lastEditedAt}>{attr.lastEditedAtRel}</time>
      </div>
      <p className="entity-attribution__trust">
        Every change is traceable — human, agent, and automation actions are logged.
      </p>
      {showHistoryLink && (
        <Link
          to={`${ROUTES.audit}?entity=${entityType}&id=${encodeURIComponent(entityId)}`}
          className="entity-attribution__link"
        >
          View full operational history →
        </Link>
      )}
    </div>
  );
}
