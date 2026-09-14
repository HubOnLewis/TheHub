// packages/api/src/routes/agentRead.ts
/**
 * READ-ONLY CRM surface for the local multi-agent runtime.
 * Auth: HUB_AGENT_READ_TOKEN (Bearer) — not a human staff JWT.
 *
 * Mounted at /api/agent-read — never expose write handlers here.
 */
import { Router } from 'express';
import { playbookFromImportMeta } from '@hub-crm/shared';
import { requireAgentReadToken, rejectNonGet } from '../middleware/agentReadAuth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { leadService } from '../services/LeadService.js';
import { dealService } from '../services/DealService.js';
import { companyService } from '../services/CompanyService.js';
import { interactionService } from '../services/InteractionService.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { NotFoundError } from '../errors/index.js';

const router = Router();
router.use(rejectNonGet, requireAgentReadToken, resolveTenant);

function metaOf(deal: { importMeta?: Record<string, unknown> }): Record<string, unknown> {
  return deal.importMeta && typeof deal.importMeta === 'object' ? { ...deal.importMeta } : {};
}

function eventDateKey(deal: { importMeta?: Record<string, unknown> }): string | null {
  const meta = metaOf(deal);
  const raw =
    (typeof meta.eventDateIso === 'string' && meta.eventDateIso) ||
    (typeof meta.eventDate === 'string' && meta.eventDate) ||
    '';
  const key = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    surface: 'agent-read',
    mode: 'read_only',
  });
});

