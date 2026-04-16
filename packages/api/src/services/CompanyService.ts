// packages/api/src/services/CompanyService.ts
// Read-only. Write operations are handled by import scripts.
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { CompanyRepository, type CompanyFilter } from '../repositories/CompanyRepository.js';
import type { ListOptions } from '../repositories/BaseRepository.js';
import { NotFoundError } from '../errors/index.js';

export class CompanyService {
  async list(db: Db, ctx: TenantContext, filter: CompanyFilter, options: ListOptions) {
    return CompanyRepository.listCompanies(db, ctx, filter, options);
  }

  async getById(db: Db, ctx: TenantContext, id: string) {
    const company = await CompanyRepository.findById(db, ctx, id);
    if (!company) throw new NotFoundError('Company');
    return company;
  }

  async search(db: Db, ctx: TenantContext, q: string, limit = 10) {
    return CompanyRepository.search(db, ctx, q, limit);
  }
}

export const companyService = new CompanyService();
