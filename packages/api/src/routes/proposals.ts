import { Router } from 'express';
import { CreateProposalSchema, PatchProposalSchema } from '@hub-crm/shared';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { proposalService } from '../services/ProposalService.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const eventId = String(req.query.eventId ?? '');
    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }
    res.json({ data: await proposalService.listForEvent(getDB(), req.tenant, eventId) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(CreateProposalSchema), async (req, res, next) => {
  try {
    res.status(201).json(await proposalService.create(getDB(), req.tenant, req.body));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(PatchProposalSchema), async (req, res, next) => {
  try {
    res.json(await proposalService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
