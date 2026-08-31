import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { getDB } from '../config/db.js';
import { env } from '../config/env.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { signPortalAccessToken, verifyPortalAccessToken } from '../lib/portalAccess.js';
import { NotFoundError, UnauthorizedError } from '../errors/index.js';

const staff = Router();
staff.use(requireAuth, resolveTenant);

staff.post('/links/:dealId', async (req, res, next) => {
  try {
    const dealId = req.params['dealId']!;
    const deal = await DealRepository.findById(getDB(), req.tenant, dealId);
    if (!deal) throw new NotFoundError('Event');
    const token = signPortalAccessToken(dealId, env.JWT_SECRET);
    res.json({
      token,
      eventId: dealId,
      path: `/portal/login?access=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    next(err);
  }
});

const pub = Router();

function guestProfile(deal: Record<string, unknown>) {
  const meta = (deal.importMeta && typeof deal.importMeta === 'object' ? deal.importMeta : {}) as Record<string, unknown>;
  const grandTotal = typeof meta.grandTotal === 'number' ? meta.grandTotal : Number(deal.amount ?? 0);
  const amountPaid = typeof meta.amountPaid === 'number' ? meta.amountPaid : 0;
  const balanceDue =
    typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, grandTotal - amountPaid);
  return {
    id: String(deal._id),
    title: String(deal.title ?? 'Your event'),
    clientName: String(deal.company ?? 'Client'),
    contactName: String(deal.contact ?? 'Guest'),
    contactEmail: typeof meta.contactEmail === 'string' ? meta.contactEmail : null,
    displayDate: typeof meta.eventDateIso === 'string' ? meta.eventDateIso : 'Date TBD',
    eventStartIso: typeof meta.eventDateIso === 'string' ? meta.eventDateIso : null,
    venueName: 'HuB on Lewis',
    venueAddress: '1400 N Lewis St · Wichita, KS',
    coordinator: {
      name: String(deal.assignedTo ?? 'Your coordinator'),
      email: 'coordinator@hubonlewis.com',
      phone: '',
    },
    packageTotal: grandTotal,
    paidTotal: amountPaid,
    balanceDue,
    guests: typeof meta.guests === 'number' ? meta.guests : 0,
    space: typeof meta.space === 'string' ? meta.space : 'Event Space',
    notes: typeof deal.notes === 'string' ? deal.notes : '',
    source: 'crm' as const,
  };
}

pub.get('/bookings/:token', async (req, res, next) => {
  try {
    const parsed = verifyPortalAccessToken(req.params['token'] ?? '', env.JWT_SECRET);
    if (!parsed) throw new UnauthorizedError('This guest link is invalid or expired.');
    const deal = await DealRepository.findById(getDB(), {
      tenantId: null,
      defaultEntity: 'hub',
      defaultLocation: 'wichita',
      userId: 'portal',
      userRole: 'client',
      userName: 'portal',
      isCrossTenant: true,
      isSuperAdmin: false,
    }, parsed.eventId);
    if (!deal) throw new NotFoundError('Event');
    res.json({ eventId: parsed.eventId, profile: guestProfile(deal as unknown as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
});

export const portalStaffRoutes = staff;
export const portalPublicRoutes = pub;
