import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { createTransactionsRepository } from "../../database/repositories/transactions.js";
import { createTurnsRepository } from "../../database/repositories/turns.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";
import { maybeEndGameIfWinner } from "./shared/gameProgression.js";
import { isRecord, toFiniteNumber } from "./shared/typeGuards.js";

export type PayRentResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "no_pending" }
  | { kind: "wrong_pending" }
  | { kind: "mismatch" }
  | { kind: "bad_payload" }
  | { kind: "insufficient" }
  | {
      kind: "ok";
      payerBankrupt: boolean;
      ownerParticipantId: string;
      ownerBalance: number;
      events: GameRealtimeEvent[];
    };

export async function payRentAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    propertyId: string;
    pendingActionId: string;
  },
): Promise<PayRentResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);
  const turnsRepo = createTurnsRepository(db);
  const transactionsRepo = createTransactionsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const payer = await participantsRepo.findByGameAndUserForUpdate(
    params.gameId,
    params.userId,
  );
  if (!payer) return { kind: "not_participant" };

  const pa = await pendingActionsRepo.findPendingForUpdate({
    id: params.pendingActionId,
    gameId: params.gameId,
    participantId: payer.id,
  });

  if (!pa) return { kind: "no_pending" };
  if (pa.action_type !== "pay_rent") return { kind: "wrong_pending" };

  const payload = pa.payload_json as unknown;
  if (!isRecord(payload)) return { kind: "bad_payload" };

  const tileId = payload["tile_id"];
  const ownerParticipantId = payload["owner_participant_id"];
  const amount = toFiniteNumber(payload["amount"]);

  if (typeof tileId !== "string" || tileId !== params.propertyId)
    return { kind: "mismatch" };
  if (typeof ownerParticipantId !== "string") return { kind: "bad_payload" };
  if (amount == null || amount <= 0) return { kind: "bad_payload" };

  const owner = await participantsRepo.findByIdAndGameForUpdate(
    ownerParticipantId,
    params.gameId,
  );
  if (!owner) return { kind: "bad_payload" };

  if (payer.cash < amount) {
    return { kind: "insufficient" };
  }

  const lastTurn = await turnsRepo.findLastByGameAndParticipant(
    params.gameId,
    payer.id,
  );

  const payerBalance = await participantsRepo.decrementCash(payer.id, amount);
  const ownerBalance = await participantsRepo.incrementCash(owner.id, amount);

  await transactionsRepo.create({
    gameId: params.gameId,
    fromParticipantId: payer.id,
    toParticipantId: ownerParticipantId,
    amount,
    transactionType: "rent",
    description: "Paid rent",
    turnId: lastTurn?.id ?? null,
  });

  await pendingActionsRepo.markCompleted(pa.id);

  const publicState = await buildPublicGameState(db, params.gameId);

  const end = await maybeEndGameIfWinner(db, params.gameId);

  const events: GameRealtimeEvent[] = [
    { kind: "gameStateUpdate", gameId: params.gameId, payload: publicState },
  ];

  if (end.ended && end.winnerParticipantId) {
    events.push({
      kind: "gameEnded",
      gameId: params.gameId,
      payload: {
        game_id: params.gameId,
        winner_participant_id: end.winnerParticipantId,
      },
    });
  }

  events.push({
    kind: "privateBalanceUpdate",
    userId: params.userId,
    payload: {
      game_id: params.gameId,
      player_id: payer.id,
      balance: payerBalance,
    },
  });

  return {
    kind: "ok",
    payerBankrupt: payer.is_bankrupt,
    ownerParticipantId,
    ownerBalance,
    events,
  };
}
