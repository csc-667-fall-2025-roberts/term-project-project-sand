import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createOwnershipsRepository } from "../../database/repositories/ownerships.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { createTilesRepository } from "../../database/repositories/tiles.js";
import { createTransactionsRepository } from "../../database/repositories/transactions.js";
import { createTurnsRepository } from "../../database/repositories/turns.js";
import { buildPublicGameState } from "../gameState.js";
import { buildOptionsPayloadFromPendingAction } from "../pendingActionOptions.js";
import type { GameRealtimeEvent } from "./events.js";
import { upgradeCostForGroup } from "./shared/gameMath.js";

export type SellPropertyResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "bankrupt" }
  | { kind: "bad_tile" }
  | { kind: "not_owner" }
  | { kind: "not_sellable" }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function sellPropertyAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    propertyId: string;
  },
): Promise<SellPropertyResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const tilesRepo = createTilesRepository(db);
  const ownershipsRepo = createOwnershipsRepository(db);
  const turnsRepo = createTurnsRepository(db);
  const transactionsRepo = createTransactionsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const participant = await participantsRepo.findByGameAndUserForUpdate(
    params.gameId,
    params.userId,
  );
  if (!participant) return { kind: "not_participant" };
  if (participant.is_bankrupt) return { kind: "bankrupt" };

  const tile = await tilesRepo.findById(params.propertyId);
  if (!tile) return { kind: "bad_tile" };

  const own = await ownershipsRepo.findByGameAndTileForUpdate(
    params.gameId,
    params.propertyId,
  );
  if (!own || own.participant_id !== participant.id)
    return { kind: "not_owner" };

  const price = tile.purchase_price ?? 0;
  if (!Number.isFinite(price) || price <= 0) {
    return { kind: "not_sellable" };
  }

  const houses = Math.max(0, Math.floor(own.houses));
  const saleValue =
    Math.floor(price / 2) +
    (upgradeCostForGroup(tile.property_group) * houses) / 2;

  await ownershipsRepo.deleteById(own.id);

  const newBalance = await participantsRepo.incrementCash(
    participant.id,
    saleValue,
  );

  const lastTurn = await turnsRepo.findLastByGameAndParticipant(
    params.gameId,
    participant.id,
  );

  await transactionsRepo.create({
    gameId: params.gameId,
    fromParticipantId: null,
    toParticipantId: participant.id,
    amount: saleValue,
    transactionType: "sale",
    description: `Sold ${tile.name}`,
    turnId: lastTurn?.id ?? null,
  });

  const pending = await pendingActionsRepo.findPendingByParticipant(
    params.gameId,
    participant.id,
  );

  const optionsPayload = pending
    ? await buildOptionsPayloadFromPendingAction(db, {
        gameId: params.gameId,
        participantId: participant.id,
        pendingAction: pending,
        context: "pending_action",
      })
    : null;

  const publicState = await buildPublicGameState(db, params.gameId);

  const events: GameRealtimeEvent[] = [
    { kind: "gameStateUpdate", gameId: params.gameId, payload: publicState },
    {
      kind: "privateBalanceUpdate",
      userId: params.userId,
      payload: {
        game_id: params.gameId,
        player_id: participant.id,
        balance: newBalance,
      },
    },
  ];

  if (optionsPayload) {
    events.push({
      kind: "privateOptions",
      userId: params.userId,
      payload: optionsPayload,
    });
  }

  return { kind: "ok", events };
}
