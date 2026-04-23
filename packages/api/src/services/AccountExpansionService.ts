import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { accountPenetrationService, type AccountCoverageRow, type AccountPenetrationState } from './AccountPenetrationService.js';
import { AccountPlanRepository } from '../repositories/AccountPlanRepository.js';
import { deliveryService } from './DeliveryService.js';

export interface AccountExpansionState {
  expansionReadiness: 'low' | 'medium' | 'high';
  expansionReasons: string[];
  blockers: string[];
  opportunitySignals: string[];
  hasActiveExpansionMotion: boolean;
  hasOpenPipeline: boolean;
  hasRecentActivity: boolean;
  planningPriority: 'low' | 'medium' | 'high' | 'urgent';
  planningReasons: string[];
}

export interface AccountExpansionRow extends AccountCoverageRow {
  accountExpansionState: AccountExpansionState;
  accountPlanId?: string;
  accountPlanStatus?: 'draft' | 'active' | 'paused' | 'completed';
  hasPlan: boolean;
}

function computeExpansion(
  penetration: AccountPenetrationState,
  warnings: string[],
  hasPlan: boolean,
  planStatus?: 'draft' | 'active' | 'paused' | 'completed',
  extra?: { repeatedUnits?: boolean; similarBuildsNoStandard?: boolean },
): AccountExpansionState {
  const blockers: string[] = [];
  const opportunitySignals: string[] = [];
  const expansionReasons: string[] = [];
  const planningReasons: string[] = [];
  const hasRecentActivity = (penetration.daysSinceLastInteraction ?? 999) <= 21;
  const hasOpenPipeline = penetration.openDeals > 0 || penetration.activeDeals > 0;

  if (!hasRecentActivity) blockers.push('No recent interaction');
  if (penetration.uniqueContacts90d <= 1) blockers.push('Single-contact dependency');
  if (penetration.overdueFollowUps > 0) blockers.push('Overdue follow-ups exist');
  if (penetration.criticalDeals > 0) blockers.push('Critical deal pressure present');
  if (!penetration.assignedOwnerUserId) blockers.push('No assigned owner');
  if (penetration.coverageRiskLevel === 'high' || penetration.coverageRiskLevel === 'critical') blockers.push(`Account coverage risk is ${penetration.coverageRiskLevel}`);
  if (hasOpenPipeline && penetration.stalledDeals > 0) blockers.push('Open pipeline already needs recovery before expansion');
  if (penetration.activeDeals > 0 && (penetration.stalledDeals > 0 || penetration.criticalDeals > 0)) {
    blockers.push('Production backlog affecting account delivery confidence');
    blockers.push('Shop execution risk may affect account confidence');
  }

  if (hasRecentActivity && !hasOpenPipeline) opportunitySignals.push('Recent account activity but no open deals');
  if (penetration.uniqueContacts90d >= 2 && penetration.activeDeals <= 1) opportunitySignals.push('Multiple contacts engaged with only limited active pipeline');
  if (extra?.repeatedUnits) opportunitySignals.push('Repeatable build pattern opportunity');
  if (extra?.similarBuildsNoStandard) opportunitySignals.push('Multiple similar units without standardized spec');
  if (penetration.coverageRiskLevel === 'low' && penetration.overdueFollowUps === 0) opportunitySignals.push('Account has healthy follow-up discipline and low coverage risk');
  if (penetration.totalInteractions90d > 0 && !hasOpenPipeline) opportunitySignals.push('Historical activity exists but no current expansion motion');
  if (penetration.uniqueContacts90d >= 2 && penetration.openDeals <= 1) opportunitySignals.push('Relationship depth exceeds current pipeline depth');

  let expansionReadiness: 'low' | 'medium' | 'high' = 'medium';
  if (
    hasRecentActivity &&
    ['medium', 'high'].includes(penetration.penetrationLevel) &&
    penetration.uniqueContacts90d >= 2 &&
    !['high', 'critical'].includes(penetration.coverageRiskLevel) &&
    penetration.overdueFollowUps === 0
  ) {
    expansionReadiness = 'high';
    expansionReasons.push('Healthy recent activity but no meaningful open pipeline');
    expansionReasons.push('Multiple contacts engaged with room for broader opportunity');
  } else if (
    !hasRecentActivity ||
    penetration.coverageRiskLevel === 'critical' ||
    penetration.overdueFollowUps > 0 ||
    penetration.criticalDeals > 0
  ) {
    expansionReadiness = 'low';
    expansionReasons.push('Coverage is too shallow to support expansion planning');
    if (penetration.criticalDeals > 0) expansionReasons.push('Critical deal pressure should be resolved before expansion');
  } else {
    expansionReasons.push('Some relationship activity exists but expansion motion is not yet structured');
  }

  const hasActiveExpansionMotion = !!hasPlan && (planStatus === 'active' || planStatus === 'draft');
  let planningPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  if (expansionReadiness === 'high' && !hasPlan) {
    planningPriority = 'urgent';
    planningReasons.push('Expansion-ready account has no active plan');
  } else if (opportunitySignals.length > 0 && !hasOpenPipeline) {
    planningPriority = 'urgent';
    planningReasons.push('Strong opportunity signals with weak/no active pipeline');
  } else if (expansionReadiness === 'high') {
    planningPriority = 'high';
    planningReasons.push('Healthy relationship depth but limited live opportunity');
    if (hasPlan && planStatus !== 'active') planningReasons.push('Plan exists but is not active');
  } else if (expansionReadiness === 'medium') {
    planningPriority = 'medium';
    planningReasons.push('Promising account with blockers to clear before strong expansion motion');
  } else {
    planningPriority = 'low';
    planningReasons.push('Coverage issues should be fixed before planning expansion');
  }

  if (warnings.length > 0) {
    blockers.push(...warnings.slice(0, 2));
  }

  return {
    expansionReadiness,
    expansionReasons: Array.from(new Set(expansionReasons)),
    blockers: Array.from(new Set(blockers)),
    opportunitySignals: Array.from(new Set(opportunitySignals)),
    hasActiveExpansionMotion,
    hasOpenPipeline,
    hasRecentActivity,
    planningPriority,
    planningReasons: Array.from(new Set(planningReasons)),
  };
}

