import type { Db } from 'mongodb';
import type { CreateOutboundMessagePayload, GuestPortalMessage } from '@hub-crm/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { DealRepository, type DealDoc } from '../repositories/DealRepository.js';
import { InteractionRepository, type InteractionDoc } from '../repositories/InteractionRepository.js';
import { ProposalRepository } from '../repositories/ProposalRepository.js';
import { getEmailProvider } from './email/EmailProvider.js';
import type { TenantContext } from '../tenancy/index.js';

export const EMAIL_TEMPLATES = [
  {
    key: 'inquiry',
    label: 'Initial inquiry response',
    subject: 'Thanks for your inquiry — HuB on Lewis',
    body: 'Hi {{firstName}},\n\nThank you for considering HuB on Lewis for {{eventTitle}}. We have your date on our radar and would love to help you plan.\n\nOpen your event portal anytime to review details and message us.\n\n— {{coordinator}}',
  },
  {
    key: 'proposal',
    label: 'Proposal follow-up',
    subject: 'Your HuB on Lewis proposal is ready',
    body: 'Hi {{firstName}},\n\nYour proposal for {{eventTitle}} is in your guest portal. Review the package, then sign right there — no separate link to chase.\n\n— {{coordinator}}',
  },
  {
    key: 'deposit',
    label: 'Deposit reminder',
    subject: 'Deposit to hold {{eventTitle}}',
    body: 'Hi {{firstName}},\n\nTo hold {{eventTitle}} we still need the deposit. You can see the schedule in your portal. Card checkout is coming; for now your coordinator can record a payment.\n\n— {{coordinator}}',
  },
  {
    key: 'balance',
    label: 'Final balance reminder',
    subject: 'Final balance for {{eventTitle}}',
    body: 'Hi {{firstName}},\n\nA balance remains on {{eventTitle}}. Review the ledger in your portal and reply here with any questions.\n\n— {{coordinator}}',
  },
  {
    key: 'thanks',
    label: 'Thank-you / review request',
    subject: 'Thank you for celebrating at HuB on Lewis',
    body: 'Hi {{firstName}},\n\nThank you for celebrating {{eventTitle}} with us. We would love to hear how the day felt.\n\n— {{coordinator}}',
  },
] as const;

export type TemplateVars = {
  firstName?: string;
  eventTitle?: string;
  coordinator?: string;
};

export function renderTemplate(key: string, vars: TemplateVars): { subject: string; body: string; label: string } | null {
  const t = EMAIL_TEMPLATES.find(x => x.key === key);
  if (!t) return null;
  const fill = (s: string) =>
    s
      .replaceAll('{{firstName}}', vars.firstName || 'there')
      .replaceAll('{{eventTitle}}', vars.eventTitle || 'your event')
      .replaceAll('{{coordinator}}', vars.coordinator || 'HuB on Lewis');
  return { subject: fill(t.subject), body: fill(t.body), label: t.label };
}

export function threadFromInteractions(
  rows: Array<{
    _id: string;
    body: string;
    summary?: string;
    direction: string;
    createdAt: Date | string;
    createdByName?: string;
    metadata?: Record<string, unknown>;
  }>,
): GuestPortalMessage[] {
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
  return sorted
    .filter(r => {
      const ch = r.metadata?.['channel'];
      return ch === 'portal' || ch === 'email' || r.direction === 'inbound' || r.direction === 'outbound';
    })
    .filter(r => r.metadata?.['channel'] === 'portal' || r.metadata?.['channel'] === 'email')
    .map(r => {
      const role = r.metadata?.['role'] === 'client' || r.direction === 'inbound' ? 'client' : 'coordinator';
      return {
        id: r._id,
        from: String(r.createdByName || (role === 'client' ? 'Guest' : 'Coordinator')),
        role: role as 'client' | 'coordinator',
        body: r.body,
        at: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt.toISOString(),
        channel: (r.metadata?.['channel'] === 'email' ? 'email' : 'portal') as 'portal' | 'email',
        deliveryStatus: typeof r.metadata?.['deliveryStatus'] === 'string' ? r.metadata['deliveryStatus'] : undefined,
      };
    });
}

export function eventHasUnansweredGuestMessage(messages: GuestPortalMessage[]): boolean {
  let lastGuestAt = -1;
  let lastStaffAt = -1;
  messages.forEach((m, i) => {
    if (m.role === 'client') lastGuestAt = i;
    else lastStaffAt = i;
  });
  return lastGuestAt >= 0 && lastGuestAt > lastStaffAt;
}

