// packages/api/src/routes/dashboard.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { getDB } from '../config/db.js';

const router = Router();

// management, admin, sup_admin all reach this; tenancy scoping is handled by resolveTenant
router.use(requireAuth, requireRole('super_admin', 'admin', 'management'), resolveTenant);

router.get('/stats', async (req, res, next) => {
  try {
    const db  = getDB();
    const ctx = req.tenant;

    const [leadsByStatus, dealsByStatus, leadCounts, dealCounts] = await Promise.all([
      LeadRepository.statusCounts(db, ctx),
      DealRepository.statusCounts(db, ctx),
      LeadRepository.dashboardCounts(db, ctx),
      DealRepository.dashboardCounts(db, ctx),
    ]);

    res.json({
      leadsByStatus,
      dealsByStatus,
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
