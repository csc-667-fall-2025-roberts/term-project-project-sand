import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";

export type GameStatus = "waiting" | "playing" | "ended";

export interface GameRecord {
  id: string;
  name: string;
  created_by: string;
  game_code: string;
  status: GameStatus;
  game_type: string | null;
  max_players: number;
  turn_index: number;
  starting_balance: number;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

class GamesRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

  async create(params: {
    name: string;
    createdBy: string;
    gameCode: string;
    maxPlayers: number;
    startingBalance: number;
    gameType: string;
  }): Promise<GameRecord> {
    const query = `
      INSERT INTO games (
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance
      )
      VALUES ($1, $2, $3, 'waiting', $4, $5, 0, $6)
      RETURNING
        id,
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance,
        started_at,
        ended_at,
        created_at,
        updated_at
    `;

    return this.db.one(query, [
      params.name,
      params.createdBy,
      params.gameCode,
      params.gameType,
      params.maxPlayers,
      params.startingBalance,
    ]);
  }

  async findById(id: string): Promise<GameRecord | null> {
    const query = `
      SELECT
        id,
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance,
        started_at,
        ended_at,
        created_at,
        updated_at
      FROM games
      WHERE id = $1
    `;

    return this.db.oneOrNone(query, [id]);
  }

  async findByIdForUpdate(id: string): Promise<GameRecord | null> {
    const query = `
      SELECT
        id,
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance,
        started_at,
        ended_at,
        created_at,
        updated_at
      FROM games
      WHERE id = $1
      FOR UPDATE
    `;

    return this.db.oneOrNone(query, [id]);
  }

  async setStatus(
    id: string,
    status: GameStatus,
    timestamps?: { startedAt?: Date | null; endedAt?: Date | null },
  ): Promise<GameRecord> {
    const query = `
      UPDATE games
      SET
        status = $2,
        started_at = COALESCE($3, started_at),
        ended_at = COALESCE($4, ended_at),
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance,
        started_at,
        ended_at,
        created_at,
        updated_at
    `;

    return this.db.one(query, [
      id,
      status,
      timestamps?.startedAt ?? null,
      timestamps?.endedAt ?? null,
    ]);
  }

  async setTurnIndex(id: string, turnIndex: number): Promise<GameRecord> {
    const query = `
      UPDATE games
      SET turn_index = $2, updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        name,
        created_by,
        game_code,
        status,
        game_type,
        max_players,
        turn_index,
        starting_balance,
        started_at,
        ended_at,
        created_at,
        updated_at
    `;

    return this.db.one(query, [id, turnIndex]);
  }
}

export const gamesRepository = new GamesRepository(pgPool);
