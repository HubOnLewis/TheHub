import { Router } from 'express';
import { CreateOutboundMessageSchema } from '@hub-crm/shared';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { communicationsService, EMAIL_TEMPLATES } from '../services/CommunicationsService.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/inbox', async (req, res, next) => {
  try {
    res.json(await communicationsService.inbox(getDB(), req.tenant));
  } catch (err) {
    next(err);
  }
});

router.get('/templates', (_req, res) => {
  res.json({ data: EMAIL_TEMPLATES.map(t => ({ key: t.key, label: t.label, subject: t.subject })) });
});

router.get('/', async (req, res, next) => {
  try {
    const eventId = String(req.query.eventId ?? '');
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }
    res.json({ data: await communicationsService.threadForEvent(getDB(), req.tenant, eventId) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(CreateOutboundMessageSchema), async (req, res, next) => {
  try {
    const out = await communicationsService.postStaffMessage(getDB(), req.tenant, req.body);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
});

export default router;
