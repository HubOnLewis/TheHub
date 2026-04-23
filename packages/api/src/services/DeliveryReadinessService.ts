export interface DeliveryReadiness {
  isReady: boolean;
  readinessLevel: 'not_ready' | 'almost_ready' | 'ready';
  reasons: string[];
}

export class DeliveryReadinessService {
  evaluate(
    productionJob: { status: string },
    tasks: Array<{ status: string }>,
    closeout?: {
      finalInspectionComplete: boolean;
      customerFacingDocsComplete: boolean;
      photosComplete: boolean;
      punchItemsResolved: boolean;
      punchItems?: Array<{ status: 'open' | 'resolved' }>;
    } | null,
  ): DeliveryReadiness {
    const reasons: string[] = [];
    const incompleteTasks = tasks.filter(t => t.status !== 'completed').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    const openPunch = (closeout?.punchItems ?? []).filter(p => p.status === 'open').length;
    if (incompleteTasks > 0) reasons.push('Production tasks remain incomplete');
    if (blockedTasks > 0) reasons.push('Blocked shop work remains open');
    if (!closeout?.finalInspectionComplete) reasons.push('Final inspection not complete');
    if (!closeout?.punchItemsResolved || openPunch > 0) reasons.push('Punch items still unresolved');
    if (reasons.length === 0) reasons.push('Build is ready for delivery scheduling');
    const isReady = reasons.length === 1 && reasons[0] === 'Build is ready for delivery scheduling';
    let readinessLevel: 'not_ready' | 'almost_ready' | 'ready' = 'not_ready';
    if (isReady) readinessLevel = 'ready';
    else if (incompleteTasks === 0 && blockedTasks === 0) readinessLevel = 'almost_ready';
    return { isReady, readinessLevel, reasons };
  }
}

export const deliveryReadinessService = new DeliveryReadinessService();
