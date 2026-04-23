import type { DealDoc } from '../repositories/DealRepository.js';
import type { InteractionDoc } from '../repositories/InteractionRepository.js';
import { interactionNextActionService } from './InteractionNextActionService.js';

export type PressureLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DealExecutionState {
  lastInteractionAt?: string;
  daysSinceLastInteraction?: number;
  openFollowUps: number;
  overdueFollowUps: number;
  interactionCount30d: number;
  pressureLevel: PressureLevel;
  pressureReasons: string[];
  nextActionSummary?: string;
  isStalled: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_DEAL_STATUSES = new Set(['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build']);
const QUOTE_HINTS = new Set(['quote_sent']);
const QUOTE_STAGE_HINTS = new Set(['Pending Approval', 'Approved']);

function daysSince(d?: Date): number | undefined {
  if (!d) return undefined;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

export class DealPressureService {
  evaluate(
    deal: DealDoc & { _id: string },
    interactions: Array<InteractionDoc & { _id: string }>,
  ): DealExecutionState {
    const now = Date.now();
    const sorted = [...interactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = sorted[0];
    const lastInteractionAt = latest ? new Date(latest.createdAt) : undefined;
    const daysSinceLast = daysSince(lastInteractionAt);

    const openFollowUps = sorted.filter(i => i.status === 'open' && i.followUpAt).length;
    const overdueFollowUps = sorted.filter(i => i.status === 'open' && i.followUpAt && new Date(i.followUpAt).getTime() < now).length;
    const interactionCount30d = sorted.filter(i => new Date(i.createdAt).getTime() >= now - 30 * DAY_MS).length;
    const stageAgeDays = daysSince(deal.lastStageChangeAt ?? deal.updatedAt) ?? 0;
    const isOpen = OPEN_DEAL_STATUSES.has(deal.status);

    const reasons: string[] = [];
    let level: PressureLevel = 'low';
    const setLevel = (next: PressureLevel) => {
      const rank: Record<PressureLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      if (rank[next] > rank[level]) level = next;
    };

    if (isOpen && (daysSinceLast ?? 999) > 14) {
      setLevel('critical');
      reasons.push(`No interaction in ${daysSinceLast} days`);
    }
    if (overdueFollowUps > 0) {
      setLevel('critical');
      reasons.push('Open follow-up is overdue');
    }
    if (isOpen && stageAgeDays > 21 && (daysSinceLast ?? 999) > 7) {
      setLevel('critical');
      reasons.push(`Deal has remained in ${deal.status} stage for ${stageAgeDays} days with no recent interaction`);
    }
    if (isOpen && (daysSinceLast ?? 999) > 7) {
      setLevel('high');
      reasons.push(`No interaction in ${daysSinceLast} days`);
    }

    const quoteSent = sorted.some(i => QUOTE_HINTS.has(i.outcome));
    if ((quoteSent || QUOTE_STAGE_HINTS.has(deal.status)) && openFollowUps === 0) {
      setLevel('high');
      reasons.push('Quote/proposal activity exists but no follow-up is scheduled');
    }

    const nextAction = latest
      ? interactionNextActionService.evaluate(latest, { daysSinceLastInteraction: daysSinceLast })
      : undefined;
    if (interactionCount30d > 0 && !nextAction) {
      setLevel('high');
      reasons.push('Interaction activity exists but no clear next action is identified');
    }
    if (interactionCount30d > 0 && openFollowUps === 0) {
      setLevel('medium');
      reasons.push('Recent interaction exists but no scheduled follow-up');
    }
    if (stageAgeDays > 10) {
      setLevel('medium');
      reasons.push(`Deal has remained in ${deal.status} stage for ${stageAgeDays} days`);
    }
    if ((daysSinceLast ?? 999) <= 7 && openFollowUps > 0 && overdueFollowUps === 0 && nextAction) {
      level = 'low';
    }

    const isStalled = isOpen && ((daysSinceLast ?? 999) > 14 || stageAgeDays > 21);
    const nextActionSummary = nextAction ? `${nextAction.type}: ${nextAction.reason}` : undefined;

    return {
      lastInteractionAt: lastInteractionAt?.toISOString(),
      daysSinceLastInteraction: daysSinceLast,
      openFollowUps,
      overdueFollowUps,
      interactionCount30d,
      pressureLevel: level,
      pressureReasons: Array.from(new Set(reasons)),
      nextActionSummary,
      isStalled,
    };
  }

  buildWarnings(
    deal: DealDoc & { _id: string },
    interactions: Array<InteractionDoc & { _id: string }>,
    execution: DealExecutionState,
    builds: Array<{ status: string; specItems: Array<unknown> }> = [],
  ): string[] {
    const warnings: string[] = [];
    const hasLinkedInteractions = interactions.length > 0;
    const isOpen = OPEN_DEAL_STATUSES.has(deal.status);
    const stageAgeDays = daysSince(deal.lastStageChangeAt ?? deal.updatedAt) ?? 0;

    if (isOpen && !hasLinkedInteractions) warnings.push('Open deal has no linked interactions');
    if (isOpen && builds.length === 0) warnings.push('Build not defined for active deal');
    if ((deal.status === 'Pending Approval' || deal.status === 'Approved') && builds.length > 0 && !builds.some(b => (b.specItems ?? []).length > 0)) {
      warnings.push('Quoted deal has no structured spec');
    }
    if (builds.some(b => b.status === 'approved') && !builds.some(b => b.status === 'in_production' || b.status === 'completed')) {
      warnings.push('Build approved but not moving to production');
    }
    if (isOpen && builds.some(b => ((b.specItems ?? []) as Array<any>).some(x => x?.unitCostEstimate == null || x?.unitSellPrice == null))) {
      warnings.push('Active deal has incomplete build costing');
    }
    if (builds.some(b => ((b.specItems ?? []) as Array<any>).some(x => x?.substitution && x?.unitCostEstimate == null && x?.extendedCostEstimate == null))) {
      warnings.push('Build margin risk is high');
    }
    if ((deal.status === 'Pending Approval' || deal.status === 'Approved') && builds.some(b => ((b.specItems ?? []) as Array<any>).some(x => x?.unitCostEstimate == null || x?.unitSellPrice == null))) {
      warnings.push('Quoted build economics are not trusted');
    }
    if (isOpen && execution.openFollowUps === 0) warnings.push('Open deal has no follow-up scheduled');
    if (QUOTE_STAGE_HINTS.has(deal.status) && (execution.daysSinceLastInteraction ?? 999) > 7) warnings.push('Quote/proposal stage has no interaction in last 7 days');
    if (isOpen && stageAgeDays > 21) warnings.push('Stale open deal with no stage movement');
    if (!isOpen && execution.openFollowUps > 0) warnings.push('Deal is closed but still has open follow-ups');
    return warnings;
  }
}

export const dealPressureService = new DealPressureService();
