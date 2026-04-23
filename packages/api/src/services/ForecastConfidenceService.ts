import type { DealDoc } from '../repositories/DealRepository.js';
import type { InteractionDoc } from '../repositories/InteractionRepository.js';
import type { DealExecutionState } from './DealPressureService.js';

export type ForecastConfidence = 'low' | 'medium' | 'high';
export type ForecastCategory = 'commit' | 'best_case' | 'pipeline' | 'excluded';

export interface ForecastState {
  confidence: ForecastConfidence;
  confidenceReasons: string[];
  forecastCategory: ForecastCategory;
  forecastAmount?: number;
  needsManagementReview: boolean;
  reviewReasons: string[];
}

const LATE_STAGES = new Set(['Approved', 'Won', 'In Build']);
const OPEN_STATUSES = new Set(['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build']);

export class ForecastConfidenceService {
  evaluate(
    deal: DealDoc & { _id: string },
    execution: DealExecutionState,
    pipelineWarnings: string[],
    interactions: Array<InteractionDoc & { _id: string }>,
    builds: Array<{ specItems: Array<unknown> }> = [],
  ): ForecastState {
    const reasons: string[] = [];
    let confidence: ForecastConfidence = 'medium';

    const hasInteractionEver = interactions.length > 0;
    const hasRecent = (execution.daysSinceLastInteraction ?? 999) <= 7;
    const hasOverdue = execution.overdueFollowUps > 0;
    const hasNextAction = !!execution.nextActionSummary;
    const isAtRisk = !!deal.atRisk?.flagged;
    const criticalPressure = execution.pressureLevel === 'critical';
    const highPressure = execution.pressureLevel === 'high';
    const isOpen = OPEN_STATUSES.has(deal.status);
    const hasBuild = builds.length > 0;
    const hasStructuredSpec = builds.some(b => (b.specItems ?? []).length > 0);
    const hasSubstitutionRisk = builds.some(b => ((b.specItems ?? []) as Array<any>).some(x => x?.substitution && x?.unitCostEstimate == null && x?.extendedCostEstimate == null));
    const hasIncompleteBuildFinancials = builds.some(b => ((b.specItems ?? []) as Array<any>).some(x => x?.unitCostEstimate == null || x?.unitSellPrice == null));

    if (!hasInteractionEver) reasons.push('No linked interactions exist for this open deal');
    if (!hasRecent) reasons.push(`No recent interaction in ${execution.daysSinceLastInteraction ?? 'N/A'} days`);
    if (hasOverdue) reasons.push('Open follow-up is overdue');
    if (!hasNextAction) reasons.push('No clear next action is identified');
    if (!hasBuild) reasons.push('No build defined for this deal');
    if (hasBuild && !hasStructuredSpec) reasons.push('Build spec is incomplete');
    if (hasIncompleteBuildFinancials) reasons.push('Build financials are incomplete');
    if (hasSubstitutionRisk) reasons.push('Build substitutions introduce unvalidated cost exposure');
    if (isAtRisk) reasons.push('Deal marked at risk');
    if (criticalPressure) reasons.push('Critical pressure conflicts with forecast confidence');
    reasons.push(...pipelineWarnings.filter(w =>
      w.includes('no linked interactions') ||
      w.includes('no follow-up') ||
      w.includes('no interaction') ||
      w.includes('Stale'),
    ));

    if (
      isOpen &&
      hasInteractionEver &&
      hasRecent &&
      !hasOverdue &&
      hasNextAction &&
      !isAtRisk &&
      LATE_STAGES.has(deal.status) &&
      !criticalPressure
    ) {
      confidence = 'high';
    } else if (
      !isOpen ||
      !hasInteractionEver ||
      !hasRecent ||
      hasOverdue ||
      isAtRisk ||
      !hasBuild ||
      !hasStructuredSpec ||
      hasIncompleteBuildFinancials ||
      hasSubstitutionRisk ||
      criticalPressure ||
      highPressure
    ) {
      confidence = 'low';
    } else {
      confidence = 'medium';
    }

    let forecastCategory: ForecastCategory = 'pipeline';
    if (!isOpen || !hasInteractionEver || hasOverdue || isAtRisk || criticalPressure) {
      forecastCategory = 'excluded';
    } else if (
      confidence === 'high' &&
      !hasOverdue &&
      !isAtRisk &&
      LATE_STAGES.has(deal.status) &&
      !pipelineWarnings.some(w => w.toLowerCase().includes('stale'))
    ) {
      forecastCategory = 'commit';
    } else if ((confidence === 'high' || confidence === 'medium') && isOpen) {
      forecastCategory = 'best_case';
    } else if (isOpen) {
      forecastCategory = 'pipeline';
    }

    const reviewReasons: string[] = [];
    if (forecastCategory === 'commit' && !hasRecent) reviewReasons.push(`Commit-stage deal has no interaction in ${execution.daysSinceLastInteraction} days`);
    if (isAtRisk) reviewReasons.push('Deal marked at risk');
    if (hasOverdue) reviewReasons.push('Open follow-up is overdue');
    if (deal.status === 'Pending Approval' && !hasNextAction) reviewReasons.push('Proposal-stage deal has no scheduled next step');
    if (!hasBuild) reviewReasons.push('Forecasted deal has no defined build');
    if (hasBuild && !hasStructuredSpec) reviewReasons.push('Build spec is incomplete for forecasted deal');
    if (hasIncompleteBuildFinancials) reviewReasons.push('Build financials are incomplete for forecasted deal');
    if (hasSubstitutionRisk) reviewReasons.push('Substitutions have unvalidated replacement costs');
    if (!hasInteractionEver) reviewReasons.push('No linked interactions exist for this open deal');
    if (criticalPressure) reviewReasons.push('Critical pressure conflicts with forecast category');
    if ((forecastCategory === 'best_case' || forecastCategory === 'commit') && !hasNextAction) {
      reviewReasons.push(`${forecastCategory === 'commit' ? 'Commit' : 'Best-case'} candidate has no next action`);
    }
    if (isOpen && !deal.ownerUserId) reviewReasons.push('Open deal has no ownerUserId');
    if ((forecastCategory === 'best_case' || forecastCategory === 'pipeline') && confidence !== 'high' && !deal.managementReview?.reviewedAt) {
      reviewReasons.push('Forecast-included deal has no management review');
    }

    const needsManagementReview = reviewReasons.length > 0 || confidence === 'low';

    return {
      confidence,
      confidenceReasons: Array.from(new Set(reasons)),
      forecastCategory,
      forecastAmount: typeof deal.amount === 'number' ? deal.amount : 0,
      needsManagementReview,
      reviewReasons: Array.from(new Set(reviewReasons)),
    };
  }
}

export const forecastConfidenceService = new ForecastConfidenceService();
