// packages/api/src/server.ts
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestAudit } from './middleware/requestAudit.js';
import { registerJobs } from './jobs/index.js';
import { UPLOADS_ROOT } from './config/paths.js';

import authRoutes      from './routes/auth.js';
import leadRoutes      from './routes/leads.js';
import dealRoutes      from './routes/deals.js';
import unitRoutes      from './routes/units.js';
import adminRoutes     from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import companyRoutes   from './routes/companies.js';
import interactionRoutes from './routes/interactions.js';
import repScorecardRoutes from './routes/repScorecards.js';
import weeklyCadenceReviewRoutes from './routes/weeklyCadenceReviews.js';
import accountCoverageRoutes from './routes/accountCoverage.js';
import accountExpansionRoutes from './routes/accountExpansion.js';
import accountPlanRoutes from './routes/accountPlans.js';
import buildRoutes from './routes/builds.js';
import productionRoutes from './routes/production.js';
import deliveryRoutes from './routes/delivery.js';
import integrationsRoutes from './routes/integrations.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use('/api/uploads', express.static(UPLOADS_ROOT));
app.use(express.json({ limit: '2mb' }));
app.use(requestAudit);

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/deals',     dealRoutes);
app.use('/api/units',     unitRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/companies',    companyRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/rep-scorecards', repScorecardRoutes);
app.use('/api/weekly-cadence-reviews', weeklyCadenceReviewRoutes);
app.use('/api/account-coverage', accountCoverageRoutes);
app.use('/api/account-expansion', accountExpansionRoutes);
app.use('/api/account-plans', accountPlanRoutes);
app.use('/api/builds', buildRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/integrations', integrationsRoutes);

// ── Error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────
async function start() {
  try {
    const db = await connectDB();
    registerJobs(db);
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[API] The Hub CRM listening on 0.0.0.0:${env.PORT} (CORS: ${env.CLIENT_URL})`);
    });
  } catch (err) {
    console.error('[API] Failed to start:', err);
    process.exit(1);
  }
}

start();
