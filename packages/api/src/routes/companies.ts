// packages/api/src/routes/companies.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { companyService } from '../services/CompanyService.js';
import { activityService } from '../services/ActivityService.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

// ── GET /api/companies ────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      source,
      page  = '1',
      limit = '25',
      sort  = 'name',
      order = 'asc',
    } = req.query as Record<string, string>;

    const result = await companyService.list(
      getDB(),
      req.tenant,
      { search, source },
      { page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/companies/search  (MUST be before /:id) ─────────────
router.get('/search', async (req, res, next) => {
  try {
    const { q = '', limit = '10' } = req.query as Record<string, string>;
    if (!q.trim()) return res.json([]);
    const results = await companyService.search(getDB(), req.tenant, q.trim(), Math.min(+limit, 20));
    res.json(results);
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id ────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await companyService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) { next(err); }
});

// ── GET /api/companies/:id/activities ────────────────────────────
router.get('/:id/activities', async (req, res, next) => {
  try {
    const {
      page  = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    // Verify company exists within this tenant before returning its activities
    await companyService.getById(getDB(), req.tenant, req.params['id']!);

    const result = await activityService.listForCompany(
      getDB(),
      req.tenant,
      req.params['id']!,
      { page: +page, limit: Math.min(+limit, 100), sort: 'createdAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
