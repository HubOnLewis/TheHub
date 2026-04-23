// packages/api/src/config/paths.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** On-disk store for interaction attachments (local dev; replace with object storage in production). */
export const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

export function ensureUploadsDir(subdir: string): void {
  const dir = path.join(UPLOADS_ROOT, subdir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
