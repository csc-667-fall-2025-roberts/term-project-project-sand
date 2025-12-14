import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";

export interface CardDrawRecord {
  id: string;
  game_id: string;
  card_deck_id: string;
  card_id: string;
  participant_id: string;
  turn_id: string | null;
  created_at: Date;
}

class CardDrawsRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

  async create(params: {
    gameId: string;
    cardDeckId: string;
    cardId: string;
    participantId: string;
    turnId?: string | null;
  }): Promise<CardDrawRecord> {
    const query = `
      INSERT INTO card_draws (
        game_id,
        card_deck_id,
        card_id,
        participant_id,
        turn_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        game_id,
        card_deck_id,
        card_id,
        participant_id,
        turn_id,
        created_at
    `;

    return this.db.one(query, [
      params.gameId,
      params.cardDeckId,
      params.cardId,
      params.participantId,
      params.turnId ?? null,
    ]);
  }
}

export const cardDrawsRepository = new CardDrawsRepository(pgPool);