export class AccountExpansionService {
  evaluate(
    penetration: AccountPenetrationState,
    warnings: string[],
    hasPlan: boolean,
    planStatus?: 'draft' | 'active' | 'paused' | 'completed',
  ) {
    return computeExpansion(penetration, warnings, hasPlan, planStatus);
  }

  private toExpansionRow(
    coverage: AccountCoverageRow,
    plan?: { _id: string; status: 'draft' | 'active' | 'paused' | 'completed' },
    extra?: { repeatedUnits?: boolean; similarBuildsNoStandard?: boolean },
  ): AccountExpansionRow {
    return {
      ...coverage,
      accountPlanId: plan?._id,
      accountPlanStatus: plan?.status,
      hasPlan: !!plan,
      accountExpansionState: computeExpansion(coverage.accountPenetrationState, coverage.accountCoverageWarnings, !!plan, plan?.status, extra),
    };
  }

  async list(
    db: Db,
    ctx: TenantContext,
    filters: {
      ownerUserId?: string;
      expansionReadiness?: 'low' | 'medium' | 'high';
      planningPriority?: 'low' | 'medium' | 'high' | 'urgent';
      hasPlan?: boolean;
      hasOpenPipeline?: boolean;
      hasBlockers?: boolean;
      q?: string;
    } = {},
  ): Promise<AccountExpansionRow[]> {
    const coverage = await accountPenetrationService.list(db, ctx, { ownerUserId: filters.ownerUserId, q: filters.q });
    const plans = await AccountPlanRepository.listPlans(db, ctx, {}, { page: 1, limit: 5000, sort: 'updatedAt', order: 'desc' });
    const planByCompany = new Map(plans.data.map(p => [p.companyId, p]));
    let rows = coverage.map((c): AccountExpansionRow => {
      const repeatedUnits = c.accountPenetrationState.openDeals >= 2;
      const similarBuildsNoStandard = (c.accountPenetrationState.openDeals >= 2) && (c.accountPenetrationState.uniqueContacts90d >= 2);
      return this.toExpansionRow(c, planByCompany.get(c.companyId), { repeatedUnits, similarBuildsNoStandard });
    });

    if (filters.expansionReadiness) rows = rows.filter(r => r.accountExpansionState.expansionReadiness === filters.expansionReadiness);
    if (filters.planningPriority) rows = rows.filter(r => r.accountExpansionState.planningPriority === filters.planningPriority);
    if (typeof filters.hasPlan === 'boolean') rows = rows.filter(r => r.hasPlan === filters.hasPlan);
    if (typeof filters.hasOpenPipeline === 'boolean') rows = rows.filter(r => r.accountExpansionState.hasOpenPipeline === filters.hasOpenPipeline);
    if (typeof filters.hasBlockers === 'boolean') rows = rows.filter(r => (r.accountExpansionState.blockers.length > 0) === filters.hasBlockers);
    return rows;
  }

