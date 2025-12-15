import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface UserRecord {
  id: string;
  display_name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " "); // Replace multiple spaces with a single space
}

export class UsersRepository {
  constructor(private readonly db: DbClient) {}

  async create(displayName: string, email: string): Promise<UserRecord> {
    const normalizedEmail = normalizeEmail(email);
    const normalizedDisplayName = normalizeDisplayName(displayName);
    const query = `
      INSERT INTO users (display_name, email)
      VALUES ($1, $2)
      RETURNING id, display_name, email, created_at, updated_at
    `;
    return this.db.one(query, [normalizedDisplayName, normalizedEmail]);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const query = `
      SELECT id, display_name, email, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    return this.db.oneOrNone(query, [id]);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = normalizeEmail(email);
    const query = `
      SELECT id, display_name, email, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    return this.db.oneOrNone(query, [normalizedEmail]);
  }

  async findByDisplayName(displayName: string): Promise<UserRecord | null> {
    const normalizedDisplayName = normalizeDisplayName(displayName);
    const query = `
      SELECT id, display_name, email, created_at, updated_at
      FROM users
      WHERE lower(display_name) = lower($1)
    `;
    return this.db.oneOrNone(query, [normalizedDisplayName]);
  }
}

export const usersRepository = new UsersRepository(pgPool);

export function createUsersRepository(db: DbClient): UsersRepository {
  return new UsersRepository(db);
}
