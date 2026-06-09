// packages/api/src/services/AdminService.ts
import type { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { LeadRepository } from '../repositories/LeadRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { ConflictError, NotFoundError } from '../errors/index.js';
import type { CreateUserPayload } from '@hub-crm/shared';
import { buildTenantId, normalizeEntity, normalizeLocation } from '@hub-crm/shared';
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
}

export const adminService = new AdminService();
