// packages/api/src/routes/dashboard.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { getDB } from '../config/db.js';
import { interactionService } from '../services/InteractionService.js';
import { dealService } from '../services/DealService.js';
import { repScorecardService } from '../services/RepScorecardService.js';
import { accountPenetrationService } from '../services/AccountPenetrationService.js';
import { accountExpansionService } from '../services/AccountExpansionService.js';
import { buildService } from '../services/BuildService.js';
import { productionJobService } from '../services/ProductionJobService.js';
import { deliveryService } from '../services/DeliveryService.js';

const router = Router();

// management, admin, sup_admin all reach this; tenancy scoping is handled by resolveTenant
router.use(requireAuth, requireRole('super_admin', 'admin', 'management', 'sales'), resolveTenant);

router.get('/stats', async (req, res, next) => {
  try {
    const db  = getDB();
    const ctx = req.tenant;

    const [leadsByStatus, dealsByStatus, leadCounts, dealCounts, followUpOverdueOpen, dueTodayActions, staleCompanies, noActivityCompanies, forecast, scorecards, accountCoverageCounts, expansionCounts, ownerExpansionSummary, buildEconomicsCounts, productionCounts, deliveryCounts, deliveryHandoffCounts] = await Promise.all([
      LeadRepository.statusCounts(db, ctx),
      DealRepository.statusCounts(db, ctx),
      LeadRepository.dashboardCounts(db, ctx),
      DealRepository.dashboardCounts(db, ctx),
      interactionService.countOverdueOpen(db, ctx),
      interactionService.countDueTodayOpen(db, ctx),
      interactionService.countStaleCompanies(db, ctx, 14),
      interactionService.countNoActivityCompanies(db, ctx),
      dealService.getForecastStats(db, ctx),
      repScorecardService.list(db, ctx, { activeOnly: true, days: 30 }),
      accountPenetrationService.coverageCounts(db, ctx),
      accountExpansionService.expansionCounts(db, ctx),
      accountExpansionService.ownerExpansionSummary(db, ctx),
      buildService.economicsCounts(db, ctx),
      productionJobService.counts(db, ctx),
      deliveryService.counts(db, ctx),
      deliveryService.handoffCounts(db, ctx),
    ]);
    const rows = forecast.rows as Array<{ dealExecutionState?: { pressureLevel?: string; isStalled?: boolean; daysSinceLastInteraction?: number; overdueFollowUps?: number } }>;
    const dealPressureCounts = {
      critical: rows.filter(r => r.dealExecutionState?.pressureLevel === 'critical').length,
      high: rows.filter(r => r.dealExecutionState?.pressureLevel === 'high').length,
      medium: rows.filter(r => r.dealExecutionState?.pressureLevel === 'medium').length,
      low: rows.filter(r => r.dealExecutionState?.pressureLevel === 'low').length,
    };
    const criticalDeals = dealPressureCounts.critical;
    const highPressureDeals = dealPressureCounts.high;
    const stalledDeals = rows.filter(r => r.dealExecutionState?.isStalled).length;
    const dealsWithoutRecentActivity = rows.filter(r => (r.dealExecutionState?.daysSinceLastInteraction ?? 999) > 7).length;
    const dealsWithOverdueFollowUps = rows.filter(r => (r.dealExecutionState?.overdueFollowUps ?? 0) > 0).length;

    res.json({
      leadsByStatus,
      dealsByStatus,
      followUpOverdueOpen,
      overdueActions: followUpOverdueOpen,
      dueTodayActions,
      staleCompanies,
      noActivityCompanies,
      criticalDeals,
      highPressureDeals,
      stalledDeals,
      dealsWithoutRecentActivity,
      dealsWithOverdueFollowUps,
      dealPressureCounts,
      forecastCounts: forecast.forecastCounts,
      forecastAmounts: forecast.forecastAmounts,
      dealsNeedingManagementReview: forecast.dealsNeedingManagementReview,
      lowConfidenceLateStageDeals: forecast.lowConfidenceLateStageDeals,
      commitAmount: forecast.forecastAmounts.commit,
      bestCaseAmount: forecast.forecastAmounts.best_case,
      excludedAmount: forecast.forecastAmounts.excluded,
      ownerBreakdown: scorecards.map(s => ({
        ownerUserId: s.ownerUserId,
        ownerName: s.ownerName,
        openDeals: s.dealMetrics.openDeals,
        criticalDeals: s.dealMetrics.criticalDeals,
        overdueFollowUps: s.followUpMetrics.overdue,
        commitAmount: s.forecastMetrics.commitAmount,
        bestCaseAmount: s.forecastMetrics.bestCaseAmount,
        excludedAmount: s.forecastMetrics.excludedAmount,
        dealsNeedingManagementReview: s.forecastMetrics.dealsNeedingManagementReview,
        ownerCoverageSummary: s.ownerCoverageSummary,
        ownerExpansionSummary: ownerExpansionSummary.get(s.ownerUserId) ?? {
          highReadinessAccounts: 0,
          urgentPlanningAccounts: 0,
          accountsWithoutPlan: 0,
        },
      })),
      accountCoverageCounts,
      accountExpansionCounts: expansionCounts,
      buildEconomicsCounts,
      changeOrderCounts: {
        pendingApproval: buildEconomicsCounts.pendingChangeOrders ?? 0,
        approvedRecently: buildEconomicsCounts.approvedChangeOrdersRecently ?? 0,
        rejected: buildEconomicsCounts.rejectedChangeOrders ?? 0,
        buildsWithUnapprovedChanges: buildEconomicsCounts.buildsWithUnapprovedChanges ?? 0,
      },
      productionCounts,
      deliveryCounts,
      deliveryHandoffCounts,
      shopExecutionCounts: productionCounts.shopExecutionCounts ?? {
        activeJobs: 0,
        blockedJobs: 0,
        jobsWithNoStartedTasks: 0,
        jobsNearCompletion: 0,
      },
      staleLeads: {
        total:        leadCounts.staleTotal,
        newUntouched: leadCounts.newUntouched,
      },
      staleDeals: {
        total:             dealCounts.staleTotal,
        pendingApproval:   dealCounts.pendingApprovalStale,
      },
      unassignedLeads: leadCounts.unassigned,
      unassignedDeals: dealCounts.unassigned,
    });
  } catch (err) { next(err); }
});

export default router;
