// packages/api/src/repositories/UserRepository.ts
import { type Db, type Document, ObjectId } from 'mongodb';
import { BaseRepository } from './BaseRepository.js';
import type { UserRole } from '@hub-crm/shared';

export interface UserDoc extends Document {
  tenantId: string;
  name:         string;
  email:        string;
  passwordHash: string;
  role:         UserRole;
  entity:   string;
  location: string;
  active:   boolean;
  lastLogin?: Date;
  createdAt:  Date;
  updatedAt:  Date;
}

class UserRepositoryClass extends BaseRepository<UserDoc> {
  protected collectionName = 'users';

  async findByEmail(db: Db, email: string): Promise<(UserDoc & { _id: string }) | null> {
    const doc = await this.col(db).findOne({ email: email.toLowerCase() });
    return doc ? this.serialize(doc as UserDoc & { _id: ObjectId }) : null;
  }

  async findByIdAdmin(db: Db, id: string): Promise<(UserDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const doc = await this.col(db).findOne({ _id: oid });
    return doc ? this.serialize(doc as UserDoc & { _id: ObjectId }) : null;
  }

  async updateById(
    db: Db,
    id: string,
    update: Partial<Omit<UserDoc, '_id'>>,
  ): Promise<(UserDoc & { _id: string }) | null> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return null; }
    const result = await this.col(db).findOneAndUpdate(
      { _id: oid },
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) return null;
    const { passwordHash: _pw, ...safe } = result as UserDoc & { _id: ObjectId };
    return this.serialize(safe as UserDoc & { _id: ObjectId });
  }

  async listAll(db: Db): Promise<(UserDoc & { _id: string })[]> {
    const docs = await this.col(db).find({}).project({ passwordHash: 0 }).toArray();
    return docs.map(d => this.serialize(d as UserDoc & { _id: ObjectId }));
  }

  async deactivate(db: Db, id: string): Promise<boolean> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return false; }
    const { modifiedCount } = await this.col(db).updateOne(
      { _id: oid },
      { $set: { active: false, updatedAt: new Date() } },
    );
    return modifiedCount === 1;
  }

  async touch(db: Db, id: string): Promise<void> {
    let oid: ObjectId;
    try { oid = new ObjectId(id); } catch { return; }
    await this.col(db).updateOne({ _id: oid }, { $set: { lastLogin: new Date() } });
  }
}

export const UserRepository = new UserRepositoryClass();
