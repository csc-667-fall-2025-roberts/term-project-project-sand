import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";

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

class TurnsRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

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

    return this.db.one(query, [
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

    const row = await this.db.one(query, [gameId]);
    return row.max as number;
  }
}

export const turnsRepository = new TurnsRepository(pgPool);
