import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";
import { normalizeEmail, type UserRecord } from "./users.js";

export interface AuthCredentialRecord {
  id: string;
  user_id: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthWithUser {
  auth: AuthCredentialRecord;
  user: UserRecord;
}

class AuthRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

  async createCredential(
    userId: string,
    passwordHash: string,
  ): Promise<AuthCredentialRecord> {
    const query = `
      INSERT INTO auth_credentials (user_id, password_hash)
      VALUES ($1, $2)
      RETURNING id, user_id, password_hash, created_at, updated_at
    `;
    return this.db.one(query, [userId, passwordHash]);
  }

  async findByEmail(email: string): Promise<AuthWithUser | null> {
    const normalizedEmail = normalizeEmail(email);
    const query = `
      SELECT
        a.id AS auth_id,
        a.user_id AS auth_user_id,
        a.password_hash AS auth_password_hash,
        a.created_at AS auth_created_at,
        a.updated_at AS auth_updated_at,
        u.id AS user_id,
        u.display_name AS user_display_name,
        u.email AS user_email,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM auth_credentials a
      JOIN users u ON u.id = a.user_id
      WHERE u.email = $1
    `;
    const row = await this.db.oneOrNone(query, [normalizedEmail]);
    if (!row) return null;

    return {
      auth: {
        id: row.auth_id,
        user_id: row.auth_user_id,
        password_hash: row.auth_password_hash,
        created_at: row.auth_created_at,
        updated_at: row.auth_updated_at,
      },
      user: {
        id: row.user_id,
        display_name: row.user_display_name,
        email: row.user_email,
        created_at: row.user_created_at,
        updated_at: row.user_updated_at,
      },
    };
  }

  async findByUserId(userId: string): Promise<AuthCredentialRecord | null> {
    const query = `
      SELECT id, user_id, password_hash, created_at, updated_at
      FROM auth_credentials
      WHERE user_id = $1
    `;
    return this.db.oneOrNone(query, [userId]);
  }
}

export const authRepository = new AuthRepository(pgPool);
