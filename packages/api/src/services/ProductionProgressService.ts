import type { ProductionJobDoc } from '../repositories/ProductionJobRepository.js';
import type { ProductionTaskDoc } from '../repositories/ProductionTaskRepository.js';

export interface ProductionProgressSummary {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  percentComplete?: number;
  hasBlockedWork: boolean;
  progressRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  progressRiskReasons: string[];
  jobsWithNoStartedTasks?: number;
  jobsNearCompletion?: number;
}

export class ProductionProgressService {
  evaluate(job: ProductionJobDoc & { _id: string }, tasks: Array<ProductionTaskDoc & { _id: string }>): ProductionProgressSummary {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const startedTasks = tasks.filter(t => t.startedAt || ['in_progress', 'blocked', 'completed'].includes(t.status)).length;
    const hasBlockedWork = blockedTasks > 0;
    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : undefined;
    const reasons: string[] = [];
    let level: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    const setLevel = (next: 'low' | 'medium' | 'high' | 'critical') => {
      const rank = { low: 0, medium: 1, high: 2, critical: 3 };
      if (rank[next] > rank[level]) level = next;
    };
    const ageDays = Math.floor((Date.now() - new Date(job.updatedAt).getTime()) / (24 * 60 * 60 * 1000));

    if (job.status === 'in_progress' && blockedTasks >= Math.max(1, Math.floor(totalTasks / 2))) {
      setLevel('critical');
      reasons.push('In-progress job has blocked tasks');
    }
    if (job.status === 'paused' && blockedTasks > 0) {
      setLevel('critical');
      reasons.push('Paused job still has blocked tasks');
    }
    if ((job.status === 'ready' || job.status === 'queued') && startedTasks === 0 && ageDays > 2) {
      setLevel('critical');
      reasons.push('Ready job has no started tasks');
    }
    if (job.status === 'in_progress' && blockedTasks > 0) {
      setLevel('high');
      reasons.push('Blocked task exists on active job');
    }
    const inspectionTask = tasks.find(t => t.category === 'inspection' || t.category === 'final');
    if (inspectionTask && inspectionTask.status === 'not_started' && tasks.some(t => t.category !== 'inspection' && t.category !== 'final' && t.status !== 'completed')) {
      setLevel('high');
      reasons.push('Inspection cannot begin because upstream tasks remain incomplete');
    }
    if (job.status === 'in_progress' && inProgressTasks === 0 && blockedTasks === 0 && ageDays > 3) {
      setLevel('high');
      reasons.push('Job progress appears stalled');
    }
    if (level === 'medium' && totalTasks > 0 && completedTasks < totalTasks) {
      reasons.push('Some tasks remain incomplete but work is moving');
    }
    if (blockedTasks === 0 && ((percentComplete ?? 0) >= 40 || inProgressTasks > 0) && job.status !== 'paused') {
      level = 'low';
      reasons.push('Task flow is progressing without blockers');
    }
    return {
      totalTasks,
      completedTasks,
      blockedTasks,
      inProgressTasks,
      percentComplete,
      hasBlockedWork,
      progressRiskLevel: level,
      progressRiskReasons: Array.from(new Set(reasons)),
      jobsWithNoStartedTasks: startedTasks === 0 ? 1 : 0,
      jobsNearCompletion: (percentComplete ?? 0) >= 80 && job.status !== 'completed' ? 1 : 0,
    };
  }
}

export const productionProgressService = new ProductionProgressService();
