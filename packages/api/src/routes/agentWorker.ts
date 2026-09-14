// packages/api/src/routes/agentWorker.ts
/**
 * Outbound companion worker surface.
 * Auth: HUB_AGENT_READ_TOKEN only. May claim/complete jobs + heartbeat.
 * May NOT mutate CRM leads/deals/payments/users.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAgentReadToken } from '../middleware/agentReadAuth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { getDB } from '../config/db.js';
import { aiJobService } from '../services/AiJobService.js';
import { ForbiddenError } from '../errors/index.js';

const router = Router();
router.use(requireAgentReadToken, resolveTenant);

const NodeSchema = z.object({
  nodeId: z.string().min(1).max(120),
});

const HeartbeatSchema = NodeSchema.extend({
  currentJobId: z.string().nullable().optional(),
  lastSuccessfulJobId: z.string().nullable().optional(),
  lastError: z.string().max(500).nullable().optional(),
  runtime: z
    .object({
      agentRuntime: z.string().optional(),
      ollamaOk: z.boolean().optional(),
      models: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
});

const CompleteSchema = NodeSchema.extend({
  result: z.unknown(),
  runtimeMetadata: z
    .object({
      nodeId: z.string().optional(),
      model: z.string().nullable().optional(),
      durationMs: z.number().optional(),
      agentRuntime: z.string().optional(),
      ollamaOk: z.boolean().optional(),
      attemptNote: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const FailSchema = NodeSchema.extend({
  error: z.string().min(1).max(2000),
  runtimeMetadata: CompleteSchema.shape.runtimeMetadata,
});

const EnqueueSchema = z.object({
  agent: z.enum([
    'lead-intelligence',
    'event-operations',
    'follow-up-drafting',
    'daily-briefing',
    'data-quality',
  ]),
  recordType: z.enum(['lead', 'event', 'none']),
  recordId: z.string().min(1).optional().nullable(),
  taskType: z
    .enum(['analyze_lead', 'analyze_event', 'draft_follow_up', 'daily_briefing', 'data_quality_scan'])
    .optional(),
  input: z.record(z.unknown()).optional(),
});

router.get('/health', async (req, res, next) => {
  try {
    const status = await aiJobService.workerStatus(getDB(), req.tenant);
    res.json({ status: 'ok', surface: 'agent-worker', worker: status });
  } catch (err) {
    next(err);
  }
});

/** Machine may enqueue jobs for its tenant (onsite proof / automation). */
router.post('/jobs', validate(EnqueueSchema), async (req, res, next) => {
  try {
    const job = await aiJobService.create(getDB(), req.tenant, req.body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    res.json(await aiJobService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.post('/heartbeat', validate(HeartbeatSchema), async (req, res, next) => {
  try {
    const row = await aiJobService.heartbeat(getDB(), req.tenant, req.body);
    res.json({ ok: true, lastHeartbeatAt: row?.lastHeartbeatAt ?? null });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/next', async (req, res, next) => {
  try {
    const nodeId = String(req.query.nodeId || '').trim();
    if (!nodeId) {
      res.status(422).json({ error: 'nodeId query required' });
      return;
    }
    const claimed = await aiJobService.claimNext(getDB(), req.tenant, nodeId);
    if (!claimed) {
      res.status(204).end();
      return;
    }
    const raw = await aiJobService.getRaw(getDB(), req.tenant, claimed.id);
    res.json({
      ...claimed,
      input: raw?.input ?? {},
    });
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/claim', validate(NodeSchema), async (req, res, next) => {
  try {
    // Prefer /jobs/next atomic claim; this marks running after local fetch.
    const job = await aiJobService.markRunning(getDB(), req.tenant, req.params['id']!, req.body.nodeId);
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/complete', validate(CompleteSchema), async (req, res, next) => {
  try {
    const job = await aiJobService.complete(
      getDB(),
      req.tenant,
      req.params['id']!,
      req.body.nodeId,
      req.body.result,
      req.body.runtimeMetadata ?? null,
    );
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/fail', validate(FailSchema), async (req, res, next) => {
  try {
    const job = await aiJobService.fail(
      getDB(),
      req.tenant,
      req.params['id']!,
      req.body.nodeId,
      req.body.error,
      req.body.runtimeMetadata ?? null,
    );
    res.json(job);
  } catch (err) {
    next(err);
  }
});

/** Explicitly deny CRM mutation aliases under worker. */
router.all('/leads*', (_req, _res, next) => next(new ForbiddenError('Worker cannot mutate CRM')));
router.all('/deals*', (_req, _res, next) => next(new ForbiddenError('Worker cannot mutate CRM')));
router.all('/admin*', (_req, _res, next) => next(new ForbiddenError('Worker cannot access admin')));

export default router;
