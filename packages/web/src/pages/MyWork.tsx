import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import VenueIntelRows, { type VenueIntelRow } from '../components/operations/intel/VenueIntelRows.js';
import LoadingState from '../components/crm/LoadingState.js';
import { useLiveCrmEvents } from '../hooks/useLiveCrmEvents.js';
import { useVenueOpsQueue } from '../hooks/useVenueOps.js';
import { useVenueAttention } from '../hooks/useAgentSnapshot.js';
import { useInboxTriage } from '../hooks/useInboxTriage.js';
import { useAppStore } from '../store/index.js';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import type { VenueOpsKind, VenueOpsPriority } from '@hub-crm/shared';

type QueuePriority = 'high' | 'medium' | 'low';

type QueueItem = {
  id: string;
  source: 'Ops queue' | 'Recommendation' | 'Inbox';
  kind: string;
  title: string;
  subtitle: string;
  dueLabel: string;
  priority: QueuePriority;
  href: string;
  eventId: string | null;
  owner: string | null;
};

function kindLabel(kind: VenueOpsKind): string {
  switch (kind) {
    case 'stale_inquiry': return 'Inquiry';
    case 'hold_expiring':
    case 'hold_expired': return 'Hold';
    case 'walkthrough': return 'Walkthrough';
    case 'proposal_followup': return 'Proposal';
    case 'deposit_due': return 'Deposit';
    case 'balance_due': return 'Balance';
    case 'missing_details': return 'Details';
    case 'beo_missing': return 'BEO';
    case 'playbook_overdue': return 'Playbook';
    case 'prep': return 'Prep';
    default: return kind;
  }
}

/** ops-queue kinds that already represent the same concern as an inbox/attention item for the same event. */
const BALANCE_COVERING_KINDS: VenueOpsKind[] = ['balance_due', 'deposit_due'];
const PROPOSAL_COVERING_KINDS: VenueOpsKind[] = ['proposal_followup'];

