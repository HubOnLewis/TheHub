import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { dealService } from './DealService.js';

type CompanyRow = { _id: string; name: string };
type EnrichedDeal = {
  _id: string;
  company: string;
  status: string;
  ownerUserId?: string;
  assignedTo?: string;
  dealExecutionState?: {
    pressureLevel?: 'low' | 'medium' | 'high' | 'critical';
    isStalled?: boolean;
    daysSinceLastInteraction?: number;
    overdueFollowUps?: number;
  };
  forecastState?: { forecastCategory?: 'commit' | 'best_case' | 'pipeline' | 'excluded' };
};

export interface AccountPenetrationState {
  lastInteractionAt?: string;
  daysSinceLastInteraction?: number;
  totalInteractions30d: number;
  totalInteractions90d: number;
  uniqueContacts30d: number;
  uniqueContacts90d: number;
  openDeals: number;
  activeDeals: number;
  stalledDeals: number;
  criticalDeals: number;
  openFollowUps: number;
  overdueFollowUps: number;
  assignedOwnerUserId?: string;
  assignedOwnerName?: string;
  penetrationLevel: 'low' | 'medium' | 'high';
  penetrationReasons: string[];
  coverageRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  coverageRiskReasons: string[];
  whitespaceSignals: string[];
}

export interface AccountCoverageRow {
  companyId: string;
  companyName: string;
  accountPenetrationState: AccountPenetrationState;
  accountCoverageWarnings: string[];
}

