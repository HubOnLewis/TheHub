import type { Db } from 'mongodb';
import {
  inclusiveDayCount,
  occupancySignalFromDeal,
  projectPublicDays,
  toPublicAvailabilityDto,
  PUBLIC_AVAILABILITY_MAX_DAYS,
  type PublicAvailabilityDay,
  type PublicAvailabilityRange,
  type PublicDayStatus,
  type PublicOccupancySignal,
} from '@hub-crm/shared';
import type { TenantContext } from '../tenancy/index.js';
import { DealRepository } from '../repositories/DealRepository.js';
import { BadRequestError } from '../errors/index.js';
import { getDB } from '../config/db.js';

function publicAvailabilityTenantContext(): TenantContext {
  return {
    tenantId: 'hub-wichita',
    defaultEntity: 'HUB',
    defaultLocation: 'Wichita',
    userId: 'public-availability',
    userRole: 'client',
    userName: 'Public availability',
    isCrossTenant: false,
    isSuperAdmin: false,
  };
}

function dateKeyFromDeal(deal: { importMeta?: Record<string, unknown> }): string {
  const meta = deal.importMeta ?? {};
  const raw = (typeof meta.eventDateIso === 'string' && meta.eventDateIso) || (typeof meta.eventDate === 'string' && meta.eventDate) || '';
  return raw.slice(0, 10);
}

export class PublicAvailabilityService {
  async listRange(db: Db, startDate: string, endDate: string, nowMs = Date.now()): Promise<PublicAvailabilityRange> {
    if (inclusiveDayCount(startDate, endDate) < 1) {
      throw new BadRequestError('startDate and endDate must be valid YYYY-MM-DD with startDate <= endDate.');
    }
    if (inclusiveDayCount(startDate, endDate) > PUBLIC_AVAILABILITY_MAX_DAYS) {
      throw new BadRequestError(`Date range cannot exceed ${PUBLIC_AVAILABILITY_MAX_DAYS} days.`);
    }
    const ctx = publicAvailabilityTenantContext();
    const listed = await DealRepository.listCalendarDeals(db, ctx, {
      page: 1,
      limit: 500,
      sort: 'updatedAt',
      order: 'desc',
    });
    const signals: PublicOccupancySignal[] = [];
    for (const deal of listed.data as Array<{
      status?: string;
      unitId?: string;
      unitIds?: string[];
      importMeta?: Record<string, unknown>;
    }>) {
      const key = dateKeyFromDeal(deal);
      if (key < startDate || key > endDate) continue;
      const signal = occupancySignalFromDeal(deal, nowMs);
      if (signal) signals.push(signal);
    }
    return toPublicAvailabilityDto(startDate, endDate, projectPublicDays(startDate, endDate, signals));
  }

  async listPublicRange(startDate: string, endDate: string, nowMs = Date.now()): Promise<PublicAvailabilityRange> {
    return this.listRange(getDB(), startDate, endDate, nowMs);
  }

  async dayForDate(db: Db, date: string, nowMs = Date.now()): Promise<PublicAvailabilityDay> {
    const range = await this.listRange(db, date, date, nowMs);
    return range.days[0] ?? { date, status: 'available', morning: 'available', evening: 'available' };
  }

  async statusForDate(db: Db, date: string, nowMs = Date.now()): Promise<PublicDayStatus> {
    return (await this.dayForDate(db, date, nowMs)).status;
  }
}

export const publicAvailabilityService = new PublicAvailabilityService();
