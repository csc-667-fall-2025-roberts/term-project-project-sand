import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";
import { pgPool } from "../index.js";

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

class TransactionsRepository {
  constructor(
    private readonly db: IDatabase<Record<string, unknown>, IClient>,
  ) {}

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
