import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export type PendingActionStatus = "pending" | "completed" | "cancelled";

export interface PendingActionRecord {
  id: string;
  game_id: string;
  participant_id: string;
  action_type: string;
  payload_json: unknown | null;
  status: PendingActionStatus;
  created_at: Date;
  updated_at: Date;
}

export class PendingActionsRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async findPendingByParticipantForUpdate(
    gameId: string,
    participantId: string,
  ): Promise<Pick<
    PendingActionRecord,
    "id" | "action_type" | "payload_json"
  > | null> {
    const query = `
      SELECT id, action_type, payload_json
      FROM pending_actions
      WHERE game_id = $1 AND participant_id = $2 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [gameId, participantId]);
  }

  async findPendingForUpdate(params: {
    id: string;
    gameId: string;
    participantId: string;
  }): Promise<PendingActionRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        participant_id,
        action_type,
        payload_json,
        status,
        created_at,
        updated_at
      FROM pending_actions
      WHERE id = $1
        AND game_id = $2
        AND participant_id = $3
        AND status = 'pending'
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [
      params.id,
      params.gameId,
      params.participantId,
    ]);
  }

  async markCompleted(id: string): Promise<void> {
    await this.markStatus(id, "completed");
  }

  async markCancelled(id: string): Promise<void> {
    await this.markStatus(id, "cancelled");
  }

  async create(params: {
    gameId: string;
    participantId: string;
    actionType: string;
    payload: unknown | null;
  }): Promise<PendingActionRecord> {
    const query = `
      INSERT INTO pending_actions (game_id, participant_id, action_type, payload_json)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        game_id,
        participant_id,
        action_type,
        payload_json,
        status,
        created_at,
        updated_at
    `;

    return this.db.one(query, [
      params.gameId,
      params.participantId,
      params.actionType,
      params.payload,
    ]);
  }

  async findById(id: string): Promise<PendingActionRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        participant_id,
        action_type,
        payload_json,
        status,
        created_at,
        updated_at
      FROM pending_actions
      WHERE id = $1
    `;

    return this.db.oneOrNone(query, [id]);
  }

  async findPendingByParticipant(
    gameId: string,
    participantId: string,
  ): Promise<PendingActionRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        participant_id,
        action_type,
        payload_json,
        status,
        created_at,
        updated_at
      FROM pending_actions
      WHERE game_id = $1
        AND participant_id = $2
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return this.db.oneOrNone(query, [gameId, participantId]);
  }

  async markStatus(id: string, status: PendingActionStatus): Promise<void> {
    const query = `
      UPDATE pending_actions
      SET status = $2, updated_at = now()
      WHERE id = $1
    `;

    await this.db.none(query, [id, status]);
  }
}

export const pendingActionsRepository = new PendingActionsRepository(pgPool);

export function createPendingActionsRepository(
  db: DbClient,
): PendingActionsRepository {
  return new PendingActionsRepository(db);
}
