import fs from 'node:fs/promises';
import path from 'node:path';
import { ObjectId } from 'mongodb';
import { ensureUploadsDir, UPLOADS_ROOT } from '../../config/paths.js';

export interface AttachmentStorageSaveInput {
  tenantKey: string;
  interactionId: string;
  file: Express.Multer.File;
}

export interface AttachmentStorageSaveResult {
  url: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
  fileName: string;
}

export interface AttachmentStorageService {
  save(input: AttachmentStorageSaveInput): Promise<AttachmentStorageSaveResult>;
  remove(storageKey: string): Promise<void>;
}

class LocalAttachmentStorageService implements AttachmentStorageService {
  async save(input: AttachmentStorageSaveInput): Promise<AttachmentStorageSaveResult> {
    const ext = path.extname(input.file.originalname || '') || '.bin';
    const safeExt = ext.replace(/[^.a-z0-9]/gi, '').slice(0, 8) || '.bin';
    const fileName = `${new ObjectId().toString()}${safeExt}`;
    const subdir = input.tenantKey;
    ensureUploadsDir(subdir);
    const abs = path.join(UPLOADS_ROOT, subdir, fileName);
    await fs.writeFile(abs, input.file.buffer);
    const storageKey = `${subdir}/${fileName}`;
    return {
      url: `/api/uploads/${storageKey}`,
      storageKey,
      mimeType: input.file.mimetype || 'application/octet-stream',
      sizeBytes: input.file.size ?? Buffer.byteLength(input.file.buffer),
      originalFileName: input.file.originalname || fileName,
      fileName,
    };
  }

  async remove(storageKey: string): Promise<void> {
    const abs = path.join(UPLOADS_ROOT, storageKey);
    try {
      await fs.unlink(abs);
    } catch {
      // missing file should not break attachment document cleanup
    }
  }
}

export const attachmentStorageService: AttachmentStorageService = new LocalAttachmentStorageService();
