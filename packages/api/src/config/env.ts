// packages/api/src/config/env.ts
//
// DB_NAME: never hardcode a production database name in code. The default below is for *new* installs only.
// Cloned or legacy environments must set DB_NAME (and MONGODB_URI) to the existing database or the API will
// connect to an empty database and the app will look "blank."
import { z } from 'zod';

function resolveClientUrl(
  direct: string | undefined,
  serviceName: string,
  root: string,
): string {
  const trimmed = direct?.trim();
  if (trimmed) {
    let url = trimmed;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return url.replace(/\/$/, '');
  }
  const domain = root.trim().replace(/^\./, '');
  return `https://${serviceName}.${domain}`;
}

const EnvSchema = z.object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.coerce.number().default(3001),
  MONGODB_URI:        z.string().min(1),
  /** Logical MongoDB database name; must match the database segment in MONGODB_URI. */
  DB_NAME:            z.string().default('hub_crm'),
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Explicit browser origin for CORS; optional on Render when HUB_WEB_SERVICE_NAME is set. */
  CLIENT_URL:         z.string().optional(),
  HUB_WEB_SERVICE_NAME: z.string().default('the-hub-crm-web'),
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

export const env = {
  ...base,
  CLIENT_URL: resolveClientUrl(
    base.CLIENT_URL,
    base.HUB_WEB_SERVICE_NAME,
    base.RENDER_ONRENDER_ROOT,
  ),
};
