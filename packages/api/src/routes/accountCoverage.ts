import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { accountPenetrationService } from '../services/AccountPenetrationService.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin', 'management'), resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const {
      ownerUserId,
      penetrationLevel,
      coverageRiskLevel,
      hasOpenDeals,
      hasOverdueFollowUps,
      hasWhitespace,
      q,
    } = req.query as Record<string, string>;
    const rows = await accountPenetrationService.list(getDB(), req.tenant, {
      ownerUserId: ownerUserId || undefined,
      penetrationLevel: penetrationLevel as 'low' | 'medium' | 'high' | undefined,
      coverageRiskLevel: coverageRiskLevel as 'low' | 'medium' | 'high' | 'critical' | undefined,
      hasOpenDeals: hasOpenDeals === '1' || hasOpenDeals === 'true'
        ? true
        : hasOpenDeals === '0' || hasOpenDeals === 'false'
          ? false
          : undefined,
      hasOverdueFollowUps: hasOverdueFollowUps === '1' || hasOverdueFollowUps === 'true'
        ? true
        : hasOverdueFollowUps === '0' || hasOverdueFollowUps === 'false'
          ? false
          : undefined,
      hasWhitespace: hasWhitespace === '1' || hasWhitespace === 'true'
        ? true
        : hasWhitespace === '0' || hasWhitespace === 'false'
          ? false
          : undefined,
      q: q || undefined,
    });
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
