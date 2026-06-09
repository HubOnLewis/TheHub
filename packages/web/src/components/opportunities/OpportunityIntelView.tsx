import { useMemo, useState } from 'react';
import { formatCurrency } from '@hub-crm/shared';
import {
  getOpportunityIntelSections,
  type EnhancedOpportunityRow,
  type OpportunityBucket,
} from '../../data/pvUiIntelligence.js';
import { pvStatusDisplay } from '../../data/perfectVenueSeed.js';

export type EventListFilter = 'all' | 'balance' | 'approaching' | 'stale';

const BUCKET_META: Record<
  OpportunityBucket,
  { title: string; hint: string; tone: 'green' | 'violet' | 'amber' | 'rose' | 'slate' }
> = {
  likely_to_close: { title: 'Likely to close', hint: 'Proposal active', tone: 'violet' },
  balance_risk: { title: 'Balance due', hint: 'Outstanding balance before event', tone: 'rose' },
  event_approaching: { title: 'Upcoming', hint: 'Event within prep window', tone: 'amber' },
  proposal_stale: { title: 'Stale proposals', hint: 'Needs follow-up', tone: 'amber' },
  confirmed_prep: { title: 'Confirmed', hint: 'Signed — prep in progress', tone: 'green' },
  pipeline: { title: 'Early pipeline', hint: 'Qualified & in progress', tone: 'slate' },
  lost_insight: { title: 'Archived', hint: 'Lost or completed', tone: 'slate' },
};

const FILTER_BUCKETS: Record<EventListFilter, OpportunityBucket[] | null> = {
  all: null,
  balance: ['balance_risk'],
  approaching: ['event_approaching', 'confirmed_prep'],
  stale: ['proposal_stale', 'likely_to_close'],
};

const BUCKET_ORDER: OpportunityBucket[] = [
  'balance_risk',
  'event_approaching',
  'likely_to_close',
  'confirmed_prep',
  'proposal_stale',
  'pipeline',
  'lost_insight',
];

function OppRow({ row }: { row: EnhancedOpportunityRow }) {
  const e = row.event;
  return (
    <div
      className={`venue-intel-table__row--data venue-intel-row--${row.intel.urgency === 'critical' ? 'critical' : row.intel.urgency === 'high' ? 'high' : 'medium'}`}
    >
      <span className="venue-intel-table__cell">
        <strong>{e.title}</strong>
        <span className="venue-intel-table__sub">{e.client}</span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{pvStatusDisplay(e.pvStatus)}</strong>
        <span className="venue-intel-table__sub">
          {e.eventDate}
          {row.daysOut != null ? ` · ${row.daysOut}d` : ''}
        </span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{formatCurrency(row.proposalTotal)}</strong>
        <span className="venue-intel-table__sub">
          Bal {formatCurrency(e.balanceDue)}
        </span>
      </span>
      <span className="venue-intel-table__cell">
        <strong>{row.readiness}% ready</strong>
        <span className="venue-intel-table__meta">
          {row.groupSize} guests
        </span>
      </span>
    </div>
  );
}

function BucketSection({
  bucket,
  rows,
  defaultOpen = true,
}: {
  bucket: OpportunityBucket;
  rows: EnhancedOpportunityRow[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = BUCKET_META[bucket];
  if (!rows.length) return null;

  return (
    <section className={`opp-bucket opp-bucket--${meta.tone}`}>
      <button type="button" className="opp-bucket__head" onClick={() => setOpen(o => !o)}>
        <div>
          <h3>{meta.title}</h3>
          <p>{meta.hint}</p>
        </div>
        <span className="opp-bucket__count">{rows.length}</span>
      </button>
      {open ? (
        <div className="venue-intel-panel opp-bucket__body">
          <div className="venue-intel-table__row--head opp-bucket__cols">
            <span>Event</span>
            <span>Status · Date</span>
            <span>Value</span>
            <span>Readiness</span>
          </div>
          {rows.map(r => (
            <a key={r.event.id} href={r.link} className="venue-intel-table__link">
              <OppRow row={r} />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isBucketVisible(bucket: OpportunityBucket, filter: EventListFilter): boolean {
  const allowed = FILTER_BUCKETS[filter];
  if (!allowed) return true;
  return allowed.includes(bucket);
}

function defaultOpenForBucket(bucket: OpportunityBucket, filter: EventListFilter): boolean {
  if (filter === 'all') {
    return !['proposal_stale', 'pipeline', 'lost_insight'].includes(bucket);
  }
  return FILTER_BUCKETS[filter]?.includes(bucket) ?? false;
}

export default function OpportunityIntelView({ filter = 'all' }: { filter?: EventListFilter }) {
  const sections = useMemo(() => getOpportunityIntelSections(), []);

  const rowsByBucket: Record<OpportunityBucket, EnhancedOpportunityRow[]> = {
    balance_risk: sections.balanceRisk,
    event_approaching: sections.eventApproaching,
    likely_to_close: sections.likelyToClose,
    confirmed_prep: sections.confirmedPrep,
    proposal_stale: sections.proposalStale,
    pipeline: sections.pipeline,
    lost_insight: sections.lostInsight,
  };

  const visibleBuckets = BUCKET_ORDER.filter(b => isBucketVisible(b, filter) && rowsByBucket[b].length > 0);

  return (
    <div className="opp-intel-buckets">
      {visibleBuckets.length === 0 ? (
        <p className="empty-hint">No events match this filter.</p>
      ) : (
        visibleBuckets.map(bucket => (
          <BucketSection
            key={bucket}
            bucket={bucket}
            rows={rowsByBucket[bucket]}
            defaultOpen={defaultOpenForBucket(bucket, filter)}
          />
        ))
      )}
    </div>
  );
}
