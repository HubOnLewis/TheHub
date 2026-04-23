// packages/api/src/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.coerce.number().default(3001),
  MONGODB_URI:        z.string().min(1),
  DB_NAME:            z.string().default('mtte_core'),
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_URL:         z.string().default('http://localhost:5173'),
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

export const env = parsed.data;
