import type { Db } from 'mongodb';
import {
  evaluateLiveVenueAgents,
  type LiveAgentEvent,
  type LiveAgentInquiry,
} from '@hub-crm/shared';
import { DealRepository } from '../repositories/DealRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { AgentRunRepository } from '../repositories/AgentRunRepository.js';
import type { TenantContext } from '../tenancy/index.js';
import { aiService } from './AiService.js';
import { NotFoundError } from '../errors/index.js';

function moneyNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v.trim()) return v;
  return null;
}

function mapDeal(d: Record<string, unknown>): LiveAgentEvent {
  const meta = (d.importMeta && typeof d.importMeta === 'object' ? d.importMeta : {}) as Record<string, unknown>;
  const value = moneyNum(meta.grandTotal) || moneyNum(d.amount);
  const amountPaid = moneyNum(meta.amountPaid);
  const balanceDue =
    typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, value - amountPaid);
  return {
    id: String(d._id ?? ''),
    title: String(d.title ?? 'Event'),
    contact: String(d.contact ?? d.company ?? 'Contact'),
    status: String(d.status ?? 'Draft'),
    pvStatus: typeof meta.pvStatus === 'string' ? meta.pvStatus : null,
    eventDateIso:
      (typeof meta.eventDateIso === 'string' && meta.eventDateIso) ||
      (typeof meta.eventDate === 'string' && meta.eventDate) ||
      null,
    value,
    amountPaid,
    balanceDue,
    guests: typeof meta.guests === 'number' ? meta.guests : 0,
    space: typeof meta.space === 'string' ? meta.space : null,
    updatedAt: iso(d.updatedAt) ?? iso(d.lastTouchedAt),
  };
}

function mapLead(l: Record<string, unknown>): LiveAgentInquiry {
  return {
    id: String(l._id ?? ''),
    contact: String(l.contact ?? 'Contact'),
    company: String(l.company ?? ''),
    status: String(l.status ?? 'New'),
    updatedAt: iso(l.lastTouchedAt) ?? iso(l.updatedAt),
    source: typeof l.source === 'string' ? l.source : null,
  };
}

export class AgentService {
  async evaluate(db: Db, ctx: TenantContext, opts?: { withLlm?: boolean }) {
    const [deals, leads] = await Promise.all([
      DealRepository.listDeals(db, ctx, {}, { page: 1, limit: 200, sort: 'updatedAt', order: 'desc' }),
      LeadRepository.listLeads(db, ctx, { activeOnly: true }, { page: 1, limit: 100, sort: 'updatedAt', order: 'desc' }),
    ]);

    const events = (deals.data as unknown as Array<Record<string, unknown>>).map(mapDeal);
    const inquiries = (leads.data as unknown as Array<Record<string, unknown>>).map(mapLead);
    const evaluation = evaluateLiveVenueAgents(events, inquiries);

    let llmBriefing: string | null = null;
    if (opts?.withLlm !== false && evaluation.findings.length > 0) {
      const top = evaluation.findings.slice(0, 8);
      const result = await aiService.enhance({
        kind: 'owner_note',
        input: `${evaluation.briefingHeadline}\n${evaluation.briefingSummary}\n\n${top
          .map(f => `- [${f.priority}] ${f.agentLabel}: ${f.title} — ${f.detail}`)
          .join('\n')}`,
        context: 'HuB on Lewis morning agent briefing. Be specific. Do not invent events.',
      });
      if (result.enhanced) llmBriefing = result.output;
    }

    const run = await AgentRunRepository.insertOne(db, ctx, {
      tenantId: ctx.tenantId ?? 'hub-wichita',
      generatedAt: new Date(),
      evaluation,
      llmBriefing,
      decisions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return run;
  }

  async latest(db: Db, ctx: TenantContext) {
    const existing = await AgentRunRepository.latest(db, ctx);
    if (existing) return existing;
    return this.evaluate(db, ctx, { withLlm: false });
  }

  async decide(
    db: Db,
    ctx: TenantContext,
    findingId: string,
    decision: 'approve' | 'dismiss',
  ) {
    const latest = await AgentRunRepository.latest(db, ctx);
    if (!latest) throw new NotFoundError('Agent run');
    const decisions = [
      ...(latest.decisions ?? []),
      { findingId, decision, at: new Date().toISOString(), by: ctx.userName },
    ];
    const updated = await AgentRunRepository.updateOne(db, ctx, latest._id, { decisions } as never);
    if (!updated) throw new NotFoundError('Agent run');
    return updated;
  }
}

export const agentService = new AgentService();
