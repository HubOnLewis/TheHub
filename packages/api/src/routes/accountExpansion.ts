import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { accountExpansionService } from '../services/AccountExpansionService.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin', 'management', 'sales'), resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const {
      ownerUserId,
      expansionReadiness,
      planningPriority,
      hasPlan,
      hasOpenPipeline,
      hasBlockers,
      q,
    } = req.query as Record<string, string>;
    const rows = await accountExpansionService.list(getDB(), req.tenant, {
      ownerUserId: ownerUserId || undefined,
      expansionReadiness: expansionReadiness as 'low' | 'medium' | 'high' | undefined,
      planningPriority: planningPriority as 'low' | 'medium' | 'high' | 'urgent' | undefined,
      hasPlan: hasPlan === '1' || hasPlan === 'true' ? true : hasPlan === '0' || hasPlan === 'false' ? false : undefined,
      hasOpenPipeline: hasOpenPipeline === '1' || hasOpenPipeline === 'true' ? true : hasOpenPipeline === '0' || hasOpenPipeline === 'false' ? false : undefined,
      hasBlockers: hasBlockers === '1' || hasBlockers === 'true' ? true : hasBlockers === '0' || hasBlockers === 'false' ? false : undefined,
      q: q || undefined,
    });
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
