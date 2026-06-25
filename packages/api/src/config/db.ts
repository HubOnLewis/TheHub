// packages/api/src/config/db.ts
import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';
import { parseMongoDbName, parseMongoHost } from './mongoTarget.js';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) return database;

  client   = new MongoClient(env.MONGODB_URI);
  await client.connect();
  database = client.db(env.DB_NAME);

  void database.collection('interactions').createIndex(
    { tenantId: 1, companyId: 1, createdAt: -1 },
    { name: 'interactions_tenant_company_created' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, ownerUserId: 1, followUpAt: 1, status: 1 },
    { name: 'interactions_owner_follow_status' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, status: 1, followUpAt: 1 },
    { name: 'interactions_status_follow' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, type: 1, createdAt: -1 },
    { name: 'interactions_type_created' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, unitId: 1, createdAt: -1 },
    { name: 'interactions_unit_created' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, buildId: 1, createdAt: -1 },
    { name: 'interactions_build_created' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, relatedDealId: 1, createdAt: -1 },
    { name: 'interactions_relatedDeal_created' },
  );
  void database.collection('interactions').createIndex(
    { tenantId: 1, summary: 'text', body: 'text' },
    {
      name: 'interactions_tenant_summary_body_text',
      weights: { summary: 8, body: 3 },
      default_language: 'english',
    },
  );
  void database.collection('weekly_cadence_reviews').createIndex(
    { tenantId: 1, ownerUserId: 1, weekStart: -1, weekEnd: -1 },
    { name: 'weekly_cadence_owner_week' },
  );
  void database.collection('weekly_cadence_reviews').createIndex(
    { tenantId: 1, reviewedByUserId: 1, reviewedAt: -1 },
    { name: 'weekly_cadence_reviewer_time' },
  );
  void database.collection('deals').createIndex(
    { tenantId: 1, companyId: 1, status: 1 },
    { name: 'deals_tenant_companyId_status' },
  );
  void database.collection('deals').createIndex(
    { tenantId: 1, company: 1, status: 1 },
    { name: 'deals_tenant_company_status' },
  );
  void database.collection('deals').createIndex(
    { tenantId: 1, ownerUserId: 1, status: 1 },
    { name: 'deals_tenant_owner_status' },
  );
  void database.collection('deals').createIndex(
    { tenantId: 1, primaryUnitId: 1 },
    { name: 'deals_tenant_primary_unit' },
  );
  void database.collection('units').createIndex(
    { tenantId: 1, companyId: 1, status: 1 },
    { name: 'units_tenant_company_status' },
  );
  void database.collection('units').createIndex(
    { tenantId: 1, assignedDealId: 1 },
    { name: 'units_tenant_assigned_deal' },
  );
  void database.collection('builds').createIndex(
    { tenantId: 1, unitId: 1, status: 1, createdAt: -1 },
    { name: 'builds_tenant_unit_status_created' },
  );
  void database.collection('builds').createIndex(
    { tenantId: 1, dealId: 1, status: 1 },
    { name: 'builds_tenant_deal_status' },
  );
  void database.collection('build_versions').createIndex(
    { tenantId: 1, buildId: 1, versionNumber: -1 },
    { name: 'build_versions_tenant_build_version', unique: true },
  );
  void database.collection('change_orders').createIndex(
    { tenantId: 1, buildId: 1, status: 1, createdAt: -1 },
    { name: 'change_orders_tenant_build_status_created' },
  );
  void database.collection('change_orders').createIndex(
    { tenantId: 1, status: 1, approvedAt: -1 },
    { name: 'change_orders_tenant_status_approved' },
  );
  void database.collection('production_jobs').createIndex(
    { tenantId: 1, status: 1, updatedAt: -1 },
    { name: 'production_jobs_tenant_status_updated' },
  );
  void database.collection('production_jobs').createIndex(
    { tenantId: 1, buildId: 1, unitId: 1 },
    { name: 'production_jobs_tenant_build_unit' },
  );
  void database.collection('production_jobs').createIndex(
    { tenantId: 1, dealId: 1, status: 1 },
    { name: 'production_jobs_tenant_deal_status' },
  );
  void database.collection('production_tasks').createIndex(
    { tenantId: 1, productionJobId: 1, sequence: 1 },
    { name: 'production_tasks_tenant_job_sequence' },
  );
  void database.collection('production_tasks').createIndex(
    { tenantId: 1, status: 1, updatedAt: -1 },
    { name: 'production_tasks_tenant_status_updated' },
  );
  void database.collection('delivery_records').createIndex(
    { tenantId: 1, status: 1, updatedAt: -1 },
    { name: 'delivery_records_tenant_status_updated' },
  );
  void database.collection('delivery_records').createIndex(
    { tenantId: 1, productionJobId: 1 },
    { name: 'delivery_records_tenant_job' },
  );
  void database.collection('delivery_records').createIndex(
    { tenantId: 1, buildId: 1, unitId: 1, companyId: 1 },
    { name: 'delivery_records_tenant_build_unit_company' },
  );
  void database.collection('delivery_records').createIndex(
    { tenantId: 1, companyId: 1, updatedAt: -1 },
    { name: 'delivery_records_tenant_company_updated' },
  );
  void database.collection('delivery_packets').createIndex(
    { tenantId: 1, deliveryRecordId: 1 },
    { name: 'delivery_packets_tenant_delivery', unique: true },
  );
  void database.collection('delivery_packets').createIndex(
    { tenantId: 1, status: 1, updatedAt: -1 },
    { name: 'delivery_packets_tenant_status_updated' },
  );
  void database.collection('post_delivery_follow_ups').createIndex(
    { tenantId: 1, deliveryRecordId: 1, status: 1, dueAt: 1 },
    { name: 'post_delivery_followups_tenant_delivery_status_due' },
  );
  void database.collection('post_delivery_follow_ups').createIndex(
    { tenantId: 1, companyId: 1, status: 1 },
    { name: 'post_delivery_followups_tenant_company_status' },
  );
  void database.collection('closeout_checklists').createIndex(
    { tenantId: 1, productionJobId: 1 },
    { name: 'closeout_checklists_tenant_job', unique: true },
  );
  void database.collection('account_plans').createIndex(
    { tenantId: 1, companyId: 1 },
    { name: 'account_plans_tenant_company', unique: true },
  );
  void database.collection('account_plans').createIndex(
    { tenantId: 1, ownerUserId: 1, status: 1 },
    { name: 'account_plans_tenant_owner_status' },
  );

  console.log(
    JSON.stringify({
      type: 'db_connected',
      nodeEnv: env.NODE_ENV,
      configuredDbName: env.DB_NAME,
      connectedDbName: database.databaseName,
      mongoHost: parseMongoHost(env.MONGODB_URI),
      uriDbSegment: parseMongoDbName(env.MONGODB_URI, ''),
    }),
  );
  return database;
}

export function getDB(): Db {
  if (!database) throw new Error('Database not initialised — call connectDB() first');
  return database;
}

export async function closeDB(): Promise<void> {
  await client?.close();
  client   = null;
  database = null;
}
