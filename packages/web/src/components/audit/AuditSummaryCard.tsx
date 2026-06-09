interface AuditSummaryCardProps {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'warn' | 'positive';
}

export default function AuditSummaryCard({ label, value, hint, tone = 'default' }: AuditSummaryCardProps) {
  return (
    <article className={`audit-summary-card audit-summary-card--${tone}`}>
      <span className="audit-summary-card__label">{label}</span>
      <span className="audit-summary-card__value">{value}</span>
      {hint && <span className="audit-summary-card__hint">{hint}</span>}
    </article>
  );
}
