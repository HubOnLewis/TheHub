type Chip = { id: string; label: string; active?: boolean; count?: number };

type Props = {
  chips: Chip[];
  onSelect: (id: string) => void;
  aiHint?: string;
};

export default function OpsFilterChips({ chips, onSelect, aiHint }: Props) {
  return (
    <div className="ops-filter-bar">
      <div className="ops-filter-chips" role="group" aria-label="Operational filters">
        {chips.map(c => (
          <button
            key={c.id}
            type="button"
            className={`ops-filter-chip${c.active ? ' ops-filter-chip--active' : ''}`}
            aria-pressed={c.active}
            onClick={() => onSelect(c.id)}
          >
            {c.label}
            {c.count != null ? <span className="ops-filter-chip__n">{c.count}</span> : null}
          </button>
        ))}
      </div>
      {aiHint ? <p className="ops-filter-bar__ai">{aiHint}</p> : null}
    </div>
  );
}