function daysSince(d?: Date): number | undefined {
  if (!d) return undefined;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function pickOwner(deals: EnrichedDeal[], fallbackName?: string): { id?: string; name?: string } {
  const counts = new Map<string, { n: number; name?: string }>();
  for (const d of deals) {
    if (!d.ownerUserId) continue;
    const row = counts.get(d.ownerUserId) ?? { n: 0, name: d.assignedTo };
    row.n += 1;
    if (!row.name && d.assignedTo) row.name = d.assignedTo;
    counts.set(d.ownerUserId, row);
  }
  let best: { id?: string; n: number; name?: string } = { n: 0 };
  for (const [id, v] of counts) {
    if (v.n > best.n) best = { id, n: v.n, name: v.name };
  }
  return { id: best.id, name: best.name ?? fallbackName };
}

export class AccountPenetrationService {
  private async listAllCompanies(db: Db, ctx: TenantContext): Promise<CompanyRow[]> {
    const first = await CompanyRepository.listCompanies(db, ctx, {}, { page: 1, limit: 200, sort: 'name', order: 'asc' });
    let rows = first.data.map(r => ({ _id: r._id, name: r.name }));
    for (let p = 2; p <= first.pages; p += 1) {
      const next = await CompanyRepository.listCompanies(db, ctx, {}, { page: p, limit: 200, sort: 'name', order: 'asc' });
      rows = rows.concat(next.data.map(r => ({ _id: r._id, name: r.name })));
    }
    return rows;
  }

  evaluate(input: {
    lastInteractionAt?: Date;
    totalInteractions30d: number;
    totalInteractions90d: number;
    uniqueContacts30d: number;
    uniqueContacts90d: number;
    openDeals: number;
    activeDeals: number;
    stalledDeals: number;
    criticalDeals: number;
    openFollowUps: number;
    overdueFollowUps: number;
    assignedOwnerUserId?: string;
    assignedOwnerName?: string;
    forecastIncludedDeals: number;
  }): { state: AccountPenetrationState; warnings: string[]; singleContactDependency: boolean } {
    const dsi = daysSince(input.lastInteractionAt);
    const recent14 = (dsi ?? 999) <= 14;
    const shallowContacts = input.uniqueContacts90d <= 1;
    const activePipeline = input.openDeals > 0 || input.activeDeals > 0;
    const noRecentWithPipeline = activePipeline && (dsi ?? 999) > 14;
    const singleContactDependency = shallowContacts && activePipeline;
    const penetrationReasons: string[] = [];
    const riskReasons: string[] = [];
    const whitespaceSignals: string[] = [];
    const warnings: string[] = [];

    if (input.uniqueContacts90d <= 1) penetrationReasons.push('Only one contact has been engaged in the last 90 days');
    if ((dsi ?? 999) > 0) penetrationReasons.push(`No interaction in ${dsi} days`);
    if (activePipeline && input.totalInteractions30d < 3) penetrationReasons.push('Open deals exist but account activity is shallow');
    if (recent14 && input.totalInteractions30d >= 4 && input.uniqueContacts90d >= 2) penetrationReasons.push('Account has strong recent touch volume across multiple contacts');

    let penetrationLevel: 'low' | 'medium' | 'high' = 'medium';
    if (recent14 && input.totalInteractions30d >= 4 && input.totalInteractions90d >= 10 && input.uniqueContacts90d >= 2 && input.overdueFollowUps === 0 && input.criticalDeals === 0) {
      penetrationLevel = 'high';
    } else if ((dsi ?? 999) > 21 || input.uniqueContacts90d === 0 || (activePipeline && input.totalInteractions30d < 2) || input.overdueFollowUps > 0) {
      penetrationLevel = 'low';
    }

    let coverageRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (noRecentWithPipeline) riskReasons.push('Active pipeline with no recent interaction');
    if (singleContactDependency) riskReasons.push('Account depends on a single engaged contact');
    if (!input.assignedOwnerUserId && activePipeline) riskReasons.push('No assigned owner for active account');
    if (input.overdueFollowUps > 0 && input.criticalDeals > 0) riskReasons.push('Overdue follow-up exists while deal pressure is critical');
    if (input.openFollowUps > 0 && input.overdueFollowUps / Math.max(1, input.openFollowUps) > 0.4) riskReasons.push('Active account but follow-up discipline is weak');
    if (input.uniqueContacts90d <= 1) riskReasons.push('Shallow contact coverage');
    if (recent14 && input.uniqueContacts90d >= 2 && input.overdueFollowUps === 0) riskReasons.push('Coverage appears healthy across multiple recent touches');

    if ((!input.assignedOwnerUserId && activePipeline) || (noRecentWithPipeline && input.openDeals > 0) || (input.overdueFollowUps > 0 && input.criticalDeals > 0)) {
      coverageRiskLevel = 'critical';
    } else if (singleContactDependency || (input.stalledDeals > 0 && input.totalInteractions30d < 3) || (activePipeline && input.overdueFollowUps > 0)) {
      coverageRiskLevel = 'high';
    } else if (input.uniqueContacts90d <= 1 || !recent14 || input.totalInteractions30d < 2) {
      coverageRiskLevel = 'medium';
    } else {
      coverageRiskLevel = 'low';
    }

    if (input.totalInteractions90d > 0 && input.openDeals === 0) whitespaceSignals.push('No open deals despite recent account activity');
    if (input.totalInteractions30d > 0 && input.openFollowUps === 0) whitespaceSignals.push('Recent interaction activity but no scheduled follow-up');
    if (shallowContacts) whitespaceSignals.push('Single-contact relationship with no broader account coverage');
    if (input.totalInteractions90d > 0 && input.activeDeals === 0) whitespaceSignals.push('Historical activity exists but no active pipeline');
    if (input.criticalDeals > 0 && (dsi ?? 999) > 14) whitespaceSignals.push('Account shows pipeline pressure without recent expansion activity');
    if ((dsi ?? 999) >= 90) whitespaceSignals.push('Account has not been engaged in 90+ days');

    if (!input.assignedOwnerUserId && activePipeline) warnings.push('Active account has no assigned owner');
    if (activePipeline && (dsi ?? 999) > 14) warnings.push('Account has open deals but no recent interaction');
    if (activePipeline && input.uniqueContacts90d === 0) warnings.push('Account has open deals but zero identified contacts');
    if (input.stalledDeals >= 2) warnings.push('Account has multiple stalled deals');
    if (input.overdueFollowUps > 0 && (dsi ?? 999) > 14) warnings.push('Account has overdue follow-ups and no recent activity');
    if (input.forecastIncludedDeals > 0 && shallowContacts) warnings.push('Account has forecast-included deals with shallow coverage');

    return {
      state: {
        lastInteractionAt: input.lastInteractionAt?.toISOString(),
        daysSinceLastInteraction: dsi,
        totalInteractions30d: input.totalInteractions30d,
        totalInteractions90d: input.totalInteractions90d,
        uniqueContacts30d: input.uniqueContacts30d,
        uniqueContacts90d: input.uniqueContacts90d,
        openDeals: input.openDeals,
        activeDeals: input.activeDeals,
        stalledDeals: input.stalledDeals,
        criticalDeals: input.criticalDeals,
        openFollowUps: input.openFollowUps,
        overdueFollowUps: input.overdueFollowUps,
        assignedOwnerUserId: input.assignedOwnerUserId,
        assignedOwnerName: input.assignedOwnerName,
        penetrationLevel,
        penetrationReasons: Array.from(new Set(penetrationReasons)),
        coverageRiskLevel,
        coverageRiskReasons: Array.from(new Set(riskReasons)),
        whitespaceSignals: Array.from(new Set(whitespaceSignals)),
      },
      warnings: Array.from(new Set(warnings)),
      singleContactDependency,
    };
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filters: {
      ownerUserId?: string;
      penetrationLevel?: 'low' | 'medium' | 'high';
      coverageRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
      hasOpenDeals?: boolean;
      hasOverdueFollowUps?: boolean;
      hasWhitespace?: boolean;
      q?: string;
    } = {},
  ): Promise<AccountCoverageRow[]> {
    const companies = await this.listAllCompanies(db, ctx);
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const interactionsAgg = await db.collection('interactions').aggregate<{
      companyId: string;
      lastInteractionAt?: Date;
      total30d: number;
      total90d: number;
      contactSet30d: string[];
      contactSet90d: string[];
      openFollowUps: number;
      overdueFollowUps: number;
    }>([
      { $match: { ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}) } },
      {
        $group: {
          _id: '$companyId',
          lastInteractionAt: { $max: '$createdAt' },
          total30d: { $sum: { $cond: [{ $gte: ['$createdAt', since30] }, 1, 0] } },
          total90d: { $sum: { $cond: [{ $gte: ['$createdAt', since90] }, 1, 0] } },
          contactSet30d: { $addToSet: { $cond: [{ $and: [{ $gte: ['$createdAt', since30] }, { $ifNull: ['$contactId', false] }] }, '$contactId', null] } },
          contactSet90d: { $addToSet: { $cond: [{ $and: [{ $gte: ['$createdAt', since90] }, { $ifNull: ['$contactId', false] }] }, '$contactId', null] } },
          openFollowUps: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $ifNull: ['$followUpAt', false] }] }, 1, 0] } },
          overdueFollowUps: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $ifNull: ['$followUpAt', false] }, { $lt: ['$followUpAt', now] }] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          companyId: '$_id',
          lastInteractionAt: 1,
          total30d: 1,
          total90d: 1,
          contactSet30d: { $filter: { input: '$contactSet30d', as: 'c', cond: { $ne: ['$$c', null] } } },
          contactSet90d: { $filter: { input: '$contactSet90d', as: 'c', cond: { $ne: ['$$c', null] } } },
          openFollowUps: 1,
          overdueFollowUps: 1,
        },
      },
    ]).toArray();
    const iMap = new Map(interactionsAgg.map(r => [r.companyId, r]));

    const deals = await dealService.listAllActiveEnriched(db, ctx) as EnrichedDeal[];
    const dealsByCompany = new Map<string, EnrichedDeal[]>();
    for (const d of deals) {
      const key = (d.company ?? '').toLowerCase();
      const arr = dealsByCompany.get(key) ?? [];
      arr.push(d);
      dealsByCompany.set(key, arr);
    }

    let rows: AccountCoverageRow[] = companies.map(c => {
      const i = iMap.get(c._id);
      const d = dealsByCompany.get(c.name.toLowerCase()) ?? [];
      const openDeals = d.length;
      const activeDeals = d.filter(x => ['Pending Approval', 'Approved', 'Won', 'In Build'].includes(x.status)).length;
      const stalledDeals = d.filter(x => x.dealExecutionState?.isStalled).length;
      const criticalDeals = d.filter(x => x.dealExecutionState?.pressureLevel === 'critical').length;
      const forecastIncludedDeals = d.filter(x => ['commit', 'best_case', 'pipeline'].includes(x.forecastState?.forecastCategory ?? 'pipeline')).length;
      const owner = pickOwner(d);
      const evaluated = this.evaluate({
        lastInteractionAt: i?.lastInteractionAt,
        totalInteractions30d: i?.total30d ?? 0,
        totalInteractions90d: i?.total90d ?? 0,
        uniqueContacts30d: (i?.contactSet30d ?? []).length,
        uniqueContacts90d: (i?.contactSet90d ?? []).length,
        openDeals,
        activeDeals,
        stalledDeals,
        criticalDeals,
        openFollowUps: i?.openFollowUps ?? 0,
        overdueFollowUps: i?.overdueFollowUps ?? 0,
        assignedOwnerUserId: owner.id,
        assignedOwnerName: owner.name,
        forecastIncludedDeals,
      });
      return {
        companyId: c._id,
        companyName: c.name,
        accountPenetrationState: evaluated.state,
        accountCoverageWarnings: evaluated.warnings,
      };
    });

    if (filters.ownerUserId) rows = rows.filter(r => r.accountPenetrationState.assignedOwnerUserId === filters.ownerUserId);
    if (filters.penetrationLevel) rows = rows.filter(r => r.accountPenetrationState.penetrationLevel === filters.penetrationLevel);
    if (filters.coverageRiskLevel) rows = rows.filter(r => r.accountPenetrationState.coverageRiskLevel === filters.coverageRiskLevel);
    if (typeof filters.hasOpenDeals === 'boolean') rows = rows.filter(r => (r.accountPenetrationState.openDeals > 0) === filters.hasOpenDeals);
    if (typeof filters.hasOverdueFollowUps === 'boolean') rows = rows.filter(r => (r.accountPenetrationState.overdueFollowUps > 0) === filters.hasOverdueFollowUps);
    if (typeof filters.hasWhitespace === 'boolean') rows = rows.filter(r => (r.accountPenetrationState.whitespaceSignals.length > 0) === filters.hasWhitespace);
    if (filters.q?.trim()) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(r =>
        r.companyName.toLowerCase().includes(q) ||
        (r.accountPenetrationState.assignedOwnerName ?? '').toLowerCase().includes(q) ||
        (r.accountPenetrationState.assignedOwnerUserId ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }

  async byCompanyId(db: Db, ctx: TenantContext, companyId: string): Promise<AccountCoverageRow | null> {
    const rows = await this.list(db, ctx);
    return rows.find(r => r.companyId === companyId) ?? null;
  }

  async ownerCoverageSummary(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx);
    const map = new Map<string, {
      ownedAccounts: number;
      activeAccounts30d: number;
      inactiveAccounts90d: number;
      lowPenetrationAccounts: number;
      criticalCoverageRiskAccounts: number;
      accountsWithSingleContactDependency: number;
    }>();
    for (const r of rows) {
      const owner = r.accountPenetrationState.assignedOwnerUserId;
      if (!owner) continue;
      const curr = map.get(owner) ?? {
        ownedAccounts: 0,
        activeAccounts30d: 0,
        inactiveAccounts90d: 0,
        lowPenetrationAccounts: 0,
        criticalCoverageRiskAccounts: 0,
        accountsWithSingleContactDependency: 0,
      };
      curr.ownedAccounts += 1;
      if (r.accountPenetrationState.totalInteractions30d > 0) curr.activeAccounts30d += 1;
      if ((r.accountPenetrationState.daysSinceLastInteraction ?? 999) >= 90) curr.inactiveAccounts90d += 1;
      if (r.accountPenetrationState.penetrationLevel === 'low') curr.lowPenetrationAccounts += 1;
      if (r.accountPenetrationState.coverageRiskLevel === 'critical') curr.criticalCoverageRiskAccounts += 1;
      if (r.accountPenetrationState.uniqueContacts90d <= 1 && r.accountPenetrationState.activeDeals > 0) curr.accountsWithSingleContactDependency += 1;
      map.set(owner, curr);
    }
    return map;
  }

  async coverageCounts(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx);
    return {
      lowPenetration: rows.filter(r => r.accountPenetrationState.penetrationLevel === 'low').length,
      mediumPenetration: rows.filter(r => r.accountPenetrationState.penetrationLevel === 'medium').length,
      highPenetration: rows.filter(r => r.accountPenetrationState.penetrationLevel === 'high').length,
      criticalCoverageRisk: rows.filter(r => r.accountPenetrationState.coverageRiskLevel === 'critical').length,
      highCoverageRisk: rows.filter(r => r.accountPenetrationState.coverageRiskLevel === 'high').length,
      accountsWithWhitespaceSignals: rows.filter(r => r.accountPenetrationState.whitespaceSignals.length > 0).length,
      singleContactDependencyAccounts: rows.filter(r => r.accountPenetrationState.uniqueContacts90d <= 1 && r.accountPenetrationState.activeDeals > 0).length,
      activeAccountsWithoutOwner: rows.filter(r => r.accountPenetrationState.activeDeals > 0 && !r.accountPenetrationState.assignedOwnerUserId).length,
    };
  }
}

export const accountPenetrationService = new AccountPenetrationService();
