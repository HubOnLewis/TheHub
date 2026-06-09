import { EVENT_FINALIZATION_ITEMS, type EventFinalizationItemId } from '@hub-crm/shared';
import { useFinalizationStore } from '../../store/finalizationStore.js';
import { useAppStore } from '../../store/index.js';

const CHECKLIST_GROUPS: Array<{ title: string; itemIds: EventFinalizationItemId[] }> = [
  {
    title: 'Client confirmation',
    itemIds: ['guest_count', 'contract_proposal', 'client_confirmation'],
  },
  {
    title: 'Financial review',
    itemIds: ['deposit_payment', 'final_balance'],
  },
  {
    title: 'Operations readiness',
    itemIds: ['room_layout', 'menu_package', 'staff_notes', 'setup_teardown', 'ready_execution'],
  },
];

const ITEM_MAP = Object.fromEntries(EVENT_FINALIZATION_ITEMS.map(i => [i.id, i])) as Record<
  EventFinalizationItemId,
  (typeof EVENT_FINALIZATION_ITEMS)[number]
>;

interface EventFinalizationChecklistProps {
  dealId: string;
}

export default function EventFinalizationChecklist({ dealId }: EventFinalizationChecklistProps) {
  const userEmail = useAppStore(s => s.user?.email);
  const state = useFinalizationStore(s => s.getState(dealId));
  const completion = useFinalizationStore(s => s.getCompletion(dealId));
  const toggleItem = useFinalizationStore(s => s.toggleItem);

  return (
    <section className="card deal-panel deal-panel--wide finalization-checklist">
      <div className="deal-panel__title">Finalization checklist</div>
      <p className="finalization-checklist__lede">
        Confirm readiness before day-of. Complete all items to mark the event ready.
      </p>

      <div className="finalization-checklist__progress">
        <div className="finalization-checklist__progress-bar" aria-hidden>
          <div className="finalization-checklist__progress-fill" style={{ width: `${completion.percent}%` }} />
        </div>
        <span className="finalization-checklist__progress-label">
          {completion.percent}% complete · {completion.completed}/{completion.total}
        </span>
      </div>

      {completion.allComplete ? (
        <div className="finalization-checklist__ready" role="status">
          Ready for Event
        </div>
      ) : null}

      {CHECKLIST_GROUPS.map(group => (
        <div key={group.title} className="finalization-checklist__group">
          <h3 className="finalization-checklist__group-title">{group.title}</h3>
          <ul className="finalization-checklist__items">
            {group.itemIds.map(id => {
              const item = ITEM_MAP[id];
              if (!item) return null;
              const checked = Boolean(state.completed[id]);
              return (
                <li key={id} className={checked ? 'finalization-checklist__item--done' : ''}>
                  <label className="finalization-checklist__label">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(dealId, id, userEmail)}
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
