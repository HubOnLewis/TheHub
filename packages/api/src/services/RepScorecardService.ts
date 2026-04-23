import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { dealService } from './DealService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { accountPenetrationService } from './AccountPenetrationService.js';

type EnrichedDeal = {
  _id: string;
  status?: string;
  ownerUserId?: string;
  assignedTo?: string;
  dealExecutionState?: {
    pressureLevel?: 'low' | 'medium' | 'high' | 'critical';
    openFollowUps?: number;
    overdueFollowUps?: number;
    nextActionSummary?: string;
    daysSinceLastInteraction?: number;
    isStalled?: boolean;
  };
  forecastState?: {
    forecastCategory?: 'commit' | 'best_case' | 'pipeline' | 'excluded';
    forecastAmount?: number;
    needsManagementReview?: boolean;
    confidence?: 'low' | 'medium' | 'high';
  };
  atRisk?: { flagged?: boolean };
};

export interface RepScorecard {
  ownerUserId: string;
  ownerName?: string;
  interactionMetrics: {
    total30d: number;
    calls30d: number;
    meetings30d: number;
    notes30d: number;
    avgPerWorkday30d?: number;
    daysSinceLastInteraction?: number;
  };
  followUpMetrics: {
    open: number;
    overdue: number;
    completed30d: number;
    overdueRate?: number;
  };
  dealMetrics: {
    openDeals: number;
    stalledDeals: number;
    criticalDeals: number;
    highPressureDeals: number;
    dealsWithoutRecentActivity: number;
    atRiskDeals: number;
  };
  forecastMetrics: {
    commitCount: number;
    bestCaseCount: number;
    pipelineCount: number;
    excludedCount: number;
    commitAmount: number;
    bestCaseAmount: number;
    pipelineAmount: number;
    excludedAmount: number;
    lowConfidenceLateStageDeals: number;
    dealsNeedingManagementReview: number;
  };
  executionMetrics: {
    dealsWithOpenFollowUps: number;
    dealsWithOverdueFollowUps: number;
    dealsWithNextAction: number;
    dealsWithoutNextAction: number;
    interactionCoverageRate?: number;
    followUpDisciplineRate?: number;
  };
  ownerCoverageSummary?: {
    ownedAccounts: number;
    activeAccounts30d: number;
    inactiveAccounts90d: number;
    lowPenetrationAccounts: number;
    criticalCoverageRiskAccounts: number;
    accountsWithSingleContactDependency: number;
  };
  coachingSignals: string[];
}

function workdaysInTrailing(days: number): number {
  const now = new Date();
  let n = 0;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return Math.max(1, n);
}

