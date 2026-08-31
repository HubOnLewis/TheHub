import type { EventDetailViewModel } from '../../lib/eventDetail.js';
import { openVenueDocument, type VenueDocKind } from '../../venue/documentGenerator.js';

type Props = {
  model: EventDetailViewModel;
};

const ACTIONS: Array<{ kind: VenueDocKind; title: string; blurb: string }> = [
  {
    kind: 'proposal',
    title: 'Client proposal',
    blurb: 'Professional proposal PDF — package, date, space, investment, terms.',
  },
  {
    kind: 'beo',
    title: 'Banquet event order',
    blurb: 'Internal BEO with run-of-show checklist, financial snapshot, and staff tasks.',
  },
  {
    kind: 'invoice_summary',
    title: 'Payment summary',
    blurb: 'Paid vs balance summary for client or accounting follow-up.',
  },
];

export default function EventDocsPanel({ model }: Props) {
  return (
    <section className="event-docs-panel">
      <p className="event-docs-panel__intro text-muted text-sm">
        Generate print-ready documents in one click. Use your browser’s Print → Save as PDF.
      </p>
      <div className="event-docs-grid">
        {ACTIONS.map(a => (
          <button
            key={a.kind}
            type="button"
            className="event-docs-card"
            onClick={() => openVenueDocument(a.kind, model)}
          >
            <strong>{a.title}</strong>
            <span>{a.blurb}</span>
            <span className="event-docs-card__cta">Generate →</span>
          </button>
        ))}
      </div>

      <h3 className="event-docs-panel__sub">On file</h3>
      <ul className="event-docs-checklist">
        {model.documents.map(d => (
          <li key={d.key} className={d.onFile ? 'is-onfile' : ''}>
            <span className="event-docs-check" aria-hidden>
              {d.onFile ? '✓' : '○'}
            </span>
            {d.label}
            {d.onFile ? <span className="text-muted"> on file</span> : <span className="text-muted"> missing</span>}
          </li>
        ))}
      </ul>
      {model.documentLinks.length > 0 ? (
        <ul className="event-docs-files">
          {model.documentLinks.map(f => (
            <li key={f.fileName}>
              {f.label}: <code>{f.fileName}</code>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
