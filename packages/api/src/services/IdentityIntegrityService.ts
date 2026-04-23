import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { ValidationError, NotFoundError } from '../errors/index.js';
import { CompanyRepository } from '../repositories/CompanyRepository.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { UnitRepository } from '../repositories/UnitRepository.js';
import { BuildRepository } from '../repositories/BuildRepository.js';
import { ProductionJobRepository } from '../repositories/ProductionJobRepository.js';

export class IdentityIntegrityService {
  async resolveCanonicalCompany(
    db: Db,
    ctx: TenantContext,
    input: { companyId?: string; companyName?: string },
  ) {
    if (input.companyId) {
      const company = await CompanyRepository.findById(db, ctx, input.companyId);
      if (!company) throw new NotFoundError('Company');
      return company;
    }
    const name = input.companyName?.trim();
    if (!name) throw new ValidationError('companyId is required');
    const matches = await CompanyRepository.search(db, ctx, name, 5);
    const exact = matches.filter(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (exact.length === 1) return exact[0]!;
    if (exact.length > 1) throw new ValidationError('Ambiguous company match; provide companyId');
    throw new ValidationError('Unable to resolve company by name; provide companyId');
  }

  async validateInteractionContext(
    db: Db,
    ctx: TenantContext,
    input: { companyId: string; relatedDealId?: string; unitId?: string; buildId?: string },
  ) {
    const company = await CompanyRepository.findById(db, ctx, input.companyId);
    if (!company) throw new NotFoundError('Company');
    const deal = input.relatedDealId ? await DealRepository.findById(db, ctx, input.relatedDealId) : null;
    const unit = input.unitId ? await UnitRepository.findById(db, ctx, input.unitId) : null;
    const build = input.buildId ? await BuildRepository.findById(db, ctx, input.buildId) : null;
    if (input.relatedDealId && !deal) throw new NotFoundError('Deal');
    if (input.unitId && !unit) throw new NotFoundError('Unit');
    if (input.buildId && !build) throw new NotFoundError('Build');
    if (deal && (deal as any).companyId && (deal as any).companyId !== input.companyId) {
      throw new ValidationError('relatedDealId is linked to a different companyId');
    }
    if (unit && unit.companyId !== input.companyId) {
      throw new ValidationError('unitId is linked to a different companyId');
    }
    if (build && unit && build.unitId !== unit._id) {
      throw new ValidationError('buildId and unitId conflict');
    }
    if (build && deal && build.dealId && build.dealId !== deal._id) {
      throw new ValidationError('buildId and relatedDealId conflict');
    }
    if (build) {
      const buildUnit = await UnitRepository.findById(db, ctx, build.unitId);
      if (!buildUnit) throw new ValidationError('buildId references missing unit');
      if (buildUnit.companyId !== input.companyId) {
        throw new ValidationError('buildId is linked to a different company context');
      }
    }
  }

  async validateBuildChain(
    db: Db,
    ctx: TenantContext,
    input: { unitId: string; dealId?: string },
  ) {
    const unit = await UnitRepository.findById(db, ctx, input.unitId);
    if (!unit) throw new NotFoundError('Unit');
    if (!input.dealId) return { unit };
    const deal = await DealRepository.findById(db, ctx, input.dealId);
    if (!deal) throw new NotFoundError('Deal');
    if ((deal as any).companyId && (deal as any).companyId !== unit.companyId) {
      throw new ValidationError('Build dealId and unitId are linked to different companies');
    }
    return { unit, deal };
  }

  async validateProductionChain(
    db: Db,
    ctx: TenantContext,
    input: { buildId: string; unitId: string; dealId?: string },
  ) {
    const [build, unit, deal] = await Promise.all([
      BuildRepository.findById(db, ctx, input.buildId),
      UnitRepository.findById(db, ctx, input.unitId),
      input.dealId ? DealRepository.findById(db, ctx, input.dealId) : Promise.resolve(null),
    ]);
    if (!build) throw new NotFoundError('Build');
    if (!unit) throw new NotFoundError('Unit');
    if (input.dealId && !deal) throw new NotFoundError('Deal');
    if (build.unitId !== unit._id) throw new ValidationError('ProductionJob buildId and unitId mismatch');
    if (input.dealId && build.dealId && build.dealId !== input.dealId) {
      throw new ValidationError('ProductionJob dealId conflicts with build linkage');
    }
    if (deal && (deal as any).companyId && (deal as any).companyId !== unit.companyId) {
      throw new ValidationError('ProductionJob dealId and unitId are cross-company mismatched');
    }
    return { build, unit, deal };
  }

  async validateDeliveryChain(
    db: Db,
    ctx: TenantContext,
    input: { productionJobId: string; buildId: string; unitId: string; dealId?: string; companyId?: string },
  ) {
    const [job, build, unit, deal] = await Promise.all([
      ProductionJobRepository.findById(db, ctx, input.productionJobId),
      BuildRepository.findById(db, ctx, input.buildId),
      UnitRepository.findById(db, ctx, input.unitId),
      input.dealId ? DealRepository.findById(db, ctx, input.dealId) : Promise.resolve(null),
    ]);
    if (!job) throw new NotFoundError('ProductionJob');
    if (!build) throw new NotFoundError('Build');
    if (!unit) throw new NotFoundError('Unit');
    if (input.dealId && !deal) throw new NotFoundError('Deal');
    if (job.buildId !== input.buildId || job.unitId !== input.unitId) {
      throw new ValidationError('Delivery record IDs mismatch production job chain');
    }
    if (build.unitId !== unit._id) throw new ValidationError('Delivery buildId and unitId mismatch');
    if (input.dealId && job.dealId && input.dealId !== job.dealId) throw new ValidationError('Delivery dealId conflicts with production job');
    if (deal && (deal as any).companyId && (deal as any).companyId !== unit.companyId) {
      throw new ValidationError('Delivery dealId and unitId are cross-company mismatched');
    }
    if (input.companyId && input.companyId !== unit.companyId) {
      throw new ValidationError('Delivery companyId conflicts with unit company');
    }
    return { job, build, unit, deal, companyId: unit.companyId };
  }

  async integrityReport(db: Db) {
    const deals = db.collection('deals');
    const builds = db.collection('builds');
    const units = db.collection('units');
    const interactions = db.collection('interactions');
    const productionJobs = db.collection('production_jobs');
    const delivery = db.collection('delivery_records');
    const accountPlans = db.collection('account_plans');
    const [dealsMissingCompanyId, dealsMissingOwnerUserId, buildsMissingUnitId, interactionsMissingCompanyId, productionMissingChain, deliveryMissingCompanyId, plansMissingOwner] = await Promise.all([
      deals.countDocuments({ $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] }),
      deals.countDocuments({ $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }, { ownerUserId: '' }] }),
      builds.countDocuments({ $or: [{ unitId: { $exists: false } }, { unitId: null }, { unitId: '' }] }),
      interactions.countDocuments({ $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] }),
      productionJobs.countDocuments({ $or: [{ buildId: { $exists: false } }, { unitId: { $exists: false } }] }),
      delivery.countDocuments({ $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }] }),
      accountPlans.countDocuments({ $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }, { ownerUserId: '' }] }),
    ]);
    return {
      unresolvedCompanyLinkages: dealsMissingCompanyId + interactionsMissingCompanyId + deliveryMissingCompanyId,
      unresolvedOwnerIdentities: dealsMissingOwnerUserId + plansMissingOwner,
      crossDomainMismatchErrors: productionMissingChain + buildsMissingUnitId,
      details: {
        dealsMissingCompanyId,
        dealsMissingOwnerUserId,
        buildsMissingUnitId,
        interactionsMissingCompanyId,
        productionMissingChain,
        deliveryMissingCompanyId,
        plansMissingOwner,
      },
    };
  }
}

export const identityIntegrityService = new IdentityIntegrityService();
