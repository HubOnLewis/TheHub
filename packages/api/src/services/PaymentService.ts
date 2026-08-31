import type { Db } from 'mongodb';
import type { CreatePaymentLinkPayload, PatchPaymentLinkPayload, PaymentLinkRecord } from '@hub-crm/shared';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { PaymentRepository, serializePayment, type PaymentLinkDoc } from '../repositories/PaymentRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import type { TenantContext } from '../tenancy/index.js';

function token(): string {
  return `hub_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function money(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function applyStaffPaymentToMeta(
  meta: Record<string, unknown>,
  dealAmount: number,
  payment: { amount: number; kind: string; paymentLinkId?: string },
): Record<string, unknown> {
  const grandTotal = money(meta.grandTotal) || money(dealAmount);
  const existingPaid = money(meta.amountPaid);
  const amountPaid = Math.round((existingPaid + payment.amount) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100);
  const payments = Array.isArray(meta.payments) ? [...(meta.payments as unknown[])] : [];
  payments.push({
    amount: payment.amount,
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'Staff-recorded (not Stripe)',
    paymentType: payment.kind,
    paymentLinkId: payment.paymentLinkId,
  });
  return {
    ...meta,
    grandTotal,
    amountPaid,
    balanceDue,
    depositPaid: amountPaid > 0,
    paidInFull: grandTotal > 0 && balanceDue <= 0,
    payments,
    lastContactedIso: new Date().toISOString().slice(0, 10),
  };
}


export class PaymentService {
  async listForEvent(db: Db, ctx: TenantContext, eventId: string): Promise<PaymentLinkRecord[]> {
    const deal = await DealRepository.findById(db, ctx, eventId);
    if (!deal) throw new NotFoundError('Event');
    return PaymentRepository.listByEvent(db, ctx, eventId);
  }

  async create(db: Db, ctx: TenantContext, payload: CreatePaymentLinkPayload): Promise<PaymentLinkRecord> {
    const deal = await DealRepository.findById(db, ctx, payload.eventId);
    if (!deal) throw new NotFoundError('Event');
    const amount = money(payload.amount);
    if (!(amount > 0)) throw new ValidationError('Amount must be greater than 0');

    const now = new Date();
    const doc = await PaymentRepository.insertOne(db, ctx, {
      tenantId: ctx.tenantId ?? 'hub-wichita',
      eventId: payload.eventId,
      eventTitle: payload.eventTitle?.trim() || String(deal.title ?? 'Event'),
      kind: payload.kind,
      amount,
      currency: 'USD',
      status: 'created',
      token: token(),
      note: payload.note,
      dueDate: payload.dueDate,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userName,
    });
    return serializePayment(doc);
  }

  async update(
    db: Db,
    ctx: TenantContext,
    id: string,
    payload: PatchPaymentLinkPayload,
  ): Promise<PaymentLinkRecord> {
    const existing = await PaymentRepository.findById(db, ctx, id);
    if (!existing) throw new NotFoundError('Payment link');

    const nextStatus = payload.status ?? existing.status;
    const patch: Partial<PaymentLinkDoc> = {
      note: payload.note ?? existing.note,
      status: nextStatus,
    };
    if (nextStatus === 'paid' && existing.status !== 'paid') {
      patch.paidAt = new Date();
    }
    const updated = await PaymentRepository.updateOne(db, ctx, id, patch);
    if (!updated) throw new NotFoundError('Payment link');

    if (nextStatus === 'paid' && existing.status !== 'paid') {
      await this.applyPaidToDeal(db, ctx, updated);
    }
    return serializePayment(updated);
  }

  private async applyPaidToDeal(
    db: Db,
    ctx: TenantContext,
    link: PaymentLinkDoc & { _id: string },
  ): Promise<void> {
    const deal = await DealRepository.findById(db, ctx, link.eventId);
    if (!deal) return;
    const meta =
      deal.importMeta && typeof deal.importMeta === 'object'
        ? { ...(deal.importMeta as Record<string, unknown>) }
        : {};
    const importMeta = applyStaffPaymentToMeta(meta, money(deal.amount), {
      amount: link.amount,
      kind: link.kind,
      paymentLinkId: link._id,
    });
    await DealRepository.updateOne(db, ctx, link.eventId, {
      amount: money(importMeta.grandTotal),
      importMeta,
    } as never);
  }
}

export const paymentService = new PaymentService();
