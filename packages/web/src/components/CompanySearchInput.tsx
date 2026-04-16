// packages/web/src/components/CompanySearchInput.tsx
// Query-backed autocomplete for company name lookup.
// Calls onSelect(companyName) when a result is picked.
// Does not auto-create records.
import React, { useState, useRef, useEffect } from 'react';
import { useCompanySearch } from '../hooks/useCompanies.js';

interface Props {
  onSelect:    (name: string) => void;
  placeholder?: string;
}

export function CompanySearchInput({ onSelect, placeholder = 'Search companies…' }: Props) {
  const [q,    setQ]    = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: results = [] } = useCompanySearch(q);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = open && q.trim().length >= 2 && results.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className="form-input"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showDropdown && (
        <div style={{
          position:        'absolute',
          top:             '100%',
          left:            0,
          right:           0,
          background:      'var(--surface)',
          border:          '1px solid var(--border)',
          borderRadius:    6,
          boxShadow:       '0 4px 12px rgba(0,0,0,0.25)',
          zIndex:          50,
          maxHeight:       240,
          overflowY:       'auto',
        }}>
          {results.map(c => (
            <div
              key={c._id}
              style={{
                padding:    '8px 12px',
                cursor:     'pointer',
                borderBottom: '1px solid var(--border)',
                fontSize:   13,
              }}
              onMouseDown={e => {
                e.preventDefault(); // prevent input blur before click fires
                onSelect(c.name);
                setQ('');
                setOpen(false);
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
              {(c.address?.city || c.address?.state) && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {[c.address?.city, c.address?.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
