import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost:27017/hub_crm';
process.env.JWT_SECRET ??= 'this_is_a_very_long_test_secret_value_12345';
process.env.SUPER_ADMIN_EMAILS ??= 'admin@hubonlewis.com';

const { identityIntegrityService } = await import('./IdentityIntegrityService.js');
const { DealService } = await import('./DealService.js');
const { CompanyRepository } = await import('../repositories/CompanyRepository.js');
const { DealRepository } = await import('../repositories/DealRepository.js');
const { LeadRepository } = await import('../repositories/LeadRepository.js');

test('resolveCanonicalCompany creates a stub company when the name is not yet known', async () => {
  const originalSearch = CompanyRepository.search;
  const originalUpsert = CompanyRepository.upsertBySourceId;
  const originalFindById = CompanyRepository.findById;
  const originalFindByNameNormalized = CompanyRepository.findByNameNormalized;

  try {
    CompanyRepository.search = async () => [];
    CompanyRepository.findByNameNormalized = async () => null;
    CompanyRepository.upsertBySourceId = async (_db, tenantId, source, sourceId, payload) => {
      assert.equal(tenantId, 'hub-wichita');
      assert.equal(source, 'manual');
      assert.equal(sourceId, 'manual:acme-events');
      assert.equal(payload.name, 'Acme Events');
      assert.equal(payload.isStub, true);
      return 'company-123';
    };
    CompanyRepository.findById = async () => ({
      _id: 'company-123',
      tenantId: 'hub-wichita',
      name: 'Acme Events',
      nameNormalized: 'acme-events',
      source: 'manual',
      sourceId: 'manual:acme-events',
      isStub: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await identityIntegrityService.resolveCanonicalCompany(
      {} as any,
      { tenantId: 'hub-wichita' } as any,
      { companyName: 'Acme Events' },
    );

    assert.equal(result._id, 'company-123');
    assert.equal(result.isStub, true);
    assert.equal(result.name, 'Acme Events');
  } finally {
    CompanyRepository.search = originalSearch;
    CompanyRepository.upsertBySourceId = originalUpsert;
    CompanyRepository.findById = originalFindById;
    CompanyRepository.findByNameNormalized = originalFindByNameNormalized;
  }
});

test('lead conversion reuses the canonical deal and keeps the lead authoritative', async () => {
  const originalResolve = identityIntegrityService.resolveCanonicalCompany;
  const originalLeadUpdateOne = LeadRepository.updateOne;
  const originalFindByLeadId = DealRepository.findByLeadId;
  const originalInsertOne = DealRepository.insertOne;

  try {
    identityIntegrityService.resolveCanonicalCompany = async () => ({
      _id: 'company-123',
      tenantId: 'hub-wichita',
      name: 'Acme Events',
      nameNormalized: 'acme-events',
      source: 'manual',
      sourceId: 'manual:acme-events',
      isStub: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any;

    const existingDeal = {
      _id: 'deal-123',
      tenantId: 'hub-wichita',
      leadId: 'lead-456',
      companyId: 'company-123',
      company: 'Acme Events',
      contact: 'Jane Doe',
      title: 'Acme Events',
      amount: 2500,
      status: 'Draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    DealRepository.findByLeadId = async (_db, _ctx, leadId) => {
      assert.equal(leadId, 'lead-456');
      return existingDeal as any;
    };

    DealRepository.insertOne = async () => {
      throw new Error('duplicate lead conversion should reuse existing deal instead of inserting a second one');
    };

    LeadRepository.updateOne = async (_db, _ctx, leadId, update) => {
      assert.equal(leadId, 'lead-456');
      assert.equal(update.status, 'Converted');
      assert.equal(update.convertedDealId, 'deal-123');
      return {
        _id: leadId,
        tenantId: 'hub-wichita',
        status: 'Converted',
        convertedDealId: 'deal-123',
      } as any;
    };

    const service = new DealService();
    const result = await service.create({} as any, { tenantId: 'hub-wichita', userId: 'user-1', userName: 'Sales Bot' } as any, {
      title: 'Acme Events',
      company: 'Acme Events',
      contact: 'Jane Doe',
      amount: 2500,
      leadId: 'lead-456',
      status: 'Draft',
    });

    assert.equal(result._id, 'deal-123');
    assert.equal(result.leadId, 'lead-456');
  } finally {
    identityIntegrityService.resolveCanonicalCompany = originalResolve;
    LeadRepository.updateOne = originalLeadUpdateOne;
    DealRepository.findByLeadId = originalFindByLeadId;
    DealRepository.insertOne = originalInsertOne;
  }
});

test('deal stage changes persist without dropping lead/company linkage', async () => {
  const originalFindById = DealRepository.findById;
  const originalUpdateOne = DealRepository.updateOne;
  const originalOccupancy = DealRepository.listOccupancyForDate;

  try {
    const existingDeal = {
      _id: 'deal-789',
      tenantId: 'hub-wichita',
      leadId: 'lead-456',
      companyId: 'company-123',
      company: 'Acme Events',
      contact: 'Jane Doe',
      title: 'Acme Events',
      amount: 2500,
      status: 'Draft',
      importMeta: { source: 'lead_convert', guests: 80 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    DealRepository.findById = async () => existingDeal as any;
    DealRepository.listOccupancyForDate = async () => ({ data: [], total: 0, page: 1, pages: 0, limit: 200 }) as any;
    DealRepository.updateOne = async (_db, _ctx, id, update) => {
      assert.equal(id, 'deal-789');
      assert.equal(update.status, 'Pending Approval');
      return { ...existingDeal, ...update, updatedAt: new Date() } as any;
    };

    const service = new DealService();
    const result = await service.update({} as any, { tenantId: 'hub-wichita', userId: 'user-1', userName: 'Sales Bot' } as any, 'deal-789', {
      status: 'Pending Approval',
      amount: 2500,
      importMeta: {
        eventDateIso: '2026-09-10',
        startTime: '18:00',
        endTime: '22:00',
        space: 'Main Hall',
        pvStatus: 'qualified',
      },
    });

    assert.equal(result.status, 'Pending Approval');
    assert.equal(result.leadId, 'lead-456');
    assert.equal(result.companyId, 'company-123');
    assert.equal((result.importMeta as any).eventDateIso, '2026-09-10');
    assert.equal((result.importMeta as any).startTime, '18:00');
    assert.equal((result.importMeta as any).guests, 80);
  } finally {
    DealRepository.findById = originalFindById;
    DealRepository.updateOne = originalUpdateOne;
    DealRepository.listOccupancyForDate = originalOccupancy;
  }
});

test('invalid deal stage transitions are rejected and tenant-scoped company dedup stays isolated', async () => {
  const originalSearch = CompanyRepository.search;
  const originalFindByNameNormalized = CompanyRepository.findByNameNormalized;
  const originalFindById = DealRepository.findById;
  const originalUpdateOne = DealRepository.updateOne;

  try {
    CompanyRepository.search = async () => [];
    CompanyRepository.findByNameNormalized = async (_db, tenantId, normalized) => {
      if (tenantId === 'hub-wichita' && normalized === 'acme-events') {
        return {
          _id: 'company-111',
          tenantId: 'hub-wichita',
          name: 'Acme Events',
          nameNormalized: 'acme-events',
          source: 'manual',
          sourceId: 'manual:acme-events',
          isStub: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      }
      if (tenantId === 'hub-lewis' && normalized === 'acme-events') {
        return {
          _id: 'company-222',
          tenantId: 'hub-lewis',
          name: 'Acme Events',
          nameNormalized: 'acme-events',
          source: 'manual',
          sourceId: 'manual:acme-events',
          isStub: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      }
      return null;
    };

    const resultWichita = await identityIntegrityService.resolveCanonicalCompany(
      {} as any,
      { tenantId: 'hub-wichita' } as any,
      { companyName: 'Acme Events' },
    );
    const resultLewis = await identityIntegrityService.resolveCanonicalCompany(
      {} as any,
      { tenantId: 'hub-lewis' } as any,
      { companyName: 'Acme Events' },
    );

    assert.equal(resultWichita._id, 'company-111');
    assert.equal(resultLewis._id, 'company-222');
    assert.notEqual(resultWichita._id, resultLewis._id);

    const existingDeal = {
      _id: 'deal-101',
      tenantId: 'hub-wichita',
      leadId: 'lead-777',
      companyId: 'company-111',
      company: 'Acme Events',
      contact: 'Jane Doe',
      title: 'Acme Events',
      amount: 2500,
      status: 'Approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    DealRepository.findById = async () => existingDeal as any;
    DealRepository.updateOne = async (_db, _ctx, _id, update) => ({ ...existingDeal, ...update, updatedAt: new Date() } as any);

    await assert.rejects(
      () => new DealService().update({} as any, { tenantId: 'hub-wichita' } as any, 'deal-101', { status: 'Draft' }),
      /Cannot move deal backward/i,
    );
  } finally {
    CompanyRepository.search = originalSearch;
    CompanyRepository.findByNameNormalized = originalFindByNameNormalized;
    DealRepository.findById = originalFindById;
    DealRepository.updateOne = originalUpdateOne;
  }
});
