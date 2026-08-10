// packages/api/src/routes/ai.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { aiService } from '../services/AiService.js';

const router = Router();

const enhanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — try again in a minute' },
  skip: req => req.method === 'OPTIONS',
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI chat requests — try again in a minute' },
  skip: req => req.method === 'OPTIONS',
});

const EnhanceSchema = z.object({
  kind: z.enum(['summary', 'rewrite', 'concierge_reply', 'inbox_reply', 'follow_up', 'owner_note']),
  input: z.string().min(1).max(12_000),
  context: z.string().max(8_000).optional(),
  systemHint: z.string().max(2_000).optional(),
});

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(12_000),
      }),
    )
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(4096).optional(),
});

router.use(requireAuth, resolveTenant);

/** Connection status — no probe by default (fast for Settings UI). */
router.get('/status', async (req, res, next) => {
  try {
    const probe = req.query.probe === '1' || req.query.probe === 'true';
    const status = await aiService.getStatus({ probe });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/** Explicit connectivity check to the model PC / provider. */
router.post(
  '/probe',
  requireRole('super_admin', 'admin', 'management'),
  async (_req, res, next) => {
    try {
      const reachable = await aiService.probe();
      const status = await aiService.getStatus();
      res.json({ ...status, reachable });
    } catch (err) {
      next(err);
    }
  },
);

/** Draft / language enhancement — never mutates CRM records by itself. */
router.post('/enhance', enhanceLimiter, validate(EnhanceSchema), async (req, res, next) => {
  try {
    const result = await aiService.enhance(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Multi-turn chat (future Autopilot / concierge rails). */
router.post('/chat', chatLimiter, validate(ChatSchema), async (req, res, next) => {
  try {
    const result = await aiService.chat(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
