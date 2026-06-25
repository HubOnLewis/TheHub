// packages/api/src/server.ts
import express, { type NextFunction, type Request, type Response } from 'express';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { createCorsSetup } from './config/cors.js';
import { createManualCorsMiddleware } from './middleware/manualCors.js';
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

const manualCors = createManualCorsMiddleware(env.CORS_ORIGINS_LIST);
const { middleware: corsMiddleware, matcher: corsMatcher } = createCorsSetup(env.CORS_ORIGINS_LIST);

// ── Manual CORS + OPTIONS — absolute first (before json, audit, routes) ──
app.use(manualCors);
// Secondary cors() for non-OPTIONS responses (headers on GET/POST/etc.)
app.use(corsMiddleware);

// ── Middleware ────────────────────────────────────────────────────
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
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next, corsMatcher);
});

function readApiVersion(): string {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 12);
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function logBootConfig(): void {
  console.log(
    JSON.stringify({
      type: 'api_boot',
      nodeEnv: env.NODE_ENV,
      corsOriginsEnvSet: env.CORS_ORIGINS_CONFIGURED,
      corsOriginsRaw: env.CORS_ORIGINS_RAW,
      corsAllowedOrigins: env.CORS_ORIGINS_LIST,
      version: readApiVersion(),
      manualCorsPreflight: true,
    }),
  );
}

// ── Boot ──────────────────────────────────────────────────────────
async function start() {
  try {
    logBootConfig();
    const db = await connectDB();
    registerJobs(db);
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[API] The Hub CRM listening on 0.0.0.0:${env.PORT}`);
    });
  } catch (err) {
    console.error('[API] Failed to start:', err);
    process.exit(1);
  }
}

start();
