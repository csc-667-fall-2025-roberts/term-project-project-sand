import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";
import type { UserRecord } from "./users.js";

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface RefreshTokenWithUser {
  token: RefreshTokenRecord;
  user: UserRecord;
}

class RefreshTokensRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenRecord> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at
    `;
    return this.db.one(query, [userId, tokenHash, expiresAt]);
  }

  async findValidByHash(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    const query = `
      SELECT
        rt.id AS rt_id,
        rt.user_id AS rt_user_id,
        rt.token_hash AS rt_token_hash,
        rt.expires_at AS rt_expires_at,
        rt.revoked_at AS rt_revoked_at,
        rt.created_at AS rt_created_at,
        u.id AS user_id,
        u.display_name AS user_display_name,
        u.email AS user_email,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1
        AND rt.revoked_at IS NULL
        AND rt.expires_at > now()
    `;
    const row = await this.db.oneOrNone(query, [tokenHash]);
    if (!row) return null;

    return {
      token: {
        id: row.rt_id,
        user_id: row.rt_user_id,
        token_hash: row.rt_token_hash,
        expires_at: row.rt_expires_at,
        revoked_at: row.rt_revoked_at,
        created_at: row.rt_created_at,
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

  async deleteExpiredForUser(userId: string): Promise<void> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE user_id = $1
        AND expires_at <= now()
    `;
    await this.db.none(query, [userId]);
  }

  async revokeById(id: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE id = $1 AND revoked_at IS NULL
    `;
    await this.db.none(query, [id]);
  }

  async revokeByHash(hash: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
    `;
    await this.db.none(query, [hash]);
  }
}

export const refreshTokensRepository = new RefreshTokensRepository(pgPool);