router.get('/leads', async (req, res, next) => {
  try {
    const {
      status,
      assignedTo,
      search,
      active = 'true',
      page = '1',
      limit = '50',
      sort = 'updatedAt',
      order = 'desc',
    } = req.query as Record<string, string>;
    const result = await leadService.list(
      getDB(),
      req.tenant,
      {
        status: status as never,
        assignedTo,
        search,
        activeOnly: active === 'true' || active === '1',
      },
      { page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc' },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/leads/:id', async (req, res, next) => {
  try {
    res.json(await leadService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.get('/leads/:id/interactions', async (req, res, next) => {
  try {
    const lead = await leadService.getById(getDB(), req.tenant, req.params['id']!);
    const leadRec = lead as { companyId?: string; company?: string };
    let companyId = leadRec.companyId ? String(leadRec.companyId) : '';

    if (!companyId && leadRec.company) {
      const matches = await CompanyRepository.search(getDB(), req.tenant, String(leadRec.company), 5);
      const exact = matches.find(
        (c) => String(c.name || '').trim().toLowerCase() === String(leadRec.company).trim().toLowerCase(),
      );
      companyId = String((exact ?? matches[0])?._id ?? '');
    }

    if (!companyId) {
      res.json({ data: [], total: 0, page: 1, pages: 0, limit: 50 });
      return;
    }

    const {
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const result = await interactionService.listForCompany(
      getDB(),
      req.tenant,
      companyId,
      {},
      { page: +page, limit: Math.min(+limit, 100), sort: 'createdAt', order: 'desc' },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/companies', async (req, res, next) => {
  try {
    const {
      search,
      source,
      page = '1',
      limit = '50',
      sort = 'name',
      order = 'asc',
    } = req.query as Record<string, string>;
    res.json(
      await companyService.list(
        getDB(),
        req.tenant,
        { search, source },
        { page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc' },
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/companies/search', async (req, res, next) => {
  try {
    const { q = '', limit = '10' } = req.query as Record<string, string>;
    if (!q.trim()) return res.json([]);
    res.json(await companyService.search(getDB(), req.tenant, q.trim(), Math.min(+limit, 20)));
  } catch (err) {
    next(err);
  }
});

router.get('/companies/:id', async (req, res, next) => {
  try {
    res.json(await companyService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.get('/companies/:id/interactions', async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;
    await companyService.getById(getDB(), req.tenant, req.params['id']!);
    res.json(
      await interactionService.listForCompany(
        getDB(),
        req.tenant,
        req.params['id']!,
        {},
        { page: +page, limit: Math.min(+limit, 100), sort: 'createdAt', order: 'desc' },
      ),
    );
  } catch (err) {
    next(err);
  }
});

/** Events = venue deals */
router.get('/events', async (req, res, next) => {
  try {
    const { from, to, page = '1', limit = '200' } = req.query as Record<string, string>;
    const cal = await dealService.listCalendar(getDB(), req.tenant, {
      page: +page,
      limit: Math.min(+limit, 500),
      sort: 'updatedAt',
      order: 'desc',
    });
    const data = (cal.data as Array<{ importMeta?: Record<string, unknown> }>).filter((d) => {
      const key = eventDateKey(d);
      if (!key) return false;
      if (from && key < from) return false;
      if (to && key > to) return false;
      return true;
    });
    res.json({ ...cal, data, total: data.length });
  } catch (err) {
    next(err);
  }
});

router.get('/events/:id', async (req, res, next) => {
  try {
    res.json(await dealService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.get('/events/:id/tasks', async (req, res, next) => {
  try {
    const deal = await dealService.getById(getDB(), req.tenant, req.params['id']!);
    const playbook = playbookFromImportMeta(metaOf(deal as { importMeta?: Record<string, unknown> }));
    res.json(playbook?.tasks ?? []);
  } catch (err) {
    next(err);
  }
});

/** Aliases matching staff paths used by local hub-api provider fallbacks */
router.get('/deals/calendar', async (req, res, next) => {
  try {
    const { page = '1', limit = '500', sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>;
    res.json(
      await dealService.listCalendar(getDB(), req.tenant, {
        page: +page,
        limit: Math.min(+limit, 500),
        sort,
        order: order as 'asc' | 'desc',
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/deals', async (req, res, next) => {
  try {
    const {
      status,
      assignedTo,
      search,
      active = 'true',
      ownerUserId,
      stage,
      company,
      page = '1',
      limit = '50',
      sort = 'updatedAt',
      order = 'desc',
    } = req.query as Record<string, string>;
    res.json(
      await dealService.list(
        getDB(),
        req.tenant,
        {
          status: status as never,
          assignedTo,
          search,
          activeOnly: active === 'true' || active === '1',
          ownerUserId,
          stage: stage as never,
          company,
        },
        { page: +page, limit: Math.min(+limit, 100), sort, order: order as 'asc' | 'desc' },
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/deals/:id', async (req, res, next) => {
  try {
    res.json(await dealService.getById(getDB(), req.tenant, req.params['id']!));
  } catch (err) {
    next(err);
  }
});

router.get('/deals/:id/tasks', async (req, res, next) => {
  try {
    const deal = await dealService.getById(getDB(), req.tenant, req.params['id']!);
    const playbook = playbookFromImportMeta(metaOf(deal as { importMeta?: Record<string, unknown> }));
    res.json(playbook?.tasks ?? []);
  } catch (err) {
    next(err);
  }
});

router.get('/interactions/follow-ups', async (req, res, next) => {
  try {
    const {
      mine = '0',
      page = '1',
      limit = '50',
      ownerUserId,
      overdueOnly = '1',
      status,
      q,
    } = req.query as Record<string, string>;
    res.json(
      await interactionService.listFollowUps(
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
      ),
    );
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/overdue', async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    res.json(
      await interactionService.listFollowUps(
        getDB(),
        req.tenant,
        { mine: false, overdueOnly: true, status: 'open' },
        { page: +page, limit: Math.min(+limit, 100), sort: 'followUpAt', order: 'asc' },
      ),
    );
  } catch (err) {
    next(err);
  }
});

/** Guard: any unknown agent-read path stays 404 (no write fallback). */
router.use((_req, _res, next) => next(new NotFoundError('Agent read route')));

export default router;
