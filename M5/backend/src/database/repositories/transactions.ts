import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface TransactionRecord {
  id: string;
  game_id: string;
  turn_id: string | null;
  from_participant_id: string | null;
  to_participant_id: string | null;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: Date;
}

export class TransactionsRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async listRecentByGameWithTurnNumber(
    gameId: string,
    limit = 100,
  ): Promise<
    {
      id: string;
      created_at: string | Date;
      turn_id: string | null;
      turn_number: number | null;
      from_participant_id: string | null;
      to_participant_id: string | null;
      amount: number;
      transaction_type: string;
      description: string | null;
    }[]
  > {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const query = `
      SELECT
        tx.id,
        tx.created_at,
        tx.turn_id,
        t.turn_number,
        tx.from_participant_id,
        tx.to_participant_id,
        tx.amount,
        tx.transaction_type,
        tx.description
      FROM transactions tx
      LEFT JOIN turns t ON t.id = tx.turn_id
      WHERE tx.game_id = $1
      ORDER BY tx.created_at DESC
      LIMIT $2
    `;
    return this.db.manyOrNone(query, [gameId, safeLimit]);
  }

  async create(params: {
    gameId: string;
    amount: number;
    transactionType: string;
    description?: string | null;
    turnId?: string | null;
    fromParticipantId?: string | null;
    toParticipantId?: string | null;
  }): Promise<TransactionRecord> {
    const query = `
      INSERT INTO transactions (
        game_id,
        turn_id,
        from_participant_id,
        to_participant_id,
        amount,
        transaction_type,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        game_id,
        turn_id,
        from_participant_id,
        to_participant_id,
        amount,
        transaction_type,
        description,
        created_at
    `;

    return this.db.one(query, [
      params.gameId,
      params.turnId ?? null,
      params.fromParticipantId ?? null,
      params.toParticipantId ?? null,
      params.amount,
      params.transactionType,
      params.description ?? null,
    ]);
  }
}

export const transactionsRepository = new TransactionsRepository(pgPool);

export function createTransactionsRepository(
  db: DbClient,
): TransactionsRepository {
  return new TransactionsRepository(db);
}
