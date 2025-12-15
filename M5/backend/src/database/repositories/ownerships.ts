import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface OwnershipRecord {
  id: string;
  game_id: string;
  tile_id: string;
  participant_id: string;
  houses: number;
  hotels: number;
  is_mortgaged: boolean;
  created_at: Date;
  updated_at: Date;
}

export class OwnershipsRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.none("DELETE FROM ownerships WHERE id = $1", [id]);
  }

  async findByGameAndTileForUpdate(
    gameId: string,
    tileId: string,
  ): Promise<OwnershipRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        tile_id,
        participant_id,
        houses,
        hotels,
        is_mortgaged,
        created_at,
        updated_at
      FROM ownerships
      WHERE game_id = $1 AND tile_id = $2
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [gameId, tileId]);
  }

  async countByParticipant(
    gameId: string,
    participantId: string,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM ownerships
      WHERE game_id = $1 AND participant_id = $2
    `;
    const row = await this.db.one<{ count: number }>(query, [
      gameId,
      participantId,
    ]);
    return row.count;
  }

  async deleteByParticipant(
    gameId: string,
    participantId: string,
  ): Promise<number> {
    const query = `
      DELETE FROM ownerships
      WHERE game_id = $1 AND participant_id = $2
    `;
    const result = await this.db.result(query, [gameId, participantId]);
    return result.rowCount;
  }

  async create(params: {
    gameId: string;
    tileId: string;
    participantId: string;
  }): Promise<OwnershipRecord> {
    const query = `
      INSERT INTO ownerships (game_id, tile_id, participant_id)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        game_id,
        tile_id,
        participant_id,
        houses,
        hotels,
        is_mortgaged,
        created_at,
        updated_at
    `;

    return this.db.one(query, [
      params.gameId,
      params.tileId,
      params.participantId,
    ]);
  }

  async findByGameAndTile(
    gameId: string,
    tileId: string,
  ): Promise<OwnershipRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        tile_id,
        participant_id,
        houses,
        hotels,
        is_mortgaged,
        created_at,
        updated_at
      FROM ownerships
      WHERE game_id = $1 AND tile_id = $2
    `;

    return this.db.oneOrNone(query, [gameId, tileId]);
  }
}

export const ownershipsRepository = new OwnershipsRepository(pgPool);

export function createOwnershipsRepository(db: DbClient): OwnershipsRepository {
  return new OwnershipsRepository(db);
}
