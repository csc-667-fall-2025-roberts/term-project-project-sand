import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface TurnRecord {
  id: string;
  game_id: string;
  participant_id: string;
  turn_number: number;
  dice_roll_1: number | null;
  dice_roll_2: number | null;
  is_double: boolean;
  previous_position: number | null;
  new_position: number | null;
  action_taken: string | null;
  created_at: Date;
}

export class TurnsRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async updateOutcome(
    turnId: string,
    params: { newPosition: number; actionTaken: string | null },
  ): Promise<void> {
    const query = `
      UPDATE turns
      SET new_position = $2, action_taken = $3
      WHERE id = $1
    `;
    await this.db.none(query, [turnId, params.newPosition, params.actionTaken]);
  }

  async findLastByGameAndParticipant(
    gameId: string,
    participantId: string,
  ): Promise<{ id: string } | null> {
    const query = `
      SELECT id
      FROM turns
      WHERE game_id = $1 AND participant_id = $2
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    return this.db.oneOrNone(query, [gameId, participantId]);
  }

  async listRecentMovesByGame(
    gameId: string,
    limit = 50,
  ): Promise<
    {
      turn_id: string;
      participant_id: string;
      turn_number: number;
      created_at: string | Date;
      dice_roll_1: number | null;
      dice_roll_2: number | null;
      is_double: boolean | null;
      previous_position: number | null;
      new_position: number | null;
      action_taken: string | null;
    }[]
  > {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const query = `
      SELECT
        id AS turn_id,
        participant_id,
        turn_number,
        created_at,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken
      FROM turns
      WHERE game_id = $1
      ORDER BY turn_number DESC
      LIMIT $2
    `;
    return this.db.manyOrNone(query, [gameId, safeLimit]);
  }

  async findLastRollByGame(gameId: string): Promise<{
    participant_id: string;
    turn_number: number;
    dice_roll_1: number | null;
    dice_roll_2: number | null;
    is_double: boolean | null;
    previous_position: number | null;
    new_position: number | null;
    action_taken: string | null;
  } | null> {
    const query = `
      SELECT
        participant_id,
        turn_number,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken
      FROM turns
      WHERE game_id = $1
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    return this.db.oneOrNone(query, [gameId]);
  }

  async create(params: {
    gameId: string;
    participantId: string;
    turnNumber: number;
    diceRoll1?: number | null;
    diceRoll2?: number | null;
    isDouble?: boolean;
    previousPosition?: number | null;
    newPosition?: number | null;
    actionTaken?: string | null;
  }): Promise<TurnRecord> {
    const query = `
      INSERT INTO turns (
        game_id,
        participant_id,
        turn_number,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        game_id,
        participant_id,
        turn_number,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken,
        created_at
    `;

    const dice1 = params.diceRoll1 ?? null;
    const dice2 = params.diceRoll2 ?? null;

    return this.db.one<TurnRecord>(query, [
      params.gameId,
      params.participantId,
      params.turnNumber,
      dice1,
      dice2,
      params.isDouble ?? false,
      params.previousPosition ?? null,
      params.newPosition ?? null,
      params.actionTaken ?? null,
    ]);
  }

  async lastTurnNumber(gameId: string): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(turn_number), 0)::int AS max
      FROM turns
      WHERE game_id = $1
    `;

    const row = await this.db.one<{ max: number }>(query, [gameId]);
    return row.max;
  }
}

export const turnsRepository = new TurnsRepository(pgPool);

export function createTurnsRepository(db: DbClient): TurnsRepository {
  return new TurnsRepository(db);
}
