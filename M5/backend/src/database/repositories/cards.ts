import { pgp, pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export type DeckType = "chance" | "community_chest";

export interface CardRecord {
  id: string;
  deck_type: DeckType;
  card_order: number;
  message: string;
  action_type: string;
  action_value: string | null;
  created_at: Date;
}

export interface NewCard {
  deck_type: DeckType;
  card_order: number;
  message: string;
  action_type: string;
  action_value?: string | null;
}

export class CardsRepository {
  constructor(private readonly db: DbClient) {}

  async countByDeckType(deckType: DeckType): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM cards
      WHERE deck_type = $1
    `;
    const row = await this.db.one<{ count: number }>(query, [deckType]);
    return row.count;
  }

  async listByDeckType(deckType: DeckType): Promise<CardRecord[]> {
    const query = `
      SELECT
        id,
        deck_type,
        card_order,
        message,
        action_type,
        action_value,
        created_at
      FROM cards
      WHERE deck_type = $1
      ORDER BY card_order ASC
    `;

    return this.db.manyOrNone(query, [deckType]);
  }

  async insertManyIgnoreConflicts(cards: NewCard[]): Promise<number> {
    if (cards.length === 0) return 0;

    const columns = new pgp.helpers.ColumnSet(
      ["deck_type", "card_order", "message", "action_type", "action_value"],
      { table: "cards" },
    );

    const values = cards.map((c) => ({
      deck_type: c.deck_type,
      card_order: c.card_order,
      message: c.message,
      action_type: c.action_type,
      action_value: c.action_value ?? null,
    }));

    const insert = pgp.helpers.insert(values, columns);
    const query = `${insert} ON CONFLICT (deck_type, card_order) DO NOTHING`;

    const result = await this.db.result(query);
    return result.rowCount;
  }

  async findByDeckTypeAndOrder(
    deckType: DeckType,
    order: number,
  ): Promise<CardRecord | null> {
    const query = `
      SELECT
        id,
        deck_type,
        card_order,
        message,
        action_type,
        action_value,
        created_at
      FROM cards
      WHERE deck_type = $1 AND card_order = $2
    `;

    return this.db.oneOrNone(query, [deckType, order]);
  }
}

export const cardsRepository = new CardsRepository(pgPool);

export function createCardsRepository(db: DbClient): CardsRepository {
  return new CardsRepository(db);
}
