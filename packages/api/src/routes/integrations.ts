// packages/api/src/routes/integrations.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { mailchimpService } from '../services/MailchimpService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/mailchimp/status', requireRole('super_admin', 'admin', 'management'), (_req, res) => {
  res.json(mailchimpService.getStatus());
});

router.post('/mailchimp/sync-lead/:leadId', requireRole('super_admin', 'admin', 'management'), async (req, res, next) => {
  try {
    const tags = Array.isArray(req.body?.tags) ? (req.body.tags as string[]) : [];
    const result = await mailchimpService.syncLead(getDB(), req.tenant, req.params['leadId']!, tags);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
