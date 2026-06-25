// packages/api/src/services/AdminService.ts
import type { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { CreateUserPayload } from '@hub-crm/shared';
import { buildTenantId, isHubVenueTenantId, normalizeEntity, normalizeLocation } from '@hub-crm/shared';
import type { Entity, Location } from '@hub-crm/shared';
import { env } from '../config/env.js';
import { parseMongoDbName, parseMongoHost } from '../config/mongoTarget.js';

const HUB_VENUE_IDS = ['hub-wichita', 'hub-on-lewis'];
const REFRESH_SOURCE_OR = [
  { source: 'perfect_venue_refresh' },
  { 'importMeta.source': 'perfect_venue_refresh' },
] as const;
const REFRESH_PAYMENT_OR = [
  ...REFRESH_SOURCE_OR,
  { importBatchId: { $regex: '^hub-refresh-' } },
] as const;
const ACTIVE_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build'];

async function countByField(
  db: Db,
  collection: string,
  field: string,
  match: Record<string, unknown> = {},
): Promise<Record<string, number>> {
  const rows = await db
    .collection(collection)
    .aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  return Object.fromEntries(rows.map(r => [String(r._id ?? '(null)'), r.count as number]));
}

export class AdminService {
  async listUsers(db: Db) {
    return UserRepository.listAll(db);
  }

  async createUser(db: Db, payload: CreateUserPayload) {
    const existing = await UserRepository.findByEmail(db, payload.email);
    if (existing) throw new ConflictError('Email already in use');

    const entity   = normalizeEntity(payload.entity);
    const location = normalizeLocation(payload.location);
    const tenantId = buildTenantId(entity, location);
    const hashed   = await bcrypt.hash(payload.password, 12);

    const inserted = await UserRepository.insertOne(db, { tenantId } as never, {
      tenantId,
      name:         payload.name,
      email:        payload.email.toLowerCase(),
      passwordHash: hashed,
      role:         payload.role,
      entity,
      location,
      active:       true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
    });

    // Never return the hash to the client
    const { passwordHash: _pw, ...safeUser } = inserted as typeof inserted & { passwordHash?: string };
    return safeUser;
  }

  async deactivateUser(db: Db, id: string) {
    const ok = await UserRepository.deactivate(db, id);
    if (!ok) throw new NotFoundError('User');
  }

  async stats(db: Db) {
    const superCtx = {
      tenantId:        null,
      defaultEntity:  '',
      defaultLocation:  '',
      userId:          '',
      userRole:        'super_admin',
      userName:        '',
      isCrossTenant:   true,
      isSuperAdmin:    true,
    };
    const [leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus] = await Promise.all([
      LeadRepository.byTenantCounts(db),
      DealRepository.byTenantCounts(db),
      LeadRepository.statusCounts(db, superCtx),
      DealRepository.statusCounts(db, superCtx),
    ]);
    return { leadsByTenant, dealsByTenant, leadsByStatus, dealsByStatus };
  }

  async syncStatus(db: Db) {
    return db.collection('karmak_sync').find({}).sort({ lastSyncAt: -1 }).limit(50).toArray();
  }

  async hubRefreshStatus(
    db: Db,
    opts: { tenantId: string | null; isSuperAdmin: boolean; apiVersion?: string },
  ) {
    const authenticatedTenant = opts.tenantId ?? 'hub-wichita';
    const tenantScope =
      opts.isSuperAdmin || !opts.tenantId
        ? HUB_VENUE_IDS
        : isHubVenueTenantId(opts.tenantId)
          ? HUB_VENUE_IDS
          : [opts.tenantId];

    const dealsCol = db.collection('deals');
    const paymentsCol = db.collection('hub_payments');
    const tenantIn = { tenantId: { $in: tenantScope } };
    const refreshMatch = { ...tenantIn, $or: [...REFRESH_SOURCE_OR] };

    const [
      totalRefresh,
      activePipeline,
      byTenant,
      byStatus,
      lastImport,
      samples,
      paymentCount,
      databaseProbe,
    ] = await Promise.all([
      dealsCol.countDocuments(refreshMatch),
      dealsCol.countDocuments({
        ...refreshMatch,
        status: { $in: ACTIVE_STATUSES },
      }),
      dealsCol
        .aggregate([
          { $match: { $or: [...REFRESH_SOURCE_OR] } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
        ])
        .toArray(),
      dealsCol
        .aggregate([
          { $match: refreshMatch },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),
      dealsCol.findOne(
        {
          ...tenantIn,
          $or: [
            { 'importMeta.importBatchId': { $exists: true } },
            { importBatchId: { $regex: '^hub-refresh-' } },
          ],
        },
        {
          sort: { updatedAt: -1 },
          projection: { 'importMeta.importBatchId': 1, importBatchId: 1, updatedAt: 1 },
        },
      ),
      dealsCol
        .find(refreshMatch, { projection: { title: 1, status: 1, tenantId: 1, amount: 1 } })
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
      paymentsCol.countDocuments({
        ...tenantIn,
        $or: [...REFRESH_PAYMENT_OR],
      }),
      this.probeDatabase(db),
    ]);

    return {
      authenticatedTenant,
      tenantScope,
      database: {
        ...databaseProbe,
        configuredDbName: env.DB_NAME,
        connectedDbName: db.databaseName,
        mongoHost: parseMongoHost(env.MONGODB_URI),
        nodeEnv: env.NODE_ENV,
        apiVersion: opts.apiVersion,
      },
      deals: {
        refreshTotal: totalRefresh,
        activePipeline,
        byTenant: Object.fromEntries(byTenant.map(r => [String(r._id), r.count])),
        byStatus: Object.fromEntries(byStatus.map(r => [String(r._id), r.count])),
        lastImportBatchId:
          (lastImport?.importMeta as { importBatchId?: string } | undefined)?.importBatchId ??
          (lastImport as { importBatchId?: string } | null)?.importBatchId ??
          null,
        lastImportUpdatedAt: lastImport?.updatedAt ?? null,
        sampleTitles: samples.map(d => ({
          title: d.title,
          status: d.status,
          tenantId: d.tenantId,
          amount: d.amount,
        })),
      },
      payments: { refreshTotal: paymentCount },
    };
  }

  private async probeDatabase(db: Db) {
    const dealsCol = db.collection('deals');
    const paymentsCol = db.collection('hub_payments');
    const hubTenantIn = { tenantId: { $in: HUB_VENUE_IDS } };

    const collections = await db.listCollections().toArray();
    const collectionCounts: Record<string, number> = {};
    for (const c of collections) {
      collectionCounts[c.name] = await db.collection(c.name).countDocuments();
    }

    const [
      totalDeals,
      hubTenantDeals,
      refreshImportMeta,
      refreshSource,
      refreshSourceSystem,
      refreshImportedFrom,
      totalPayments,
      hubPayments,
      refreshPaymentsByBatch,
      newestDeals,
    ] = await Promise.all([
      dealsCol.countDocuments({}),
      dealsCol.countDocuments(hubTenantIn),
      dealsCol.countDocuments({ 'importMeta.source': 'perfect_venue_refresh' }),
      dealsCol.countDocuments({ source: 'perfect_venue_refresh' }),
      dealsCol.countDocuments({ sourceSystem: 'perfect_venue_refresh' }),
      dealsCol.countDocuments({ importedFrom: 'perfect_venue_refresh' }),
      paymentsCol.countDocuments({}),
      paymentsCol.countDocuments(hubTenantIn),
      paymentsCol.countDocuments({ importBatchId: { $regex: '^hub-refresh-' } }),
      dealsCol
        .find(
          {},
          {
            projection: {
              title: 1,
              name: 1,
              tenantId: 1,
              source: 1,
              importMeta: 1,
              status: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      collectionCounts,
      deals: {
        total: totalDeals,
        hubTenantScope: hubTenantDeals,
        refreshByImportMetaSource: refreshImportMeta,
        refreshBySource: refreshSource,
        refreshBySourceSystem: refreshSourceSystem,
        refreshByImportedFrom: refreshImportedFrom,
        newestSamples: newestDeals.map(d => ({
          title: d.title ?? d.name ?? null,
          tenantId: d.tenantId ?? null,
          source: d.source ?? null,
          importMetaSource:
            d.importMeta && typeof d.importMeta === 'object' && 'source' in d.importMeta
              ? String((d.importMeta as { source?: string }).source ?? '')
              : null,
          status: d.status ?? null,
          updatedAt: d.updatedAt ?? null,
        })),
      },
      payments: {
        total: totalPayments,
        hubTenantScope: hubPayments,
        refreshByImportBatchId: refreshPaymentsByBatch,
        byTenant: await countByField(db, 'hub_payments', 'tenantId'),
      },
    };
  }
}

export const adminService = new AdminService();
