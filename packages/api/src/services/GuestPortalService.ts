import type { Db } from 'mongodb';
import {
  buildGuestStatusTimeline,
  clientDetailsAreComplete,
  clientDetailsFromImportMeta,
  playbookFromImportMeta,
  type GuestPortalSnapshot,
  type GuestPortalProfile,
  type GuestPortalDetailsPayload,
} from '@hub-crm/shared';
import { persistClientDetailsOnDealMeta } from './PlaybookService.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../errors/index.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { PaymentRepository } from '../repositories/PaymentRepository.js';
import { env } from '../config/env.js';
import { signPortalAccessToken, verifyPortalAccessToken } from '../lib/portalAccess.js';
import { portalTenantContext } from '../lib/portalTenant.js';
import { proposalService } from './ProposalService.js';
import { communicationsService, threadFromInteractions } from './CommunicationsService.js';
import { InteractionRepository } from '../repositories/InteractionRepository.js';
import type { TenantContext } from '../tenancy/index.js';

function money(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

export function guestProfileFromDeal(deal: Record<string, unknown>): GuestPortalProfile {
  const meta =
    deal.importMeta && typeof deal.importMeta === 'object'
      ? (deal.importMeta as Record<string, unknown>)
      : {};
  const grandTotal = money(meta.grandTotal, money(deal.amount));
  const amountPaid = money(meta.amountPaid, 0);
  const balanceDue =
    typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, grandTotal - amountPaid);
  const eventDateIso =
    (typeof meta.eventDateIso === 'string' && meta.eventDateIso) ||
    (typeof meta.eventDate === 'string' && meta.eventDate) ||
    null;
  const details = clientDetailsFromImportMeta(meta);
  const startTime = typeof meta.startTime === 'string' ? meta.startTime : null;
  const endTime = typeof meta.endTime === 'string' ? meta.endTime : null;
  let displayDate = 'Date TBD';
  if (eventDateIso) {
    const d = new Date(eventDateIso.includes('T') ? eventDateIso : `${eventDateIso}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      displayDate = d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      if (startTime && endTime) displayDate += ` · ${startTime} – ${endTime}`;
      else if (startTime) displayDate += ` · ${startTime}`;
    } else {
      displayDate = eventDateIso;
    }
  }
  return {
    id: String(deal._id),
    title: String(deal.title ?? 'Your event'),
    clientName: String(deal.company ?? 'Client'),
    contactName: String(deal.contact ?? 'Guest'),
    contactEmail: typeof meta.contactEmail === 'string' ? meta.contactEmail : null,
    displayDate,
    eventStartIso: eventDateIso,
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
    guests: typeof details.guestCount === 'number' ? details.guestCount : typeof meta.guests === 'number' ? meta.guests : 0,
    space: typeof meta.space === 'string' ? meta.space : 'Event Space',
    notes: typeof deal.notes === 'string' ? deal.notes : '',
    source: 'crm',
  };
}

export function guestSafeDocuments(input: {
  proposalStatus?: string | null;
}): GuestPortalSnapshot['documents'] {
  const proposalOnFile = ['sent', 'viewed', 'accepted'].includes((input.proposalStatus ?? '').toLowerCase());
  return [
    { kind: 'proposal', label: 'Proposal & agreement', audience: 'guest', available: proposalOnFile },
    { kind: 'beo_guest', label: 'Event details / BEO (guest)', audience: 'guest', available: true },
    { kind: 'payment_summary', label: 'Payment summary', audience: 'guest', available: true },
  ];
}

export function nextDatesForGuest(profile: GuestPortalProfile, proposalStatus?: string | null) {
  const dates: GuestPortalSnapshot['nextDates'] = [];
  if (profile.eventStartIso) {
    dates.push({ label: 'Event date', date: profile.eventStartIso });
  }
  if (proposalStatus === 'sent' || proposalStatus === 'viewed') {
    dates.push({ label: 'Sign proposal', date: null });
  }
  if (profile.balanceDue > 0 && profile.paidTotal <= 0) {
    dates.push({ label: 'Deposit to hold the date', date: null });
  } else if (profile.balanceDue > 0) {
    dates.push({ label: 'Final balance', date: profile.eventStartIso });
  }
  return dates;
}

export async function reuseOrMintPortalToken(
  db: Db,
  ctx: TenantContext,
  eventId: string,
): Promise<{ token: string; path: string; reused: boolean }> {
  const deal = await DealRepository.findById(db, ctx, eventId);
  if (!deal) throw new NotFoundError('Event');
  const meta =
    deal.importMeta && typeof deal.importMeta === 'object'
      ? { ...(deal.importMeta as Record<string, unknown>) }
      : {};
  const existing = typeof meta.portalAccessToken === 'string' ? meta.portalAccessToken : '';
  const verified = existing ? verifyPortalAccessToken(existing, env.JWT_SECRET) : null;
  if (verified && verified.eventId === eventId) {
    return {
      token: existing,
      path: `/portal/login?access=${encodeURIComponent(existing)}`,
      reused: true,
    };
  }
  const token = signPortalAccessToken(eventId, env.JWT_SECRET, 365);
  meta.portalAccessToken = token;
  await DealRepository.updateOne(db, ctx, eventId, { importMeta: meta } as never);
  return {
    token,
    path: `/portal/login?access=${encodeURIComponent(token)}`,
    reused: false,
  };
}

export class GuestPortalService {
  async resolveDealFromAccess(db: Db, token: string) {
    const parsed = verifyPortalAccessToken(token, env.JWT_SECRET);
    if (!parsed) throw new UnauthorizedError('This guest link is invalid or expired.');
    const ctx = portalTenantContext();
    const deal = await DealRepository.findById(db, ctx, parsed.eventId);
    if (!deal) throw new NotFoundError('Event');
    return { deal, ctx, eventId: parsed.eventId };
  }

  async snapshot(db: Db, token: string): Promise<GuestPortalSnapshot> {
    const { deal, ctx, eventId } = await this.resolveDealFromAccess(db, token);
    const profile = guestProfileFromDeal(deal as unknown as Record<string, unknown>);
    const proposal = await proposalService.latestForEvent(db, ctx, eventId);
    const payments = await PaymentRepository.listByEvent(db, ctx, eventId);
    const rows = await InteractionRepository.listByRelatedDealIds(db, ctx, [eventId]);
    const messages = threadFromInteractions(rows);
    const meta =
      deal.importMeta && typeof deal.importMeta === 'object'
        ? (deal.importMeta as Record<string, unknown>)
        : {};
    const clientDetails = clientDetailsFromImportMeta(meta);
    const playbook = playbookFromImportMeta(meta);
    const timeline = buildGuestStatusTimeline({
      proposalStatus: proposal?.status ?? (typeof meta.proposalStatus === 'string' ? String(meta.proposalStatus) : null),
      amountPaid: profile.paidTotal,
      balanceDue: profile.balanceDue,
      grandTotal: profile.packageTotal,
      eventDateIso: profile.eventStartIso,
      detailsConfirmed: clientDetailsAreComplete(clientDetails) || Boolean(profile.guests && profile.space && profile.eventStartIso),
    });
    const nextDates = nextDatesForGuest(profile, proposal?.status);
    if (playbook) {
      for (const step of playbook.clientTimeline) {
        if (step.dueDate && step.id !== 'tl-day-of') {
          nextDates.push({ label: step.label, date: step.dueDate });
        }
      }
    }
    return {
      eventId,
      profile,
      proposal,
      payments,
      messages,
      timeline,
      nextDates,
      documents: guestSafeDocuments({ proposalStatus: proposal?.status }),
      clientDetails,
      playbook,
    };
  }

  async postMessage(db: Db, token: string, body: string) {
    const { deal, ctx } = await this.resolveDealFromAccess(db, token);
    const name = String(deal.contact ?? 'Guest');
    return communicationsService.postGuestMessage(db, ctx, deal, body, name);
  }

  async viewProposal(db: Db, token: string, proposalId: string) {
    const { ctx, eventId } = await this.resolveDealFromAccess(db, token);
    const latest = await proposalService.latestForEvent(db, ctx, eventId);
    if (!latest || latest.id !== proposalId) throw new NotFoundError('Proposal');
    return proposalService.markViewed(db, ctx, proposalId);
  }

  async patchDetails(db: Db, token: string, body: GuestPortalDetailsPayload) {
    const { deal, ctx, eventId } = await this.resolveDealFromAccess(db, token);
    const importMeta = persistClientDetailsOnDealMeta(deal, body);
    await DealRepository.updateOne(db, ctx, eventId, { importMeta } as never);
    return this.snapshot(db, token);
  }

  async acceptProposal(
    db: Db,
    token: string,
    proposalId: string,
    sign: { method: 'typed' | 'drawn'; name: string; dataUrl?: string },
  ) {
    const { ctx, eventId, deal } = await this.resolveDealFromAccess(db, token);
    const latest = await proposalService.latestForEvent(db, ctx, eventId);
    if (!latest || latest.id !== proposalId) throw new NotFoundError('Proposal');
    if (latest.status === 'draft') throw new ValidationError('Proposal has not been sent yet');
    return proposalService.accept(db, ctx, proposalId, sign, String(deal.contact ?? sign.name));
  }
}

export const guestPortalService = new GuestPortalService();
