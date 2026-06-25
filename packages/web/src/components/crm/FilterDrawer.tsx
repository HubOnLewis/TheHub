import type { EventListFilter } from '../opportunities/opportunityLiveTypes.js';

type Props = {
  open: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  advancedFilter: EventListFilter;
  onAdvancedFilterChange: (f: EventListFilter) => void;
};

const ADVANCED_OPTIONS: { id: EventListFilter; label: string }[] = [
  { id: 'all', label: 'All events' },
  { id: 'balance', label: 'Balance due' },
  { id: 'approaching', label: 'Upcoming' },
  { id: 'stale', label: 'Stale proposals' },
];

export default function FilterDrawer({
  open,
  onClose,
  search,
  onSearchChange,
  advancedFilter,
  onAdvancedFilterChange,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="crm-filter-backdrop" aria-label="Close filters" onClick={onClose} />
      <aside className="crm-filter-drawer" aria-label="Event filters">
        <header className="crm-filter-drawer__head">
          <h2>Filters</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <label className="crm-filter-field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Event, contact, or space"
          />
        </label>
        <fieldset className="crm-filter-field">
          <legend>Advanced</legend>
          {ADVANCED_OPTIONS.map(opt => (
            <label key={opt.id} className="crm-filter-radio">
              <input
                type="radio"
                name="crm-advanced-filter"
                checked={advancedFilter === opt.id}
                onChange={() => onAdvancedFilterChange(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      </aside>
    </>
  );
}
