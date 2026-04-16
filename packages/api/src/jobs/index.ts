// packages/api/src/jobs/index.ts
//
// AUTOMATION JOB REGISTRY
// ────────────────────────
// All scheduled and event-driven jobs register here.
// Uses node-cron for scheduling. Add to package.json deps when activating.
//
// Event-driven jobs fire via EventEmitter pattern from services.
// Scheduled jobs run via cron expressions.
//
// TO ACTIVATE: npm install node-cron @types/node-cron (in packages/api)
//              Uncomment the scheduler block in registerJobs()

import type { Db } from 'mongodb';
import { runKarmakSync } from '../integrations/karmak/index.js';
import { buildTenantId, ENTITIES, LOCATIONS, type Entity, type Location } from '@mtte-core/shared';

// ── Event types ───────────────────────────────────────────────────
export type AppEvent =
  | { type: 'lead.created';        leadId: string; tenantId: string }
  | { type: 'lead.status_changed'; leadId: string; from: string; to: string; tenantId: string }
  | { type: 'lead.stale';          leadId: string; daysIdle: number; tenantId: string }
  | { type: 'deal.approved';       dealId: string; approver: string; tenantId: string }
  | { type: 'deal.won';            dealId: string; tenantId: string; amount: number }
  | { type: 'deal.in_build';       dealId: string; tenantId: string }
  | { type: 'deal.delivered';      dealId: string; tenantId: string };

export type EventHandler = (event: AppEvent, db: Db) => Promise<void>;

/** In-memory event bus — swap for Redis pub/sub in a multi-instance deployment */
class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(type: AppEvent['type'], handler: EventHandler) {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(type, [...list, handler]);
  }

  async emit(event: AppEvent, db: Db) {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.allSettled(
      handlers.map(h => h(event, db).catch(err => {
        console.error(`[EventBus] Handler error for ${event.type}:`, err);
      }))
    );
  }
}

export const eventBus = new EventBus();

// ── Event handlers ────────────────────────────────────────────────
eventBus.on('deal.in_build', async (event, _db) => {
  if (event.type !== 'deal.in_build') return;
  // TODO: trigger Karmak work order creation
  console.log(`[Job] Deal ${event.dealId} moved to In Build — trigger Karmak work order`);
});

eventBus.on('deal.won', async (event, _db) => {
  if (event.type !== 'deal.won') return;
  // TODO: calculate and record commission
  // TODO: trigger CSI survey email
  console.log(`[Job] Deal ${event.dealId} won (${event.amount}) — record commission + queue CSI survey`);
});

eventBus.on('deal.approved', async (event, _db) => {
  if (event.type !== 'deal.approved') return;
  // TODO: send Slack/email notification to next approver
  console.log(`[Job] Deal ${event.dealId} approved by ${event.approver} — notify next approver`);
});

eventBus.on('lead.status_changed', async (event, _db) => {
  if (event.type !== 'lead.status_changed') return;
  if (event.to === 'Lost') {
    console.log(`[Job] Lead ${event.leadId} lost — log for win/loss analysis`);
  }
});

// ── Scheduled jobs ────────────────────────────────────────────────

/** Lead aging check — finds leads with no activity in N days, fires alert */
export async function checkStaleLeads(db: Db, idleDays = 3): Promise<void> {
  const cutoff = new Date(Date.now() - idleDays * 86_400_000);
  const stale  = await db.collection('leads')
    .find({
      status:    { $in: ['New', 'Contacted', 'Working', 'Quoted'] },
      updatedAt: { $lt: cutoff },
    })
    .project({ _id: 1, tenantId: 1, assignedTo: 1, company: 1, updatedAt: 1 })
    .limit(100)
    .toArray();

  for (const lead of stale) {
    const daysIdle = Math.floor((Date.now() - new Date(lead['updatedAt'] as Date).getTime()) / 86_400_000);
    await eventBus.emit(
      { type: 'lead.stale', leadId: lead._id.toString(), daysIdle, tenantId: lead['tenantId'] as string },
      db,
    );
  }
  if (stale.length) console.log(`[Job] Stale leads: ${stale.length} flagged`);
}

/** Karmak nightly sync across all active tenants */
export async function runNightlySync(db: Db): Promise<void> {
  console.log('[Job] Starting nightly Karmak sync…');
  const tenants = (ENTITIES as readonly Entity[]).flatMap((e: Entity) =>
    (LOCATIONS as readonly Location[]).map((l: Location) => buildTenantId(e, l))
  );

  const results = await Promise.allSettled(
    tenants.map((tid: string) => runKarmakSync(db, tid))
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed    = results.filter((r) => r.status === 'rejected').length;
  console.log(`[Job] Karmak sync complete: ${succeeded} tenants OK, ${failed} failed`);
}

/**
 * Register scheduled jobs — call from server.ts after DB connects.
 *
 * Example (requires node-cron):
 *
 *   import cron from 'node-cron';
 *   registerJobs(getDB());
 */
export function registerJobs(db: Db): void {
  // TODO: uncomment when node-cron is installed
  // cron.schedule('0 2 * * *', () => runNightlySync(db));         // 2am daily
  // cron.schedule('0 8 * * 1-5', () => checkStaleLeads(db, 3));  // 8am weekdays
  console.log('[Jobs] Scheduler registered (node-cron not yet installed — uncomment in jobs/index.ts)');
}
