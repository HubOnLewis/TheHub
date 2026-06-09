// packages/web/src/components/ui/index.tsx
import React from 'react';
import BrandLogo from '../BrandLogo.js';

export { StatusBadge } from './StatusBadge.js';
export { MetricHeroCard } from './MetricHeroCard.js';
export { SkeletonBlock, DashboardSkeleton, TableSkeleton } from './Skeleton.js';

// ── Modal ─────────────────────────────────────────────────────────
interface ModalProps {
  title:    string;
  onClose:  () => void;
  children: React.ReactNode;
  footer?:  React.ReactNode;
  width?:   number;
}

export function Modal({ title, onClose, children, footer, width = 520 }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 18, lineHeight: 1 }}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: 'spin 0.8s linear infinite', color: 'var(--red)' }}
      aria-hidden
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/** Centered branded loader for page-level data fetches */
export function BrandedPageLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="branded-page-loader" role="status" aria-live="polite">
      <BrandLogo size="md" />
      <span>{message}</span>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────
export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div className="empty-state-brand">
        <BrandLogo size="sm" />
      </div>
      <div style={{ fontFamily: 'var(--font-cond)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {message}
      </div>
      {sub && <div style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

// ── KPICard ───────────────────────────────────────────────────────
export function KPICard({ label, value, colorVar = '--red', sub, className = '' }: { label: string; value: string | number; colorVar?: string; sub?: string; className?: string }) {
  return (
    <div className={`card card-kpi ${className}`.trim()} style={{ padding: '18px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-cond)', fontSize: 28, fontWeight: 800, color: `var(${colorVar})`, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── StatusSelect ──────────────────────────────────────────────────
export function StatusSelect({ status, options, onChange, disabled, labelForValue }: {
  status:    string;
  options:   readonly string[];
  onChange:  (v: string) => void;
  disabled?: boolean;
  /** Optional Hub-friendly labels; values sent onChange stay the stored enum strings. */
  labelForValue?: (v: string) => string;
}) {
  const lab = labelForValue ?? ((v: string) => v);
  return (
    <select
      className="form-select"
      value={status}
      style={{ padding: '3px 6px', fontSize: 12, width: 'auto', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : undefined }}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      disabled={disabled}
      title={disabled ? 'Terminal — no further transitions allowed' : undefined}
    >
      {options.map(s => <option key={s} value={s}>{lab(s)}</option>)}
    </select>
  );
}

// ── Pagination ────────────────────────────────────────────────────
export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{total} total</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Prev
        </button>
        <span style={{ padding: '4px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
          {page} / {pages}
        </span>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}
