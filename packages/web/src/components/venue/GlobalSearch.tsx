import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { buildAttentionQueue, globalSearch } from '../../venue/liveIntelligence.js';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { rows } = useLiveCrmEvents();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const attention = useMemo(() => buildAttentionQueue(rows), [rows]);
  const hits = useMemo(() => globalSearch(q, rows, attention), [q, rows, attention]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = wrapRef.current?.querySelector('input');
        input?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="crm-global-search" ref={wrapRef}>
      <span className="crm-topnav__search-icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        className="crm-topnav__search"
        placeholder="Search events, contacts… (Ctrl+K)"
        aria-label="Global search"
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && q.trim() ? (
        <div className="crm-global-search__panel" role="listbox">
          {hits.length === 0 ? (
            <div className="crm-global-search__empty">No matches for “{q.trim()}”</div>
          ) : (
            hits.map(hit => (
              <button
                key={hit.id}
                type="button"
                className="crm-global-search__hit"
                role="option"
                onClick={() => {
                  setOpen(false);
                  setQ('');
                  navigate(hit.href);
                }}
              >
                <span className="crm-global-search__kind">{hit.kind}</span>
                <span className="crm-global-search__title">{hit.title}</span>
                <span className="crm-global-search__sub">{hit.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