  async byCompanyId(db: Db, ctx: TenantContext, companyId: string) {
    const coverage = await accountPenetrationService.byCompanyId(db, ctx, companyId);
    if (!coverage) return null;
    const plan = await AccountPlanRepository.findByCompanyId(db, ctx, companyId);
    const handoff = await deliveryService.companyHandoffContext(db, ctx, companyId);
    const mergedCoverage: AccountCoverageRow = {
      ...coverage,
      accountCoverageWarnings: Array.from(new Set([
        ...coverage.accountCoverageWarnings,
        ...handoff.customerHandoffWarnings,
      ])),
    };
    let row = this.toExpansionRow(mergedCoverage, plan ?? undefined, {
      repeatedUnits: coverage.accountPenetrationState.openDeals >= 2,
      similarBuildsNoStandard: coverage.accountPenetrationState.openDeals >= 2 && coverage.accountPenetrationState.uniqueContacts90d >= 2,
    });
    if (handoff.recentDeliveryExpansionSignal) {
      row = {
        ...row,
        accountExpansionState: {
          ...row.accountExpansionState,
          opportunitySignals: Array.from(new Set([
            ...row.accountExpansionState.opportunitySignals,
            'Recent delivery may create expansion or service opportunity',
          ])),
        },
      };
    }
    return row;
  }

  async expansionCounts(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx);
    return {
      highReadiness: rows.filter(r => r.accountExpansionState.expansionReadiness === 'high').length,
      mediumReadiness: rows.filter(r => r.accountExpansionState.expansionReadiness === 'medium').length,
      lowReadiness: rows.filter(r => r.accountExpansionState.expansionReadiness === 'low').length,
      urgentPlanningPriority: rows.filter(r => r.accountExpansionState.planningPriority === 'urgent').length,
      highPlanningPriority: rows.filter(r => r.accountExpansionState.planningPriority === 'high').length,
      accountsWithoutPlan: rows.filter(r => !r.hasPlan).length,
      highReadinessWithoutPlan: rows.filter(r => r.accountExpansionState.expansionReadiness === 'high' && !r.hasPlan).length,
    };
  }

  async ownerExpansionSummary(db: Db, ctx: TenantContext) {
    const rows = await this.list(db, ctx);
    const out = new Map<string, {
      highReadinessAccounts: number;
      urgentPlanningAccounts: number;
      accountsWithoutPlan: number;
    }>();
    for (const r of rows) {
      const owner = r.accountPenetrationState.assignedOwnerUserId;
      if (!owner) continue;
      const curr = out.get(owner) ?? { highReadinessAccounts: 0, urgentPlanningAccounts: 0, accountsWithoutPlan: 0 };
      if (r.accountExpansionState.expansionReadiness === 'high') curr.highReadinessAccounts += 1;
      if (r.accountExpansionState.planningPriority === 'urgent') curr.urgentPlanningAccounts += 1;
      if (!r.hasPlan) curr.accountsWithoutPlan += 1;
      out.set(owner, curr);
    }
    return out;
  }
}

export const accountExpansionService = new AccountExpansionService();
