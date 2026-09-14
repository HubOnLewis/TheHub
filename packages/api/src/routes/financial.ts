import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';

const router = Router();
router.use(requireAuth, resolveTenant);

router.get('/payments', async (req, res, next) => {
  try {
    const eventId = String(req.query.eventId ?? '').trim();
    const query: Record<string, unknown> = {
      tenantId: req.tenant.tenantId ?? { $in: ['hub-wichita', 'hub-on-lewis'] },
    };
    if (eventId) query.eventId = eventId;
    const rows = await getDB()
      .collection('hub_payments')
      .find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(500)
      .toArray();
    res.json({
      data: rows.map(row => ({
        id: String(row.id ?? row._id),
        eventId: row.eventId ? String(row.eventId) : undefined,
        eventTitle: row.eventName ? String(row.eventName) : undefined,
        amount: Number(row.amount ?? 0),
        paymentType: String(row.paymentType ?? 'unknown'),
        status: String(row.status ?? 'unknown'),
        paymentDate: row.paymentDate ? new Date(row.paymentDate as string | Date).toISOString() : undefined,
        method: row.method ? String(row.method) : undefined,
        source: 'perfect_venue' as const,
        sourceId: String(row.pvPaymentId ?? row.id ?? row._id),
        sourceReport: row.sourceFile ? String(row.sourceFile) : undefined,
        provenance: row.importBatchId ? { importBatchId: String(row.importBatchId) } : undefined,
      })),
    });
  } catch (err) { next(err); }
});

export default router;
