import { Router } from 'express';
import { GuestPortalDetailsSchema, GuestPortalMessageSchema, ProposalSignSchema } from '@hub-crm/shared';
import { requireAuth } from '../middleware/auth.js';
import { resolveTenant } from '../tenancy/index.js';
import { validate } from '../middleware/validate.js';
import { guestPortalService, reuseOrMintPortalToken } from '../services/GuestPortalService.js';
import { getDB } from '../config/db.js';

const staff = Router();
staff.use(requireAuth, resolveTenant);

staff.post('/links/:dealId', async (req, res, next) => {
  try {
    const dealId = req.params['dealId']!;
    const minted = await reuseOrMintPortalToken(getDB(), req.tenant, dealId);
    res.json({
      token: minted.token,
      eventId: dealId,
      path: minted.path,
      persistent: true,
      reused: minted.reused,
    });
  } catch (err) {
    next(err);
  }
});

const pub = Router();

pub.get('/bookings/:token', async (req, res, next) => {
  try {
    res.json(await guestPortalService.snapshot(getDB(), req.params['token'] ?? ''));
  } catch (err) {
    next(err);
  }
});


pub.patch('/bookings/:token/details', validate(GuestPortalDetailsSchema), async (req, res, next) => {
  try {
    res.json(await guestPortalService.patchDetails(getDB(), req.params['token'] ?? '', req.body));
  } catch (err) {
    next(err);
  }
});

pub.post('/bookings/:token/messages', validate(GuestPortalMessageSchema), async (req, res, next) => {
  try {
    const message = await guestPortalService.postMessage(getDB(), req.params['token'] ?? '', req.body.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

pub.post('/bookings/:token/proposals/:id/view', async (req, res, next) => {
  try {
    res.json(await guestPortalService.viewProposal(getDB(), req.params['token'] ?? '', req.params['id']!));
  } catch (err) {
    next(err);
  }
});

pub.post('/bookings/:token/proposals/:id/accept', validate(ProposalSignSchema), async (req, res, next) => {
  try {
    res.json(
      await guestPortalService.acceptProposal(
        getDB(),
        req.params['token'] ?? '',
        req.params['id']!,
        req.body,
      ),
    );
  } catch (err) {
    next(err);
  }
});

export const portalStaffRoutes = staff;
export const portalPublicRoutes = pub;
