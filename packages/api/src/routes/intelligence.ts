import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

function scoped(req: any) {
  return req.tenant.tenantId ? { tenantId: req.tenant.tenantId } : { tenantId: { $in: ['hub-wichita', 'hub-on-lewis'] } };
}
function eventDate(deal: any) { return String(deal.importMeta?.eventDateIso ?? deal.importMeta?.eventDate ?? '').slice(0, 10); }
function balance(deal: any) { return Number(deal.importMeta?.balanceDue ?? 0); }
function amount(deal: any) { return Number(deal.importMeta?.grandTotal ?? deal.amount ?? 0); }

router.get('/today', async (req, res, next) => {
  try {
    const db = getDB();
    const filter = scoped(req);
    const today = new Date().toISOString().slice(0, 10);
    const [deals, tasks, payments] = await Promise.all([
      db.collection('deals').find({ ...filter, status: { $ne: 'Lost' } }).sort({ updatedAt: -1 }).limit(500).toArray(),
      db.collection('interactions').find({ ...filter, status: 'open', followUpAt: { $exists: true } }).sort({ followUpAt: 1 }).limit(50).toArray(),
      db.collection('hub_payments').find(filter).sort({ paymentDate: -1 }).limit(500).toArray(),
    ]);
    const todayEvents = deals.filter(d => eventDate(d) === today);
    const balances = deals.filter(d => balance(d) > 0).sort((a, b) => balance(b) - balance(a)).slice(0, 20);
    res.json({ asOf: today, events: todayEvents, balances, tasks, payments, source: 'mongo' });
  } catch (err) { next(err); }
});

router.get('/revenue-leaks', async (req, res, next) => {
  try {
    const deals = await getDB().collection('deals').find({ ...scoped(req), status: { $nin: ['Lost', 'Delivered'] } }).sort({ updatedAt: 1 }).limit(500).toArray();
    const balances = deals.filter(d => balance(d) > 0).map(d => ({ id: String(d._id), title: d.title, amount: balance(d), type: 'balance_due', reason: 'Outstanding source balance' }));
    const stale = deals.filter(d => d.status === 'Approved' || d.importMeta?.pvStatus === 'proposal_sent').map(d => ({ id: String(d._id), title: d.title, amount: amount(d), type: 'proposal_attention', reason: 'Proposal requires follow-up' })).slice(0, 50);
    res.json({ source: 'mongo', balances, stale, potentialValue: stale.reduce((sum, row) => sum + row.amount, 0), atRisk: balances.reduce((sum, row) => sum + row.amount, 0) });
  } catch (err) { next(err); }
});

router.get('/autopilot', async (req, res, next) => {
  try {
    const deals = await getDB().collection('deals').find({ ...scoped(req), status: { $nin: ['Lost', 'Delivered'] } }).sort({ updatedAt: 1 }).limit(500).toArray();
    const recommendations = deals.filter(d => balance(d) > 0 || d.importMeta?.pvStatus === 'proposal_sent').slice(0, 50).map(d => ({ id: String(d._id), targetId: String(d._id), targetType: 'deal', title: balance(d) > 0 ? 'Review outstanding balance' : 'Follow up on proposal', reason: balance(d) > 0 ? 'Imported balance remains due' : 'Imported proposal is still open', status: 'recommendation', source: 'deterministic_mongo' }));
    res.json({ source: 'mongo', recommendations });
  } catch (err) { next(err); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const events = await getDB().collection('audit_events').find(scoped(req)).sort({ timestamp: -1 }).limit(500).toArray();
    res.json({ source: 'mongo', events });
  } catch (err) { next(err); }
});

export default router;
