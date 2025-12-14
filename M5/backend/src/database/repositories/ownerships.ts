import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";

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

class OwnershipsRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

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
