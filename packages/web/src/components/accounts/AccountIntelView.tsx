import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import {
  getAccountIntelSections,
  type EnhancedAccountProfile,
  VISIBLE_ACCOUNT_CAP,
} from '../../data/pvUiIntelligence.js';
import { ROUTES } from '../../config/paths.js';

type FilterId = 'all' | 'vip' | 'upcoming' | 'balance' | 'dormant' | 'recent';

function stageLabel(stage: EnhancedAccountProfile['relationshipStage']): string {
  switch (stage) {
    case 'vip_repeat':
      return 'VIP · repeat';
    case 'active_client':
      return 'Active client';
    case 'recent_inquiry':
      return 'Recent inquiry';
    case 'at_risk':
      return 'At risk';
    case 'dormant':
      return 'Dormant';
    case 'low_signal':
      return 'Low signal';
    default:
      return 'Active client';
  }
}

function AccountCard({ a, onSelect }: { a: EnhancedAccountProfile; onSelect: (a: EnhancedAccountProfile) => void }) {
  return (
    <button type="button" className="acct-intel-card" onClick={() => onSelect(a)}>
      <div className="acct-intel-card__head">
        <strong>{a.client}</strong>
        <span className={`acct-intel-card__health acct-intel-card__health--${a.healthScore >= 75 ? 'good' : a.healthScore >= 50 ? 'mid' : 'low'}`}>
          {a.healthScore}
        </span>
      </div>
      <p className="acct-intel-card__meta">
        {a.eventCount} events · {formatCurrency(a.lifetimeCollected)} collected
      </p>
      <p className="acct-intel-card__sub">
        {a.revenueTier.toUpperCase()} · Avg {formatCurrency(a.averageSpend)} · {stageLabel(a.relationshipStage)}
      </p>
      {a.nextEventDate ? (
        <p className="acct-intel-card__next">Next · {a.nextEventDate}</p>
      ) : a.lastEventDate ? (
        <p className="acct-intel-card__next">Last · {a.lastEventDate}</p>
      ) : null}
      <div className="acct-intel-card__tags">
        {a.segmentTags.slice(0, 2).map(t => (
          <span key={t} className="venue-intel-tag">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function AccountDrawer({
  account,
  onClose,
}: {
  account: EnhancedAccountProfile | null;
  onClose: () => void;
}) {
  if (!account) return null;
  return (
    <div className="acct-intel-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="acct-intel-drawer"
        role="dialog"
        aria-label={`Account ${account.client}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="acct-intel-drawer__head">
          <div>
            <h2>{account.client}</h2>
            <p>{account.primaryContactLabel} · Health {account.healthScore}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <dl className="acct-intel-drawer__stats">
          <div>
            <dt>Total spend</dt>
            <dd>{formatCurrency(account.totalValue)}</dd>
          </div>
          <div>
            <dt>Bookings</dt>
            <dd>{account.eventCount}</dd>
          </div>
          <div>
            <dt>Avg / event</dt>
            <dd>{formatCurrency(account.averageSpend)}</dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>{formatCurrency(account.totalCollected)}</dd>
          </div>
          <div>
            <dt>Balance due</dt>
            <dd>{formatCurrency(account.balanceOutstanding)}</dd>
          </div>
          <div>
            <dt>Coordinator</dt>
            <dd>{account.coordinator}</dd>
          </div>
        </dl>
        {account.upcomingEvent ? (
          <p className="acct-intel-drawer__insight">
            <strong>Upcoming</strong> · {account.upcomingEvent}
          </p>
        ) : null}
        {account.expansionOpportunity ? (
          <p className="acct-intel-drawer__insight acct-intel-drawer__insight--ai">{account.expansionOpportunity}</p>
        ) : null}
        <p className="acct-intel-drawer__muted">Contact on file · masked in client review mode</p>
        <Link to={ROUTES.opportunities} className="btn btn-secondary btn-sm">
          View related events →
        </Link>
      </aside>
    </div>
  );
}

function CompactTable({
  rows,
  onSelect,
}: {
  rows: EnhancedAccountProfile[];
  onSelect: (a: EnhancedAccountProfile) => void;
}) {
  return (
    <div className="venue-intel-panel">
      <div className="venue-intel-table__row--head">
        <span>Account</span>
        <span>Relationship</span>
        <span>Events / spend</span>
        <span>Health</span>
      </div>
      {rows.map(a => (
        <button
          key={a.id}
          type="button"
          className="venue-intel-table__link"
          onClick={() => onSelect(a)}
        >
          <div
            className={`venue-intel-table__row--data${a.balanceOutstanding > 0 ? ' venue-intel-row--high' : a.isVip ? ' venue-intel-row--medium' : ''}`}
          >
            <span className="venue-intel-table__cell">
              <strong>{a.client}</strong>
              <span className="venue-intel-table__sub">{a.primaryContactLabel}</span>
            </span>
            <span className="venue-intel-table__cell">
              <strong>{stageLabel(a.relationshipStage)}</strong>
              <span className="venue-intel-table__sub">
                {a.nextEventDate ? `Next ${a.nextEventDate}` : a.lastEventDate ? `Last ${a.lastEventDate}` : '—'}
              </span>
            </span>
            <span className="venue-intel-table__cell">
              <strong>
                {a.eventCount} · {formatCurrency(a.totalValue)}
              </strong>
              <span className="venue-intel-table__sub">Avg {formatCurrency(a.averageSpend)}</span>
            </span>
            <span className="venue-intel-table__cell">
              <strong>{a.healthScore}</strong>
              {a.balanceOutstanding > 0 ? (
                <span className="venue-intel-table__meta">{formatCurrency(a.balanceOutstanding)} due</span>
              ) : null}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export type AccountFilterId = FilterId;

export default function AccountIntelView({ filter = 'all' }: { filter?: FilterId }) {
  const sections = useMemo(() => getAccountIntelSections(), []);
  const [selected, setSelected] = useState<EnhancedAccountProfile | null>(null);
  const [showAllTable, setShowAllTable] = useState(false);

  const tableRows = useMemo(() => {
    const { all, vipRepeat, upcoming, balanceRisk, dormantValuable, recent } = sections;
    switch (filter) {
      case 'vip':
        return vipRepeat;
      case 'upcoming':
        return upcoming;
      case 'balance':
        return balanceRisk;
      case 'dormant':
        return dormantValuable;
      case 'recent':
        return recent;
      default:
        return all.slice(0, VISIBLE_ACCOUNT_CAP);
    }
  }, [filter, sections]);

  const railInsights = useMemo(() => {
    const top = sections.vipRepeat[0];
    const risk = sections.balanceRisk[0];
    return [
      top
        ? {
            id: 'vip-top',
            label: `${top.client} · ${top.eventCount} events`,
            meta: 'Top repeat relationship',
          }
        : null,
      risk
        ? {
            id: 'bal-top',
            label: `${risk.client} · ${formatCurrency(risk.balanceOutstanding)}`,
            meta: 'Highest balance exposure',
          }
        : null,
      {
        id: 'count',
        label: `${sections.all.length} accounts on file`,
        meta: 'Perfect Venue contact export',
      },
    ].filter(Boolean) as { id: string; label: string; meta: string }[];
  }, [sections]);

  return (
    <>
      <section className="acct-intel-spotlight">
        <h3 className="acct-intel-spotlight__title">VIP & repeat relationships</h3>
        <div className="acct-intel-card-grid">
          {sections.vipRepeat.slice(0, 6).map(a => (
            <AccountCard key={a.id} a={a} onSelect={setSelected} />
          ))}
        </div>
      </section>

      <div className="venue-ops-layout venue-ops-layout--split">
        <div>
          <CompactTable rows={tableRows} onSelect={setSelected} />
          {sections.all.length > VISIBLE_ACCOUNT_CAP && !showAllTable ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setShowAllTable(true)}
            >
              Show more accounts ({sections.all.length - VISIBLE_ACCOUNT_CAP} more)
            </button>
          ) : null}
          {showAllTable ? (
            <CompactTable rows={sections.all.slice(VISIBLE_ACCOUNT_CAP, VISIBLE_ACCOUNT_CAP + 25)} onSelect={setSelected} />
          ) : null}
        </div>

        <aside className="acct-intel-rail" aria-label="Relationship insights">
          <h3>Relationship insights</h3>
          <ul>
            {railInsights.map(i => (
              <li key={i.id}>
                <strong>{i.label}</strong>
                <span>{i.meta}</span>
              </li>
            ))}
          </ul>
          {sections.dormantValuable[0] ? (
            <p className="acct-intel-rail__note">
              Dormant valuable: <strong>{sections.dormantValuable[0].client}</strong> —{' '}
              {sections.dormantValuable[0].eventCount} past events
            </p>
          ) : null}
        </aside>
      </div>

      <AccountDrawer account={selected} onClose={() => setSelected(null)} />
    </>
  );
}
