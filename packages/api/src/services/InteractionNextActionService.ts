import type { InteractionDoc } from '../repositories/InteractionRepository.js';

export type NextActionType = 'call' | 'follow_up' | 'quote' | 'visit' | 'task';
export type NextActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NextAction {
  type: NextActionType;
  reason: string;
  dueAt: Date;
  priority: NextActionPriority;
}

export interface CompanyInteractionContext {
  lastInteractionAt?: Date;
  daysSinceLastInteraction?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

export class InteractionNextActionService {
  evaluate(
    interaction: InteractionDoc & { _id: string },
    companyContext: CompanyInteractionContext = {},
  ): NextAction | undefined {
    const now = new Date();
    const hasFollowUp = !!interaction.followUpAt && interaction.status === 'open';
    if (hasFollowUp) {
      const dueAt = new Date(interaction.followUpAt!);
      return {
        type: 'follow_up',
        reason: 'Open follow-up is scheduled for this interaction',
        dueAt,
        priority: dueAt.getTime() < now.getTime() ? 'urgent' : 'high',
      };
    }

    if (interaction.type === 'call' && interaction.outcome === 'no_answer') {
      return {
        type: 'call',
        reason: 'Last call had no answer and no follow-up was set',
        dueAt: addDays(new Date(interaction.createdAt), 1),
        priority: 'high',
      };
    }

    if (interaction.outcome === 'quote_sent') {
      return {
        type: 'follow_up',
        reason: 'Quote sent without a follow-up scheduled',
        dueAt: addDays(new Date(interaction.createdAt), 2),
        priority: 'high',
      };
    }

    if ((companyContext.daysSinceLastInteraction ?? 0) > STALE_DAYS) {
      return {
        type: 'follow_up',
        reason: `No interactions in ${companyContext.daysSinceLastInteraction} days`,
        dueAt: now,
        priority: 'medium',
      };
    }

    if ((interaction.attachments?.length ?? 0) > 0) {
      return {
        type: 'task',
        reason: 'Attachment added without follow-up; review and log next step',
        dueAt: addDays(new Date(interaction.createdAt), 1),
        priority: 'medium',
      };
    }

    return undefined;
  }
}

export const interactionNextActionService = new InteractionNextActionService();
