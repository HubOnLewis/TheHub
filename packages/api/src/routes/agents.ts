import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { agentService } from '../services/AgentService.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

const DecideSchema = z.object({
  findingId: z.string().min(1),
  decision: z.enum(['approve', 'dismiss']),
});

router.get('/snapshot', async (req, res, next) => {
  try {
    res.json(await agentService.latest(getDB(), req.tenant));
  } catch (err) {
    next(err);
  }
});

router.post('/evaluate', async (req, res, next) => {
  try {
    const withLlm = req.query.llm !== '0';
    res.json(await agentService.evaluate(getDB(), req.tenant, { withLlm }));
  } catch (err) {
    next(err);
  }
});

router.post('/approvals', validate(DecideSchema), async (req, res, next) => {
  try {
    const { findingId, decision } = req.body as z.infer<typeof DecideSchema>;
    res.json(await agentService.decide(getDB(), req.tenant, findingId, decision));
  } catch (err) {
    next(err);
  }
});

export default router;
