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
    opts: { tenantId: string | null; isSuperAdmin: boolean },
  ) {
    const HUB_VENUE_IDS = ['hub-wichita', 'hub-on-lewis'];
    const authenticatedTenant = opts.tenantId ?? 'hub-wichita';
    const tenantScope =
      opts.isSuperAdmin || !opts.tenantId
        ? HUB_VENUE_IDS
        : isHubVenueTenantId(opts.tenantId)
          ? HUB_VENUE_IDS
          : [opts.tenantId];

    const refreshOr = [
      { source: 'perfect_venue_refresh' },
      { 'importMeta.source': 'perfect_venue_refresh' },
    ];
    const baseMatch = { tenantId: { $in: tenantScope }, $or: refreshOr };
    const activeStatuses = ['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build'];

    const dealsCol = db.collection('deals');
    const paymentsCol = db.collection('hub_payments');

    const [totalRefresh, activePipeline, byTenant, byStatus, lastImport, samples] =
      await Promise.all([
        dealsCol.countDocuments(baseMatch),
        dealsCol.countDocuments({
          ...baseMatch,
          status: { $in: activeStatuses },
        }),
        dealsCol
          .aggregate([
            { $match: { $or: refreshOr } },
            { $group: { _id: '$tenantId', count: { $sum: 1 } } },
          ])
          .toArray(),
        dealsCol
          .aggregate([
            { $match: baseMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ])
          .toArray(),
        dealsCol.findOne(
          { ...baseMatch, 'importMeta.importBatchId': { $exists: true } },
          { sort: { updatedAt: -1 }, projection: { 'importMeta.importBatchId': 1, updatedAt: 1 } },
        ),
        dealsCol
          .find(baseMatch, { projection: { title: 1, status: 1, tenantId: 1, amount: 1 } })
          .sort({ updatedAt: -1 })
          .limit(10)
          .toArray(),
      ]);

    const paymentCount = await paymentsCol.countDocuments({
      tenantId: { $in: tenantScope },
      $or: refreshOr,
    });

    return {
      authenticatedTenant,
      tenantScope,
      deals: {
        refreshTotal: totalRefresh,
        activePipeline,
        byTenant: Object.fromEntries(byTenant.map(r => [String(r._id), r.count])),
        byStatus: Object.fromEntries(byStatus.map(r => [String(r._id), r.count])),
        lastImportBatchId: lastImport?.importMeta?.importBatchId ?? null,
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
}

export const adminService = new AdminService();
