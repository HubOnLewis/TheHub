// scripts/mongo-init.js
// Runs once when the MongoDB container is first initialised.
// Creates the mtte_core database, applies indexes, and seeds a super-admin.

const db = db.getSiblingDB('mtte_core');

// ── Indexes ────────────────────────────────────────────────────────
db.leads.createIndex({ tenantId: 1, status: 1, updatedAt: -1 });
db.leads.createIndex({ tenantId: 1, assignedTo: 1, status: 1 });
db.leads.createIndex({ tenantId: 1, company: 'text', contact: 'text' });

db.deals.createIndex({ tenantId: 1, status: 1, updatedAt: -1 });
db.deals.createIndex({ tenantId: 1, assignedTo: 1 });

db.units.createIndex({ tenantId: 1, status: 1, updatedAt: -1 });
db.units.createIndex({ vin: 1 }, { unique: true });
db.units.createIndex({ stockNumber: 1, tenantId: 1 }, { unique: true });

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ tenantId: 1, role: 1 });

db.activities.createIndex({ tenantId: 1, entityType: 1, entityId: 1 });
db.activities.createIndex({ tenantId: 1, createdAt: -1 });

db.karmak_sync.createIndex({ tenantId: 1, lastSyncAt: -1 });

print('✅ MTTE Core indexes created.');