const PRIORITY_ORDER: Record<QueuePriority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL: Record<VenueOpsPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export default function MyWork() {
  const { rows, isLoading: rowsLoading, isError: rowsError } = useLiveCrmEvents();
  const queue = useVenueOpsQueue();
  const attention = useVenueAttention(rows);
  const inbox = useInboxTriage();
  const user = useAppStore(s => s.user);
  const [mineOnly, setMineOnly] = useState(false);

  const rowsById = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);

  const items: QueueItem[] = useMemo(() => {
    const out: QueueItem[] = [];
    const opsTasks = queue.data?.tasks ?? [];

    const balanceCoveredEvents = new Set(
      opsTasks.filter(t => BALANCE_COVERING_KINDS.includes(t.kind)).map(t => t.dealId),
    );
    const proposalCoveredEvents = new Set(
      opsTasks.filter(t => PROPOSAL_COVERING_KINDS.includes(t.kind)).map(t => t.dealId),
    );

    for (const t of opsTasks) {
      out.push({
        id: `ops-${t.id}`,
        source: 'Ops queue',
        kind: kindLabel(t.kind),
        title: t.title,
        subtitle: `${t.contact} · ${t.eventTitle}`,
        dueLabel: t.dueLabel,
        priority: t.priority,
        href: opportunityDetailPath(t.dealId),
        eventId: t.dealId,
        owner: rowsById.get(t.dealId)?.owner ?? null,
      });
    }

    for (const f of attention.items) {
      const eventId = f.eventId ?? null;
      const isBalanceAgent = /balance/i.test(f.agent ?? '');
      const isProposalAgent = /follow.?up|proposal/i.test(f.agent ?? '');
      if (eventId && isBalanceAgent && balanceCoveredEvents.has(eventId)) continue;
      if (eventId && isProposalAgent && proposalCoveredEvents.has(eventId)) continue;
      out.push({
        id: `rec-${f.id}`,
        source: 'Recommendation',
        kind: f.agent ?? 'Recommendation',
        title: f.title,
        subtitle: f.detail ?? f.eventTitle ?? '',
        dueLabel: f.actionLabel ?? 'Review',
        priority: f.priority === 'critical' ? 'high' : (f.priority as QueuePriority) ?? 'medium',
        href: f.href,
        eventId,
        owner: eventId ? (rowsById.get(eventId)?.owner ?? null) : null,
      });
    }

    const triage = inbox.data;
    if (triage) {
      for (const m of triage.unansweredMessages ?? []) {
        out.push({
          id: `inbox-msg-${m.eventId}`,
          source: 'Inbox',
          kind: 'Message',
          title: `Reply — ${m.eventTitle}`,
          subtitle: m.preview,
          dueLabel: m.at,
          priority: 'high',
          href: opportunityDetailPath(m.eventId),
          eventId: m.eventId,
          owner: rowsById.get(m.eventId)?.owner ?? null,
        });
      }
      for (const p of triage.unsignedProposals ?? []) {
        if (proposalCoveredEvents.has(p.eventId)) continue;
        out.push({
          id: `inbox-proposal-${p.eventId}`,
          source: 'Inbox',
          kind: 'Proposal',
          title: `Unsigned proposal v${p.version} — ${p.eventTitle}`,
          subtitle: p.status,
          dueLabel: 'Awaiting signature',
          priority: 'medium',
          href: opportunityDetailPath(p.eventId),
          eventId: p.eventId,
          owner: rowsById.get(p.eventId)?.owner ?? null,
        });
      }
      for (const d of triage.unpaidDeposits ?? []) {
        if (balanceCoveredEvents.has(d.eventId)) continue;
        out.push({
          id: `inbox-deposit-${d.eventId}`,
          source: 'Inbox',
          kind: 'Deposit',
          title: `Unpaid deposit — ${d.eventTitle}`,
          subtitle: `${formatCurrency(d.balanceDue)} outstanding`,
          dueLabel: 'Collect deposit',
          priority: 'high',
          href: opportunityDetailPath(d.eventId),
          eventId: d.eventId,
          owner: rowsById.get(d.eventId)?.owner ?? null,
        });
      }
    }

    return out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [queue.data, attention.items, inbox.data, rowsById]);

  const hasOwnershipData = items.some(i => i.owner && user?.name && i.owner === user.name);
  const visible = mineOnly ? items.filter(i => i.owner === user?.name) : items;
  const urgent = visible.filter(i => i.priority === 'high');

  const isLoading = rowsLoading && queue.isLoading && !inbox.data;
  if (isLoading) return <LoadingState message="Loading your queue…" />;

  const rowsForTable: VenueIntelRow[] = visible.map(i => ({
    id: i.id,
    href: i.href,
    urgency: i.priority === 'high' ? 'critical' : i.priority === 'medium' ? 'high' : 'medium',
    cells: [
      { primary: i.source, secondary: i.kind },
      { primary: i.title, secondary: i.subtitle },
      { primary: i.dueLabel, secondary: i.owner ?? 'Unassigned' },
      { primary: PRIORITY_LABEL[i.priority] },
    ],
    tags: i.priority === 'high' ? ['Now'] : undefined,
  }));

  return (
    <div className="command-page venue-ops-page">
      <OpsIntelShell
        eyebrow="Personal command center"
        title="My Work"
        subtitle="Ops-queue tasks, live recommendations, and inbox items needing a reply — one venue-wide queue."
        source={`Live · ${queue.data?.asOf ? new Date(queue.data.asOf).toLocaleString() : 'Hub CRM'}`}
        stats={[
          { label: 'Queue items', value: String(visible.length), hint: 'Ops + recommendations + inbox' },
          { label: 'High priority', value: String(urgent.length), tone: urgent.length > 0 ? 'warn' : 'good' },
          { label: 'Source runs', value: attention.source === 'api-agents' ? 'Persisted' : 'Live rules', hint: attention.source },
        ]}
        actions={
          <>
            {hasOwnershipData ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setMineOnly(v => !v)}
              >
                {mineOnly ? 'Show venue-wide' : 'Show mine only'}
              </button>
            ) : null}
            <Link to={ROUTES.tasks} className="btn btn-secondary btn-sm">
              Tasks →
            </Link>
          </>
        }
      />
      {rowsError && !visible.length ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load live events</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Nothing waiting</p>
          <p className="text-muted text-sm">
            Ops-queue tasks, recommendations, and inbox items needing a reply will appear here as events need attention.
          </p>
        </div>
      ) : (
        <VenueIntelRows title="Your operational queue" columns={['Source', 'Item', 'Due / owner', 'Priority']} rows={rowsForTable} />
      )}
      {mineOnly && !hasOwnershipData ? (
        <p className="text-muted text-sm" style={{ marginTop: 8 }}>
          No per-item assignment data is available yet — showing venue-wide instead of guessing ownership.
        </p>
      ) : null}
    </div>
  );
}