export function buildOutboundInteractionDoc(input: {
  tenantId: string;
  companyId: string;
  companyName: string;
  eventId: string;
  body: string;
  summary: string;
  channel: 'portal' | 'email';
  role: 'client' | 'coordinator';
  direction: 'inbound' | 'outbound';
  actorId: string;
  actorName: string;
  deliveryStatus: string;
  templateKey?: string;
  scheduledAt?: Date;
  providerMessageId?: string;
  now?: Date;
}): Omit<InteractionDoc, '_id'> {
  const now = input.now ?? new Date();
  const scheduled = input.deliveryStatus === 'scheduled';
  return {
    tenantId: input.tenantId,
    companyId: input.companyId,
    companyName: input.companyName,
    relatedDealId: input.eventId,
    type: input.channel === 'email' ? 'email' : 'note',
    direction: input.direction,
    summary: input.summary,
    body: input.body,
    outcome: 'other',
    status: scheduled ? 'open' : 'completed',
    createdAt: now,
    createdByUserId: input.actorId,
    createdByName: input.actorName,
    ownerUserId: input.actorId,
    ownerName: input.actorName,
    completedAt: scheduled ? undefined : now,
    completedByUserId: scheduled ? undefined : input.actorId,
    completedByName: scheduled ? undefined : input.actorName,
    followUpAt: input.scheduledAt,
    attachments: [],
    metadata: {
      channel: input.channel,
      role: input.role,
      deliveryStatus: input.deliveryStatus,
      templateKey: input.templateKey,
      provider: input.channel === 'email' ? 'stub' : 'portal',
      providerMessageId: input.providerMessageId,
      scheduledAt: input.scheduledAt ? input.scheduledAt.toISOString() : undefined,
    },
    updatedAt: now,
  };
}

export type InboxTriage = {
  unansweredMessages: Array<{ eventId: string; eventTitle: string; preview: string; at: string }>;
  unsignedProposals: Array<{ eventId: string; eventTitle: string; version: number; status: string }>;
  unpaidDeposits: Array<{ eventId: string; eventTitle: string; balanceDue: number }>;
  drafts: GuestPortalMessage[];
  scheduled: GuestPortalMessage[];
  templates: Array<{ key: string; label: string }>;
};

export function buildInboxTriage(input: {
  threads: Array<{ eventId: string; eventTitle: string; messages: GuestPortalMessage[] }>;
  proposals: Array<{ eventId: string; eventTitle: string; version: number; status: string }>;
  events: Array<{ eventId: string; eventTitle: string; balanceDue: number; amountPaid: number }>;
}): InboxTriage {
  const unansweredMessages = input.threads
    .filter(t => eventHasUnansweredGuestMessage(t.messages))
    .map(t => {
      const last = [...t.messages].reverse().find(m => m.role === 'client');
      return {
        eventId: t.eventId,
        eventTitle: t.eventTitle,
        preview: last?.body.slice(0, 140) ?? '',
        at: last?.at ?? '',
      };
    });
  const unsignedProposals = input.proposals.filter(p => p.status === 'sent' || p.status === 'viewed');
  const unpaidDeposits = input.events.filter(e => e.balanceDue > 0 && e.amountPaid <= 0);
  const allMsgs = input.threads.flatMap(t => t.messages);
  return {
    unansweredMessages,
    unsignedProposals,
    unpaidDeposits,
    drafts: allMsgs.filter(m => m.deliveryStatus === 'draft'),
    scheduled: allMsgs.filter(m => m.deliveryStatus === 'scheduled'),
    templates: EMAIL_TEMPLATES.map(t => ({ key: t.key, label: t.label })),
  };
}

function companyIdForDeal(deal: DealDoc & { _id: string }): string {
  return deal.companyId || deal._id;
}

export class CommunicationsService {
  async threadForEvent(db: Db, ctx: TenantContext, eventId: string): Promise<GuestPortalMessage[]> {
    const deal = await DealRepository.findById(db, ctx, eventId);
    if (!deal) throw new NotFoundError('Event');
    const rows = await InteractionRepository.listByRelatedDealIds(db, ctx, [eventId]);
    return threadFromInteractions(rows);
  }

