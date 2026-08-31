import type { Db } from 'mongodb';
import cron from 'node-cron';
import { agentService } from '../services/AgentService.js';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { InteractionRepository, type InteractionDoc } from '../repositories/InteractionRepository.js';

export type AppEvent =
  | { type: 'lead.created'; leadId: string; tenantId: string }
  | { type: 'lead.status_changed'; leadId: string; from: string; to: string; tenantId: string }
  | { type: 'lead.stale'; leadId: string; daysIdle: number; tenantId: string }
  | { type: 'deal.created'; dealId: string; tenantId: string }
  | { type: 'event.stage_changed'; dealId: string; from: string; to: string; tenantId: string }
  | { type: 'event.confirmed'; dealId: string; tenantId: string }
  | { type: 'event.completed'; dealId: string; tenantId: string };

export type EventHandler = (event: AppEvent, db: Db) => Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(type: AppEvent['type'], handler: EventHandler) {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...list, handler]);
  }

  async emit(event: AppEvent, db: Db) {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.allSettled(
      handlers.map(h =>
        h(event, db).catch(err => {
          console.error(`[EventBus] Handler error for ${event.type}:`, err);
        }),
      ),
    );
  }
}

export const eventBus = new EventBus();

async function recordDealActivity(
  event: { dealId: string; tenantId: string },
  db: Db,
  summary: string,
  body: string,
): Promise<void> {
  if (typeof (db as any)?.collection !== 'function') return;
  const ctx = jobTenant(event.tenantId);
  const deal = await DealRepository.findById(db, ctx, event.dealId);
  if (!deal?.companyId) return;
  const now = new Date();
  const activity: Omit<InteractionDoc, '_id'> = {
    tenantId: deal.tenantId,
    companyId: deal.companyId,
    companyName: deal.company,
    relatedDealId: deal._id,
    type: 'note',
    direction: 'outbound',
    summary,
    body,
    outcome: 'other',
    status: 'completed',
    createdAt: now,
    createdByUserId: 'system',
    createdByName: 'Hub system',
    ownerUserId: deal.ownerUserId ?? 'system',
    ownerName: deal.assignedTo ?? 'Hub system',
    completedAt: now,
    completedByUserId: 'system',
    completedByName: 'Hub system',
    attachments: [],
    metadata: { source: 'deal_lifecycle' },
    updatedAt: now,
  };
  await InteractionRepository.insertOne(db, ctx, activity);
}

eventBus.on('deal.created', async (event, db) => {
  if (event.type !== 'deal.created') return;
  await recordDealActivity(event, db, 'Deal created', 'Opportunity created from the live CRM workflow.');
});

eventBus.on('event.stage_changed', async (event, db) => {
  if (event.type !== 'event.stage_changed') return;
  await recordDealActivity(event, db, 'Deal stage changed', `Stage changed from ${event.from} to ${event.to}.`);
  console.log(`[Job] Event ${event.dealId} ${event.from} → ${event.to}`);
});

eventBus.on('event.confirmed', async event => {
  if (event.type !== 'event.confirmed') return;
  console.log(`[Job] Event confirmed ${event.dealId}`);
});

eventBus.on('event.completed', async event => {
  if (event.type !== 'event.completed') return;
  console.log(`[Job] Event completed ${event.dealId}`);
});

eventBus.on('lead.stale', async event => {
  if (event.type !== 'lead.stale') return;
  console.log(`[Job] Stale lead ${event.leadId} (${event.daysIdle}d idle)`);
});

export async function checkStaleLeads(db: Db, idleDays = 3): Promise<void> {
  const cutoff = new Date(Date.now() - idleDays * 86_400_000);
  const stale = await db
    .collection('leads')
    .find({
      status: { $in: ['New', 'Contacted', 'Working', 'Quoted'] },
      updatedAt: { $lt: cutoff },
    })
    .project({ _id: 1, tenantId: 1, updatedAt: 1 })
    .limit(100)
    .toArray();

  for (const lead of stale) {
    const daysIdle = Math.floor(
      (Date.now() - new Date(lead['updatedAt'] as Date).getTime()) / 86_400_000,
    );
    await eventBus.emit(
      {
        type: 'lead.stale',
        leadId: lead._id.toString(),
        daysIdle,
        tenantId: String(lead['tenantId'] ?? 'hub-wichita'),
      },
      db,
    );
  }
  if (stale.length) console.log(`[Job] Stale leads: ${stale.length} flagged`);
}

function jobTenant(tenantId: string): TenantContext {
  return {
    tenantId,
    defaultEntity: 'hub',
    defaultLocation: 'wichita',
    userId: 'scheduler',
    userRole: 'admin',
    userName: 'Hub scheduler',
    isCrossTenant: true,
    isSuperAdmin: true,
  };
}

export async function runAgentSnapshotJob(db: Db): Promise<void> {
  const tenantIds = await db.collection('deals').distinct('tenantId');
  const ids = (tenantIds.length ? tenantIds : ['hub-wichita']).map(String);
  for (const tenantId of ids) {
    try {
      await agentService.evaluate(db, jobTenant(tenantId), { withLlm: true });
      console.log(`[Job] Agent snapshot stored for ${tenantId}`);
    } catch (err) {
      console.error(`[Job] Agent snapshot failed for ${tenantId}:`, err);
    }
  }
}

export function registerJobs(db: Db): void {
  cron.schedule('0 * * * *', () => {
    void checkStaleLeads(db, 3);
  });
  cron.schedule('15 */4 * * *', () => {
    void runAgentSnapshotJob(db);
  });
  console.log('[Jobs] Scheduler active — stale leads hourly, agent snapshot every 4 hours');
}