export class RepScorecardService {
  async list(
    db: Db,
    ctx: TenantContext,
    params: {
      days?: number;
      ownerUserId?: string;
      hasOverdueFollowUps?: boolean;
      hasCriticalDeals?: boolean;
      hasDealsNeedingReview?: boolean;
      q?: string;
      activeOnly?: boolean;
    } = {},
  ): Promise<RepScorecard[]> {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const users = await UserRepository.listAll(db);
    const userMap = new Map(users.map(u => [u._id, u.name]));
    const ownerCoverage = await accountPenetrationService.ownerCoverageSummary(db, ctx);

    const deals = await dealService.listAllActiveEnriched(db, ctx) as EnrichedDeal[];
    const ownerIds = Array.from(new Set([
      ...deals.map(d => d.ownerUserId).filter(Boolean) as string[],
      ...users.filter(u => u.active).map(u => u._id),
    ]));

    const interactionRows = await db.collection('interactions').aggregate<{
      ownerUserId: string;
      total30d: number;
      calls30d: number;
      meetings30d: number;
      notes30d: number;
      lastInteractionAt?: Date;
      open: number;
      overdue: number;
      completed30d: number;
    }>([
      {
        $match: {
          ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
          ownerUserId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$ownerUserId',
          total30d: { $sum: { $cond: [{ $gte: ['$createdAt', since] }, 1, 0] } },
          calls30d: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', since] }, { $eq: ['$type', 'call'] }] }, 1, 0] } },
          meetings30d: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', since] }, { $in: ['$type', ['meeting', 'visit']] }] }, 1, 0] } },
          notes30d: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', since] }, { $eq: ['$type', 'note'] }] }, 1, 0] } },
          lastInteractionAt: { $max: '$createdAt' },
          open: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $ifNull: ['$followUpAt', false] }] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $ifNull: ['$followUpAt', false] }, { $lt: ['$followUpAt', new Date()] }] }, 1, 0] } },
          completed30d: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $gte: ['$completedAt', since] }] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          ownerUserId: '$_id',
          total30d: 1,
          calls30d: 1,
          meetings30d: 1,
          notes30d: 1,
          lastInteractionAt: 1,
          open: 1,
          overdue: 1,
          completed30d: 1,
        },
      },
    ]).toArray();
    const iMap = new Map(interactionRows.map(r => [r.ownerUserId, r]));
    const workdays = workdaysInTrailing(days);

    const scorecards: RepScorecard[] = ownerIds.map(ownerUserId => {
      const ownerDeals = deals.filter(d => d.ownerUserId === ownerUserId);
      const i = iMap.get(ownerUserId);
      const openDeals = ownerDeals.length;
      const criticalDeals = ownerDeals.filter(d => d.dealExecutionState?.pressureLevel === 'critical').length;
      const highPressureDeals = ownerDeals.filter(d => d.dealExecutionState?.pressureLevel === 'high').length;
      const stalledDeals = ownerDeals.filter(d => d.dealExecutionState?.isStalled).length;
      const dealsWithoutRecentActivity = ownerDeals.filter(d => (d.dealExecutionState?.daysSinceLastInteraction ?? 999) > 7).length;
      const atRiskDeals = ownerDeals.filter(d => d.atRisk?.flagged).length;
      const byCategory = (c: string) => ownerDeals.filter(d => d.forecastState?.forecastCategory === c);
      const lowConfidenceLateStageDeals = ownerDeals.filter(d =>
        d.forecastState?.confidence === 'low' && ['Approved', 'Won', 'In Build'].includes((d as any).status ?? ''),
      ).length;
      const dealsNeedingManagementReview = ownerDeals.filter(d => d.forecastState?.needsManagementReview).length;
      const dealsWithOpenFollowUps = ownerDeals.filter(d => (d.dealExecutionState?.openFollowUps ?? 0) > 0).length;
      const dealsWithOverdueFollowUps = ownerDeals.filter(d => (d.dealExecutionState?.overdueFollowUps ?? 0) > 0).length;
      const dealsWithNextAction = ownerDeals.filter(d => !!d.dealExecutionState?.nextActionSummary).length;
      const dealsWithoutNextAction = ownerDeals.filter(d => !d.dealExecutionState?.nextActionSummary).length;
      const overdue = i?.overdue ?? 0;
      const open = i?.open ?? 0;
      const signals: string[] = [];
      if (overdue >= 5) signals.push('High overdue follow-up load');
      if ((i?.total30d ?? 0) >= 20 && open > 0 && (overdue / Math.max(1, open)) > 0.35) signals.push('Strong activity volume but weak follow-up discipline');
      if (lowConfidenceLateStageDeals > 0) signals.push('Multiple late-stage deals have low forecast confidence');
      if (dealsWithoutRecentActivity > 0) signals.push('Open deals exist with no recent interaction');
      if (openDeals > 0 && (dealsWithNextAction / Math.max(1, openDeals)) < 0.6) signals.push('Low interaction coverage across assigned deals');
      if (criticalDeals === 0 && highPressureDeals <= 1 && byCategory('commit').length > 0 && overdue === 0) signals.push('Healthy commit/best-case mix with low pressure');
      if (byCategory('excluded').length > byCategory('commit').length + byCategory('best_case').length) signals.push('Too many excluded deals relative to open pipeline');
      if (criticalDeals >= 3) signals.push('Critical deal pressure is concentrated on this rep');

      return {
        ownerUserId,
        ownerName: userMap.get(ownerUserId),
        interactionMetrics: {
          total30d: i?.total30d ?? 0,
          calls30d: i?.calls30d ?? 0,
          meetings30d: i?.meetings30d ?? 0,
          notes30d: i?.notes30d ?? 0,
          avgPerWorkday30d: (i?.total30d ?? 0) / workdays,
          daysSinceLastInteraction: i?.lastInteractionAt ? Math.floor((Date.now() - new Date(i.lastInteractionAt).getTime()) / (24 * 60 * 60 * 1000)) : undefined,
        },
        followUpMetrics: {
          open,
          overdue,
          completed30d: i?.completed30d ?? 0,
          overdueRate: open > 0 ? overdue / open : 0,
        },
        dealMetrics: {
          openDeals,
          stalledDeals,
          criticalDeals,
          highPressureDeals,
          dealsWithoutRecentActivity,
          atRiskDeals,
        },
        forecastMetrics: {
          commitCount: byCategory('commit').length,
          bestCaseCount: byCategory('best_case').length,
          pipelineCount: byCategory('pipeline').length,
          excludedCount: byCategory('excluded').length,
          commitAmount: byCategory('commit').reduce((n, d) => n + (d.forecastState?.forecastAmount ?? 0), 0),
          bestCaseAmount: byCategory('best_case').reduce((n, d) => n + (d.forecastState?.forecastAmount ?? 0), 0),
          pipelineAmount: byCategory('pipeline').reduce((n, d) => n + (d.forecastState?.forecastAmount ?? 0), 0),
          excludedAmount: byCategory('excluded').reduce((n, d) => n + (d.forecastState?.forecastAmount ?? 0), 0),
          lowConfidenceLateStageDeals,
          dealsNeedingManagementReview,
        },
        executionMetrics: {
          dealsWithOpenFollowUps,
          dealsWithOverdueFollowUps,
          dealsWithNextAction,
          dealsWithoutNextAction,
          interactionCoverageRate: openDeals > 0 ? dealsWithNextAction / openDeals : 0,
          followUpDisciplineRate: open > 0 ? 1 - (overdue / open) : 1,
        },
        ownerCoverageSummary: ownerCoverage.get(ownerUserId) ?? {
          ownedAccounts: 0,
          activeAccounts30d: 0,
          inactiveAccounts90d: 0,
          lowPenetrationAccounts: 0,
          criticalCoverageRiskAccounts: 0,
          accountsWithSingleContactDependency: 0,
        },
        coachingSignals: signals,
      };
    });

    let out = scorecards;
    if (params.ownerUserId) out = out.filter(s => s.ownerUserId === params.ownerUserId);
    if (typeof params.hasOverdueFollowUps === 'boolean') out = out.filter(s => (s.followUpMetrics.overdue > 0) === params.hasOverdueFollowUps);
    if (typeof params.hasCriticalDeals === 'boolean') out = out.filter(s => (s.dealMetrics.criticalDeals > 0) === params.hasCriticalDeals);
    if (typeof params.hasDealsNeedingReview === 'boolean') out = out.filter(s => (s.forecastMetrics.dealsNeedingManagementReview > 0) === params.hasDealsNeedingReview);
    if (params.activeOnly) out = out.filter(s => s.dealMetrics.openDeals > 0 || s.interactionMetrics.total30d > 0);
    if (params.q?.trim()) {
      const q = params.q.toLowerCase();
      out = out.filter(s =>
        s.ownerUserId.toLowerCase().includes(q) ||
        (s.ownerName ?? '').toLowerCase().includes(q),
      );
    }
    return out;
  }

  async build(
    db: Db,
    ctx: TenantContext,
    ownerUserId: string,
    days = 30,
  ) {
    const rows = await this.list(db, ctx, { ownerUserId, days });
    return rows[0] ?? null;
  }
}

export const repScorecardService = new RepScorecardService();
