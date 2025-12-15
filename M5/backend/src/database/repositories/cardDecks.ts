import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export type DeckType = "chance" | "community_chest";

export interface CardDeckRecord {
  id: string;
  game_id: string;
  deck_type: DeckType;
  current_index: number;
  created_at: Date;
}

export class CardDecksRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async findByGameAndTypeForUpdate(
    gameId: string,
    deckType: DeckType,
  ): Promise<CardDeckRecord | null> {
    const query = `
      SELECT id, game_id, deck_type, current_index, created_at
      FROM card_decks
      WHERE game_id = $1 AND deck_type = $2
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [gameId, deckType]);
  }

  async ensureDefaultDecksForGame(gameId: string): Promise<void> {
    const query = `
      INSERT INTO card_decks (game_id, deck_type)
      VALUES ($1, 'chance'), ($1, 'community_chest')
      ON CONFLICT (game_id, deck_type) DO NOTHING
    `;
    await this.db.none(query, [gameId]);
  }

  async create(gameId: string, deckType: DeckType): Promise<CardDeckRecord> {
    const query = `
      INSERT INTO card_decks (game_id, deck_type)
      VALUES ($1, $2)
      RETURNING id, game_id, deck_type, current_index, created_at
    `;

    return this.db.one(query, [gameId, deckType]);
  }

  async findByGameAndType(
    gameId: string,
    deckType: DeckType,
  ): Promise<CardDeckRecord | null> {
    const query = `
      SELECT id, game_id, deck_type, current_index, created_at
      FROM card_decks
      WHERE game_id = $1 AND deck_type = $2
    `;

    return this.db.oneOrNone(query, [gameId, deckType]);
  }

  async advanceIndex(deckId: string, nextIndex: number): Promise<void> {
    const query = `
      UPDATE card_decks
      SET current_index = $2
      WHERE id = $1
    `;

    await this.db.none(query, [deckId, nextIndex]);
  }
}

export const cardDecksRepository = new CardDecksRepository(pgPool);

export function createCardDecksRepository(db: DbClient): CardDecksRepository {
  return new CardDecksRepository(db);
}
