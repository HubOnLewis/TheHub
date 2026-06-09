// packages/api/src/routes/interactions.ts
import { Router, type Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import { ObjectId } from 'mongodb';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { interactionService } from '../services/InteractionService.js';
import { CreateInteractionRequestSchema, PatchInteractionRequestSchema } from '@hub-crm/shared';
import { attachmentStorageService } from '../services/storage/AttachmentStorageService.js';
const router = Router();
router.use(requireAuth, resolveTenant);

const tenantKey = (req: Request) =>
  (req.tenant.tenantId ?? 'global').replace(/[^a-z0-9-_]/gi, '_');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function fileAttachmentType(mimetype: string, originalname: string): 'image' | 'document' {
  if (mimetype.startsWith('image/')) return 'image';
  const ext = path.extname(originalname).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic'].includes(ext)) return 'image';
  return 'document';
}

// GET /api/interactions/follow-ups  (MUST be before /:id)
router.get('/my-work', async (req, res, next) => {
  try {
    const {
      ownerUserId,
      q,
      page = '1',
      limit = '100',
    } = req.query as Record<string, string>;
    const out = await interactionService.getMyWork(
      getDB(),
      req.tenant,
      {
        ownerUserId: ownerUserId || undefined,
        q: q?.trim() || undefined,
        page: +page,
        limit: Math.min(+limit, 200),
      },
    );
    res.json(out);
  } catch (e) { next(e); }
});

// GET /api/interactions/follow-ups  (MUST be before /:id)
router.get('/follow-ups', async (req, res, next) => {
  try {
    const {
      mine  = '1',
      page  = '1',
      limit = '50',
      ownerUserId,
      overdueOnly = '0',
      status,
      q,
    } = req.query as Record<string, string>;
    const out = await interactionService.listFollowUps(
      getDB(),
      req.tenant,
      {
        mine: mine === '1' || mine === 'true',
        ownerUserId: ownerUserId || undefined,
        overdueOnly: overdueOnly === '1' || overdueOnly === 'true',
        status: status === 'completed' ? 'completed' : status === 'open' ? 'open' : undefined,
        q: q?.trim() || undefined,
      },
      { page: +page, limit: Math.min(+limit, 100), sort: 'followUpAt', order: 'asc' },
    );
    res.json(out);
  } catch (e) { next(e); }
});

router.post('/', validate(CreateInteractionRequestSchema), async (req, res, next) => {
  try {
    const out = await interactionService.create(getDB(), req.tenant, req.body);
    res.status(201).json(out);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const out = await interactionService.getById(getDB(), req.tenant, req.params['id']!);
    res.json(out);
  } catch (e) { next(e); }
});

router.patch('/:id', validate(PatchInteractionRequestSchema), async (req, res, next) => {
  try {
    const out = await interactionService.update(
      getDB(), req.tenant, req.params['id']!, req.body,
    );
    res.json(out);
  } catch (e) { next(e); }
});

router.post(
  '/:id/attachments',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const id = req.params['id']!;
      const f  = req.file;
      if (!f) {
        res.status(422).json({ error: 'Validation failed', issues: { file: ['File required (field name: file)'] } });
        return;
      }
      const key   = tenantKey(req);
      const type    = fileAttachmentType(f.mimetype, f.originalname);
      const attId   = new ObjectId().toString();
      const now     = new Date();
      const stored  = await attachmentStorageService.save({ tenantKey: key, interactionId: id, file: f });

      const out = await interactionService.addAttachment(
        getDB(), req.tenant, id, {
        id:         attId,
        type,
        url:        stored.url,
        fileName:   stored.fileName,
        mimeType:   stored.mimeType,
        sizeBytes:  stored.sizeBytes,
        originalFileName: stored.originalFileName,
        storageKey: stored.storageKey,
        uploadedByUserId: req.tenant.userId,
        uploadedByName: req.tenant.userName,
        uploadedAt: now,
      });
      res.status(201).json(out);
    } catch (e) { next(e); }
  },
);

router.delete('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const interactionId = req.params['id']!;
    const attachmentId = req.params['attachmentId']!;
    const { updated, removedAttachment } = await interactionService.removeAttachment(
      getDB(),
      req.tenant,
      interactionId,
      attachmentId,
    );
    await attachmentStorageService.remove(removedAttachment.storageKey);
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
