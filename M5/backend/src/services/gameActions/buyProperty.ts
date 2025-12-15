import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createOwnershipsRepository } from "../../database/repositories/ownerships.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { createTilesRepository } from "../../database/repositories/tiles.js";
import { createTransactionsRepository } from "../../database/repositories/transactions.js";
import { createTurnsRepository } from "../../database/repositories/turns.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";
import { isRecord, toFiniteNumber } from "./shared/typeGuards.js";

export type BuyPropertyResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "no_pending" }
  | { kind: "wrong_pending" }
  | { kind: "mismatch" }
  | { kind: "bad_payload" }
  | { kind: "bad_tile" }
  | { kind: "already_owned" }
  | { kind: "insufficient" }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function buyPropertyAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    propertyId: string;
    pendingActionId: string;
  },
): Promise<BuyPropertyResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);
  const tilesRepo = createTilesRepository(db);
  const ownershipsRepo = createOwnershipsRepository(db);
  const turnsRepo = createTurnsRepository(db);
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
  if (pa.action_type !== "buy_property") return { kind: "wrong_pending" };

  const payload = pa.payload_json as unknown;
  if (!isRecord(payload)) return { kind: "bad_payload" };

  const tileId = payload["tile_id"];
  const cost = toFiniteNumber(payload["cost"]);
  if (typeof tileId !== "string" || tileId !== params.propertyId)
    return { kind: "mismatch" };
  if (cost == null || cost <= 0) return { kind: "bad_payload" };

  const tile = await tilesRepo.findById(tileId);
  if (!tile) return { kind: "bad_tile" };

  const existingOwnership = await ownershipsRepo.findByGameAndTile(
    params.gameId,
    tileId,
  );
  if (existingOwnership) return { kind: "already_owned" };

  if (participant.cash < cost) return { kind: "insufficient" };

  const newBalance = await participantsRepo.decrementCash(participant.id, cost);
  await ownershipsRepo.create({
    gameId: params.gameId,
    tileId,
    participantId: participant.id,
  });

  const lastTurn = await turnsRepo.findLastByGameAndParticipant(
    params.gameId,
    participant.id,
  );

  await transactionsRepo.create({
    gameId: params.gameId,
    fromParticipantId: participant.id,
    toParticipantId: null,
    amount: cost,
    transactionType: "purchase",
    description: "Purchased property",
    turnId: lastTurn?.id ?? null,
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
