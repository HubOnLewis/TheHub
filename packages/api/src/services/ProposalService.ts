import type { Db } from 'mongodb';
import type {
  CreateProposalPayload,
  PatchProposalPayload,
  ProposalRecord,
  ProposalSignPayload,
  ProposalStatus,
} from '@hub-crm/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { ProposalRepository, serializeProposal, type ProposalDoc } from '../repositories/ProposalRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import type { TenantContext } from '../tenancy/index.js';

export type ProposalAction = 'send' | 'view' | 'accept' | 'decline' | 'supersede';

const ALLOWED: Record<ProposalAction, ProposalStatus[]> = {
  send: ['draft', 'sent', 'viewed'],
  view: ['sent', 'viewed'],
  accept: ['sent', 'viewed'],
  decline: ['sent', 'viewed'],
  supersede: ['draft', 'sent', 'viewed'],
};

function token(): string {
  return `prop_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function money(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function canApplyProposalAction(status: ProposalStatus, action: ProposalAction): boolean {
  return (ALLOWED[action] ?? []).includes(status);
}

export function applyProposalAction(
  current: { status: ProposalStatus; viewedAt?: Date; sentAt?: Date },
  action: ProposalAction,
  at: Date,
  actor: string,
): Partial<ProposalDoc> {
  if (!canApplyProposalAction(current.status, action)) {
    throw new ValidationError(`Cannot ${action} a proposal that is ${current.status}`);
  }
  if (action === 'send') {
    return { status: 'sent', sentAt: current.sentAt ?? at, updatedAt: at };
  }
  if (action === 'view') {
    return { status: 'viewed', viewedAt: current.viewedAt ?? at, updatedAt: at };
  }
  if (action === 'accept') {
    return { status: 'accepted', acceptedAt: at, acceptedBy: actor, updatedAt: at };
  }
  if (action === 'decline') {
    return { status: 'declined', declinedAt: at, updatedAt: at };
  }
  return { status: 'superseded', updatedAt: at };
}

export function nextProposalVersion(existingMax: number): number {
  return Math.max(0, existingMax) + 1;
}

export function guestProposalView(record: ProposalRecord): ProposalRecord {
  // Guests never see internal draft-only notes beyond the client document.
  return record;
}

export class ProposalService {
  async listForEvent(db: Db, ctx: TenantContext, eventId: string): Promise<ProposalRecord[]> {
    const deal = await DealRepository.findById(db, ctx, eventId);
    if (!deal) throw new NotFoundError('Event');
    return ProposalRepository.listByEvent(db, ctx, eventId);
  }

  async latestForEvent(db: Db, ctx: TenantContext, eventId: string): Promise<ProposalRecord | null> {
    const row = await ProposalRepository.latestForEvent(db, ctx, eventId);
    return row ? serializeProposal(row) : null;
  }

  async create(db: Db, ctx: TenantContext, payload: CreateProposalPayload): Promise<ProposalRecord> {
    const deal = await DealRepository.findById(db, ctx, payload.eventId);
    if (!deal) throw new NotFoundError('Event');
    const meta =
      deal.importMeta && typeof deal.importMeta === 'object'
        ? (deal.importMeta as Record<string, unknown>)
        : {};
    const now = new Date();
    const version = nextProposalVersion(await ProposalRepository.maxVersion(db, ctx, payload.eventId));

    const latest = await ProposalRepository.latestForEvent(db, ctx, payload.eventId);
    if (latest && (latest.status === 'sent' || latest.status === 'viewed' || latest.status === 'draft')) {
      await ProposalRepository.updateOne(db, ctx, latest._id, { status: 'superseded' });
    }

    const packageTotal =
      payload.packageTotal != null ? money(payload.packageTotal) : money(meta.grandTotal) || money(deal.amount);

    const sendNow = Boolean(payload.send);
    const doc = await ProposalRepository.insertOne(db, ctx, {
      tenantId: ctx.tenantId ?? deal.tenantId ?? 'hub-wichita',
      eventId: payload.eventId,
      eventTitle: payload.eventTitle?.trim() || String(deal.title ?? 'Event'),
      version,
      status: sendNow ? 'sent' : 'draft',
      title: payload.title?.trim() || `Proposal for ${deal.title}`,
      summary: payload.summary?.trim() || String(deal.notes ?? ''),
      packageTotal,
      terms:
        payload.terms?.trim() ||
        'HuB on Lewis event agreement — cancellation, insurance, and vendor load-in policies apply.',
      space: payload.space ?? (typeof meta.space === 'string' ? meta.space : undefined),
      eventDate: payload.eventDate ?? (typeof meta.eventDateIso === 'string' ? meta.eventDateIso : undefined),
      guests: payload.guests ?? (typeof meta.guests === 'number' ? meta.guests : undefined),
      token: token(),
      createdAt: now,
      updatedAt: now,
      sentAt: sendNow ? now : undefined,
      createdBy: ctx.userName,
      supersedesId: latest?._id,
    });

    await this.stampDealProposal(db, ctx, payload.eventId, sendNow ? 'sent' : 'draft', version);
    return serializeProposal(doc);
  }

  async update(
    db: Db,
    ctx: TenantContext,
    id: string,
    payload: PatchProposalPayload,
  ): Promise<ProposalRecord> {
    const existing = await ProposalRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('Proposal');

    const patch: Partial<ProposalDoc> = {};
    if (payload.title !== undefined) patch.title = payload.title;
    if (payload.summary !== undefined) patch.summary = payload.summary;
    if (payload.packageTotal !== undefined) patch.packageTotal = money(payload.packageTotal);
    if (payload.terms !== undefined) patch.terms = payload.terms;

    if (payload.send) {
      Object.assign(patch, applyProposalAction(existing, 'send', new Date(), ctx.userName));
    }

    const updated = await ProposalRepository.updateOne(db, ctx, id, patch);
    if (!updated) throw new NotFoundError('Proposal');
    await this.stampDealProposal(db, ctx, updated.eventId, updated.status, updated.version);
    return serializeProposal(updated);
  }

  async markViewed(db: Db, ctx: TenantContext, id: string): Promise<ProposalRecord> {
    const existing = await ProposalRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('Proposal');
    if (existing.status === 'accepted' || existing.status === 'declined' || existing.status === 'superseded') {
      return serializeProposal(existing);
    }
    if (existing.status === 'draft') {
      throw new ValidationError('Proposal has not been sent yet');
    }
    const patch = applyProposalAction(existing, 'view', new Date(), 'client');
    const updated = await ProposalRepository.updateOne(db, ctx, id, patch);
    if (!updated) throw new NotFoundError('Proposal');
    await this.stampDealProposal(db, ctx, updated.eventId, updated.status, updated.version);
    return serializeProposal(updated);
  }

  async accept(
    db: Db,
    ctx: TenantContext,
    id: string,
    sign: ProposalSignPayload,
    actorName: string,
  ): Promise<ProposalRecord> {
    const existing = await ProposalRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('Proposal');
    const name = sign.name?.trim();
    if (!name) throw new ValidationError('Signature name is required');
    if (sign.method === 'drawn' && !sign.dataUrl) {
      throw new ValidationError('Drawn signature is required');
    }
    const now = new Date();
    const patch: Partial<ProposalDoc> = {
      ...applyProposalAction(existing, 'accept', now, actorName),
      signature: {
        method: sign.method,
        name,
        dataUrl: sign.dataUrl,
        signedAt: now,
      },
      acceptedBy: name,
    };
    const updated = await ProposalRepository.updateOne(db, ctx, id, patch);
    if (!updated) throw new NotFoundError('Proposal');
    await this.stampDealProposal(db, ctx, updated.eventId, 'accepted', updated.version);
    return serializeProposal(updated);
  }

  private async stampDealProposal(
    db: Db,
    ctx: TenantContext,
    eventId: string,
    status: ProposalStatus,
    version: number,
  ): Promise<void> {
    const deal = await DealRepository.findById(db, ctx, eventId);
    if (!deal) return;
    const meta =
      deal.importMeta && typeof deal.importMeta === 'object'
        ? { ...(deal.importMeta as Record<string, unknown>) }
        : {};
    meta.proposalStatus = status;
    meta.proposalVersion = version;
    meta.lastContactedIso = new Date().toISOString().slice(0, 10);
    await DealRepository.updateOne(db, ctx, eventId, { importMeta: meta } as never);
  }
}

export const proposalService = new ProposalService();
