// packages/api/src/routes/admin.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { adminService } from '../services/AdminService.js';
import { getDB } from '../config/db.js';
import { CreateUserSchema } from '@mtte-core/shared';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'admin'));

router.get('/users', async (_req, res, next) => {
  try {
    res.json(await adminService.listUsers(getDB()));
  } catch (err) { next(err); }
});

router.post('/users', validate(CreateUserSchema), async (req, res, next) => {
  try {
    res.status(201).json(await adminService.createUser(getDB(), req.body));
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    await adminService.deactivateUser(getDB(), req.params['id']!);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/stats', async (_req, res, next) => {
  try {
    res.json(await adminService.stats(getDB()));
  } catch (err) { next(err); }
});

router.get('/sync-status', async (_req, res, next) => {
  try {
    res.json(await adminService.syncStatus(getDB()));
  } catch (err) { next(err); }
});

export default router;
