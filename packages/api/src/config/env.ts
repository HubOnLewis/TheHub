// packages/api/src/config/env.ts
//
// DB_NAME: never hardcode a production database name in code. The default below is for *new* installs only.
// Cloned or legacy environments must set DB_NAME (and MONGODB_URI) to the existing database or the API will
// connect to an empty database and the app will look "blank."
import { z } from 'zod';

function normalizeOrigin(url: string): string {
  let u = url.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/$/, '');
}

function parseOriginsList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map(s => normalizeOrigin(s))
    .filter(Boolean);
}

function deriveWebServiceOrigin(serviceName: string, root: string): string {
  const domain = root.trim().replace(/^\./, '');
  const slug = serviceName.trim().toLowerCase();
  return `https://${slug}.${domain}`;
}

/** Always allowed in production — survives partial Render env misconfiguration. */
const PRODUCTION_FRONTEND_ORIGINS = [
  'https://admin.hubonlewis.com',
  'https://the-hub-qy8a.onrender.com',
  'https://the-hub.onrender.com',
];

function resolveAllowedOrigins(opts: {
  corsOrigins?: string;
  corsOrigin?: string;
  clientUrl?: string;
  frontendUrl?: string;
  webServiceName: string;
  onrenderRoot: string;
  nodeEnv: string;
}): string[] {
  const merged = [
    ...parseOriginsList(opts.corsOrigins),
    ...parseOriginsList(opts.corsOrigin),
    ...parseOriginsList(opts.clientUrl),
    ...parseOriginsList(opts.frontendUrl),
  ];

  if (merged.length === 0) {
    merged.push(deriveWebServiceOrigin(opts.webServiceName, opts.onrenderRoot));
  }

  if (opts.nodeEnv === 'production') {
    merged.push(...PRODUCTION_FRONTEND_ORIGINS);
  }

  if (opts.nodeEnv === 'development') {
    merged.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }

  return [...new Set(merged.map(normalizeOrigin))];
}

const EnvSchema = z.object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.coerce.number().default(3001),
  MONGODB_URI:        z.string().min(1),
  /** Logical MongoDB database name; must match the database segment in MONGODB_URI. */
  DB_NAME:            z.string().default('hub_crm'),
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Comma-separated browser origins for CORS (preferred). */
  CORS_ORIGINS:       z.string().optional(),
  /** Legacy aliases — merged into allowlist. */
  CORS_ORIGIN:        z.string().optional(),
  CLIENT_URL:         z.string().optional(),
  FRONTEND_URL:       z.string().optional(),
  HUB_WEB_SERVICE_NAME: z.string().default('The-Hub'),
  RENDER_ONRENDER_ROOT: z.string().default('onrender.com'),
  SUPER_ADMIN_EMAILS: z.string().transform(s => s.split(',').map(e => e.trim()).filter(Boolean)),
  ATTACHMENT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  ATTACHMENT_S3_BUCKET: z.string().optional(),
  ATTACHMENT_S3_REGION: z.string().optional(),
  ATTACHMENT_S3_BASE_URL: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const base = parsed.data;

const corsOrigins = resolveAllowedOrigins({
  corsOrigins: base.CORS_ORIGINS,
  corsOrigin: base.CORS_ORIGIN,
  clientUrl: base.CLIENT_URL,
  frontendUrl: base.FRONTEND_URL,
  webServiceName: base.HUB_WEB_SERVICE_NAME,
  onrenderRoot: base.RENDER_ONRENDER_ROOT,
  nodeEnv: base.NODE_ENV,
});

export const env = {
  ...base,
  CORS_ORIGINS_LIST: corsOrigins,
  CORS_ORIGINS_CONFIGURED: Boolean(base.CORS_ORIGINS?.trim()),
  CORS_ORIGINS_RAW: base.CORS_ORIGINS ?? null,
  /** @deprecated use CORS_ORIGINS_LIST */
  CORS_ORIGINS: corsOrigins,
  CLIENT_URL: corsOrigins[0] ?? deriveWebServiceOrigin(base.HUB_WEB_SERVICE_NAME, base.RENDER_ONRENDER_ROOT),
};
