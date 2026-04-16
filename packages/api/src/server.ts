// packages/api/src/server.ts
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerJobs } from './jobs/index.js';

import authRoutes      from './routes/auth.js';
import leadRoutes      from './routes/leads.js';
import dealRoutes      from './routes/deals.js';
import unitRoutes      from './routes/units.js';
import adminRoutes     from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import companyRoutes   from './routes/companies.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/deals',     dealRoutes);
app.use('/api/units',     unitRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/companies', companyRoutes);

// ── Error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────
async function start() {
  try {
    const db = await connectDB();
    registerJobs(db);
    app.listen(env.PORT, () => {
      console.log(`[API] MTTE Core v2 listening on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('[API] Failed to start:', err);
    process.exit(1);
  }
}

start();
