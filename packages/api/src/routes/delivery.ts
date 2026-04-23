import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import {
  CreateDeliveryRecordSchema,
  PatchDeliveryRecordSchema,
  PatchCloseoutChecklistSchema,
  CreateDeliveryPacketSchema,
  PatchDeliveryPacketSchema,
  CreatePostDeliveryFollowUpSchema,
  PatchPostDeliveryFollowUpSchema,
} from '@mtte-core/shared';
import { getDB } from '../config/db.js';
import { deliveryService } from '../services/DeliveryService.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { status, productionJobId, buildId, companyId, q, page = '1', limit = '100', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    res.json(await deliveryService.list(getDB(), req.tenant, {
      status: status as any,
      productionJobId: productionJobId || undefined,
      buildId: buildId || undefined,
      companyId: companyId || undefined,
      q: q || undefined,
    }, { page: +page, limit: Math.min(+limit, 200), sort, order: order as 'asc' | 'desc' }));
  } catch (err) { next(err); }
});

router.get('/production-job/:productionJobId/closeout', async (req, res, next) => {
  try {
    res.json(await deliveryService.getOrCreateCloseout(getDB(), req.tenant, req.params['productionJobId']!));
  } catch (err) { next(err); }
});

router.patch('/production-job/:productionJobId/closeout', validate(PatchCloseoutChecklistSchema), async (req, res, next) => {
  try {
    res.json(await deliveryService.updateCloseout(getDB(), req.tenant, req.params['productionJobId']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/packet', async (req, res, next) => {
  try {
    const packet = await deliveryService.getPacket(getDB(), req.tenant, req.params['id']!);
    res.json(packet);
  } catch (err) { next(err); }
});

router.post('/:id/packet', validate(CreateDeliveryPacketSchema), async (req, res, next) => {
  try {
    res.status(201).json(await deliveryService.createPacket(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id/packet', validate(PatchDeliveryPacketSchema), async (req, res, next) => {
  try {
    res.json(await deliveryService.updatePacket(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id/post-delivery-follow-ups', async (req, res, next) => {
  try {
    res.json(await deliveryService.listPostDeliveryFollowUps(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/:id/post-delivery-follow-ups', validate(CreatePostDeliveryFollowUpSchema), async (req, res, next) => {
  try {
    res.status(201).json(await deliveryService.createPostDeliveryFollowUp(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

router.patch('/follow-ups/:followUpId', validate(PatchPostDeliveryFollowUpSchema), async (req, res, next) => {
  try {
    res.json(await deliveryService.updatePostDeliveryFollowUp(getDB(), req.tenant, req.params['followUpId']!, req.body));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await deliveryService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

router.post('/', validate(CreateDeliveryRecordSchema), async (req, res, next) => {
  try {
    res.status(201).json(await deliveryService.create(getDB(), req.tenant, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', validate(PatchDeliveryRecordSchema), async (req, res, next) => {
  try {
    res.json(await deliveryService.update(getDB(), req.tenant, req.params['id']!, req.body));
  } catch (err) { next(err); }
});

export default router;
