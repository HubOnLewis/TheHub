import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { ContactRepository } from '../repositories/ContactRepository.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/', async (req, res, next) => {
  try {
    const { search, page = '1', limit = '25', sort = 'displayName', order = 'asc' } = req.query as Record<string, string>;
    res.json(await ContactRepository.listContacts(getDB(), req.tenant, search, {
      page: +page,
      limit: Math.min(+limit, 100),
      sort,
      order: order as 'asc' | 'desc',
    }));
  } catch (err) { next(err); }
});

router.get('/:id/deals', async (req, res, next) => {
  try {
    const contact = await ContactRepository.findById(getDB(), req.tenant, req.params['id']!);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    const query: Record<string, unknown> = { tenantId: req.tenant.tenantId, contactId: contact.id };
    if (contact.email) query['importMeta.contactEmail'] = contact.email;
    const deals = await getDB().collection('deals').find({
      tenantId: req.tenant.tenantId,
      $or: [query, { tenantId: req.tenant.tenantId, 'importMeta.contactEmail': contact.email }],
    }).limit(200).toArray();
    res.json({ data: deals });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contact = await ContactRepository.findById(getDB(), req.tenant, req.params['id']!);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json(contact);
  } catch (err) { next(err); }
});

export default router;
