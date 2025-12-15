import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { createTransactionsRepository } from "../../database/repositories/transactions.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";
import { isRecord, toFiniteNumber } from "./shared/typeGuards.js";

export type PayDebtResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "no_pending" }
  | { kind: "wrong_pending" }
  | { kind: "bad_payload" }
  | { kind: "insufficient" }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function payDebtAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    pendingActionId: string;
  },
): Promise<PayDebtResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);
  const transactionsRepo = createTransactionsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const participant = await participantsRepo.findByGameAndUserForUpdate(
    params.gameId,
    params.userId,
  );
  if (!participant) return { kind: "not_participant" };

  const pa = await pendingActionsRepo.findPendingForUpdate({
    id: params.pendingActionId,
    gameId: params.gameId,
    participantId: participant.id,
  });
  if (!pa) return { kind: "no_pending" };
  if (pa.action_type !== "pay_bank_debt") return { kind: "wrong_pending" };

  const payload = pa.payload_json;
  if (!isRecord(payload)) return { kind: "bad_payload" };

  const amount = toFiniteNumber(payload["amount"]);
  const transactionType =
    typeof payload["transaction_type"] === "string"
      ? (payload["transaction_type"] as string)
      : "tax";
  const description =
    typeof payload["description"] === "string"
      ? (payload["description"] as string)
      : "Bank debt";
  const turnId =
    typeof payload["turn_id"] === "string"
      ? (payload["turn_id"] as string)
      : null;

  if (amount == null || amount <= 0) {
    return { kind: "bad_payload" };
  }

  if (participant.cash < amount) return { kind: "insufficient" };

  const newBalance = await participantsRepo.decrementCash(
    participant.id,
    amount,
  );

  await transactionsRepo.create({
    gameId: params.gameId,
    fromParticipantId: participant.id,
    toParticipantId: null,
    amount,
    transactionType,
    description,
    turnId,
  });

  await pendingActionsRepo.markCompleted(pa.id);

  const publicState = await buildPublicGameState(db, params.gameId);

  return {
    kind: "ok",
    events: [
      {
        kind: "gameStateUpdate",
        gameId: params.gameId,
        payload: publicState,
      },
      {
        kind: "privateBalanceUpdate",
        userId: params.userId,
        payload: {
          game_id: params.gameId,
          player_id: participant.id,
          balance: newBalance,
        },
      },
    ],
  };
}
