import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { repScorecardService } from '../services/RepScorecardService.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin', 'management'), resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const {
      ownerUserId,
      hasOverdueFollowUps,
      hasCriticalDeals,
      hasDealsNeedingReview,
      q,
      activeOnly = '1',
      days = '30',
    } = req.query as Record<string, string>;
    const rows = await repScorecardService.list(
      getDB(),
      req.tenant,
      {
        ownerUserId: ownerUserId || undefined,
        hasOverdueFollowUps: hasOverdueFollowUps === '1' || hasOverdueFollowUps === 'true'
          ? true
          : hasOverdueFollowUps === '0' || hasOverdueFollowUps === 'false'
            ? false
            : undefined,
        hasCriticalDeals: hasCriticalDeals === '1' || hasCriticalDeals === 'true'
          ? true
          : hasCriticalDeals === '0' || hasCriticalDeals === 'false'
            ? false
            : undefined,
        hasDealsNeedingReview: hasDealsNeedingReview === '1' || hasDealsNeedingReview === 'true'
          ? true
          : hasDealsNeedingReview === '0' || hasDealsNeedingReview === 'false'
            ? false
            : undefined,
        q: q || undefined,
        activeOnly: activeOnly === '1' || activeOnly === 'true',
        days: Math.max(1, Math.min(+days || 30, 365)),
      },
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:ownerUserId', async (req, res, next) => {
  try {
    const { days = '30' } = req.query as Record<string, string>;
    const row = await repScorecardService.build(
      getDB(),
      req.tenant,
      req.params['ownerUserId']!,
      Math.max(1, Math.min(+days || 30, 365)),
    );
    res.json(row);
  } catch (err) { next(err); }
});

export default router;