  async postStaffMessage(
    db: Db,
    ctx: TenantContext,
    payload: CreateOutboundMessagePayload,
  ): Promise<{ message: GuestPortalMessage; delivery: Record<string, unknown> }> {
    const body = payload.body.trim();
    if (!body) throw new ValidationError('Message body is required');
    const deal = await DealRepository.findById(db, ctx, payload.eventId);
    if (!deal) throw new NotFoundError('Event');

    const vars: TemplateVars = {
      firstName: String(deal.contact ?? '').split(' ')[0] || 'there',
      eventTitle: String(deal.title ?? 'your event'),
      coordinator: ctx.userName,
    };
    const rendered = payload.templateKey ? renderTemplate(payload.templateKey, vars) : null;
    const text = body || rendered?.body || '';
    const summary = payload.subject?.trim() || rendered?.subject || 'Portal message';

    let deliveryStatus = payload.asDraft ? 'draft' : payload.scheduledAt ? 'scheduled' : 'persisted';
    let providerMessageId: string | undefined;
    let delivery: Record<string, unknown> = { status: deliveryStatus, provider: 'none' };

    if (payload.channel === 'email' && !payload.asDraft && !payload.scheduledAt) {
      const meta = (deal.importMeta && typeof deal.importMeta === 'object' ? deal.importMeta : {}) as Record<string, unknown>;
      const to =
        (typeof meta.contactEmail === 'string' && meta.contactEmail) ||
        '';
      const result = await getEmailProvider().send({
        to: to || 'unspecified@hubonlewis.com',
        subject: summary,
        body: text,
        eventId: payload.eventId,
        templateKey: payload.templateKey,
      });
      deliveryStatus = result.status;
      providerMessageId = result.messageId;
      delivery = { ...result };
    }

    const doc = buildOutboundInteractionDoc({
      tenantId: deal.tenantId,
      companyId: companyIdForDeal(deal),
      companyName: deal.company,
      eventId: payload.eventId,
      body: text,
      summary,
      channel: payload.channel ?? 'portal',
      role: 'coordinator',
      direction: 'outbound',
      actorId: ctx.userId,
      actorName: ctx.userName,
      deliveryStatus,
      templateKey: payload.templateKey,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
      providerMessageId,
    });
    const inserted = await InteractionRepository.insertOne(db, ctx, doc);
    const [message] = threadFromInteractions([inserted]);
    return { message: message!, delivery };
  }

  async postGuestMessage(
    db: Db,
    ctx: TenantContext,
    deal: DealDoc & { _id: string },
    body: string,
    actorName: string,
  ): Promise<GuestPortalMessage> {
    const text = body.trim();
    if (!text) throw new ValidationError('Message body is required');
    const doc = buildOutboundInteractionDoc({
      tenantId: deal.tenantId,
      companyId: companyIdForDeal(deal),
      companyName: deal.company,
      eventId: deal._id,
      body: text,
      summary: 'Guest portal message',
      channel: 'portal',
      role: 'client',
      direction: 'inbound',
      actorId: 'portal-guest',
      actorName,
      deliveryStatus: 'persisted',
    });
    const inserted = await InteractionRepository.insertOne(db, ctx, doc);
    const [message] = threadFromInteractions([inserted]);
    return message!;
  }

  async inbox(db: Db, ctx: TenantContext): Promise<InboxTriage> {
    const deals = await DealRepository.listDeals(
      db,
      ctx,
      { activeOnly: true },
      { page: 1, limit: 200, sort: 'updatedAt', order: 'desc' },
    );
    const dealIds = deals.data.map(d => d._id);
    const interactions = await InteractionRepository.listByRelatedDealIds(db, ctx, dealIds);
    const byEvent = new Map<string, Array<InteractionDoc & { _id: string }>>();
    for (const row of interactions) {
      if (!row.relatedDealId) continue;
      const list = byEvent.get(row.relatedDealId) ?? [];
      list.push(row);
      byEvent.set(row.relatedDealId, list);
    }
    const threads = deals.data.map(d => ({
      eventId: d._id,
      eventTitle: d.title,
      messages: threadFromInteractions(byEvent.get(d._id) ?? []),
    }));
    const proposals = (
      await Promise.all(dealIds.slice(0, 80).map(id => ProposalRepository.latestForEvent(db, ctx, id)))
    )
      .filter(Boolean)
      .map(p => ({
        eventId: p!.eventId,
        eventTitle: p!.eventTitle,
        version: p!.version,
        status: p!.status,
      }));
    const events = deals.data.map(d => {
      const meta = (d.importMeta && typeof d.importMeta === 'object' ? d.importMeta : {}) as Record<string, unknown>;
      const grand = typeof meta.grandTotal === 'number' ? meta.grandTotal : d.amount;
      const paid = typeof meta.amountPaid === 'number' ? meta.amountPaid : 0;
      const balance = typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, grand - paid);
      return { eventId: d._id, eventTitle: d.title, balanceDue: balance, amountPaid: paid };
    });
    return buildInboxTriage({ threads, proposals, events });
  }
}

export const communicationsService = new CommunicationsService();
