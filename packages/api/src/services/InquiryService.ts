import type { Db } from 'mongodb';
import {
  HUB_CONTACT_EMAILS,
  getHubTeamMember,
  isAssignedSpace,
  type CreateDealPayload,
  type CreateLeadPayload,
  type PublicInquiryPayload,
} from '@hub-crm/shared';
import type { TenantContext } from '../tenancy/index.js';
import { HUB_ADMIN_URL } from '../rootIndex.js';
import { leadService } from './LeadService.js';
import { dealService } from './DealService.js';
import { reuseOrMintPortalToken } from './GuestPortalService.js';
import { getEmailProvider } from './email/EmailProvider.js';
import { ConflictError } from '../errors/index.js';

export const SPACE_TAKEN_MESSAGE =
  'That date is taken for this space. Please pick another.';

function rethrowGuestConflict(err: unknown): never {
  if (err instanceof ConflictError) {
    throw new ConflictError(SPACE_TAKEN_MESSAGE);
  }
  throw err;
}

export function publicInquiryTenantContext(): TenantContext {
  return {
    tenantId: 'hub-wichita',
    defaultEntity: 'HUB',
    defaultLocation: 'Wichita',
    userId: 'public-inquiry',
    userRole: 'client',
    userName: 'Public inquiry',
    isCrossTenant: false,
    isSuperAdmin: false,
  };
}

export function mapPublicInquiryToRecords(body: PublicInquiryPayload): {
  lead: CreateLeadPayload;
  deal: CreateDealPayload;
} {
  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();
  const company = body.company?.trim() || name;
  const dateRaw = body.eventDate?.trim() ?? '';
  const dateKey = /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : '';
  const space = body.space?.trim() ?? '';
  const hasSpace = isAssignedSpace(space);
  const eventType = body.eventType?.trim() || undefined;
  const hannah = getHubTeamMember(HUB_CONTACT_EMAILS.hannah);

  const importMeta: Record<string, unknown> = {
    source: 'public_inquiry',
    contactEmail: email,
    contactPhone: body.phone?.trim() || undefined,
    eventType,
    guests: body.guests,
    eventDate: dateKey || dateRaw || undefined,
    pvStatus: 'lead',
  };
  if (dateKey && hasSpace) {
    importMeta.eventDateIso = dateKey;
    importMeta.space = space;
    importMeta.startTime = body.startTime?.trim() || '17:00';
    importMeta.endTime = body.endTime?.trim() || '22:00';
  } else if (hasSpace) {
    importMeta.space = space;
  }

  return {
    lead: {
      company,
      contact: name,
      email,
      phone: body.phone?.trim() || undefined,
      source: 'public_inquiry',
      notes: body.notes?.trim() || undefined,
      assignedTo: hannah?.name ?? 'Hannah Bayless',
      status: 'New',
      eventDate: dateKey || dateRaw || undefined,
      guestCount: body.guests,
      eventType,
      spacePreference: hasSpace ? space : undefined,
    },
    deal: {
      title: eventType ? `${name} — ${eventType}` : `${name} inquiry`,
      company,
      contact: name,
      amount: 0,
      assignedTo: hannah?.name ?? 'Hannah Bayless',
      notes: body.notes?.trim() || undefined,
      status: 'Draft',
      importMeta,
    },
  };
}

export class InquiryService {
  async mintPortal(db: Db, ctx: TenantContext, eventId: string) {
    return reuseOrMintPortalToken(db, ctx, eventId);
  }

  async create(db: Db, body: PublicInquiryPayload) {
    const ctx = publicInquiryTenantContext();
    const mapped = mapPublicInquiryToRecords(body);
    try {
      await dealService.assertSpaceAvailability(
        db,
        ctx,
        mapped.deal.importMeta as Record<string, unknown> | undefined,
        mapped.deal.title,
        mapped.deal.status,
      );
    } catch (err) {
      rethrowGuestConflict(err);
    }
    const lead = await leadService.create(db, ctx, mapped.lead);
    let deal;
    try {
      deal = await dealService.create(db, ctx, {
        ...mapped.deal,
        leadId: String(lead._id),
      });
    } catch (err) {
      rethrowGuestConflict(err);
    }
    const minted = await this.mintPortal(db, ctx, String(deal._id));
    const portalPath = minted.path;
    const portalUrl = `${HUB_ADMIN_URL}${portalPath}`;

    const email = await getEmailProvider().send({
      to: mapped.lead.email || 'unspecified@hubonlewis.com',
      subject: 'Thanks for your inquiry — HuB on Lewis',
      body: `Your event portal: ${portalUrl}`,
      eventId: String(deal._id),
      templateKey: 'inquiry',
    });

    return {
      leadId: String(lead._id),
      eventId: String(deal._id),
      portalPath,
      portalUrl,
      emailStatus: email.status,
      copyHint: 'Email is stubbed — staff copy this portal link for the guest.',
    };
  }
}

export const inquiryService = new InquiryService();