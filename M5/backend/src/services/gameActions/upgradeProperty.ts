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
import { computeCurrentTurnPlayer } from "./shared/gameProgression.js";
import { upgradeCostForGroup } from "./shared/gameMath.js";

const MAX_HOUSES_BEFORE_HOTEL = 4;

export type UpgradePropertyResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "not_your_turn" }
  | { kind: "has_pending" }
  | { kind: "not_owner" }
  | { kind: "not_upgradable" }
  | { kind: "max_level" }
  | { kind: "insufficient_funds"; required: number; cash: number }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function upgradePropertyAction(
  db: DbClient,
  params: {
    userId: string;
    gameId: string;
    propertyId: string;
  },
): Promise<UpgradePropertyResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);
  const tilesRepo = createTilesRepository(db);
  const ownershipRepo = createOwnershipsRepository(db);
  const turnsRepo = createTurnsRepository(db);
  const transactionsRepo = createTransactionsRepository(db);

  const game = await gamesRepo.findById(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const currentTurn = await computeCurrentTurnPlayer(db, params.gameId);
  if (!currentTurn) return { kind: "bad_phase" };
  if (currentTurn.userId !== params.userId) return { kind: "not_your_turn" };

  const participant = await participantsRepo.findByGameAndUser(
    params.gameId,
    params.userId,
  );
  if (!participant) return { kind: "not_participant" };

  const existingPending = await pendingActionsRepo.findPendingByParticipant(
    params.gameId,
    participant.id,
  );
  if (existingPending) return { kind: "has_pending" };

  const tile = await tilesRepo.findById(params.propertyId);
  if (!tile) return { kind: "not_found" };

  if (tile.tile_type !== "property") return { kind: "not_upgradable" };

  const own = await ownershipRepo.findByGameAndTile(
    params.gameId,
    params.propertyId,
  );
  if (!own || own.participant_id !== participant.id)
    return { kind: "not_owner" };
  if (own.is_mortgaged) return { kind: "not_upgradable" };

  const cost = upgradeCostForGroup(tile.property_group);
  if (cost <= 0) return { kind: "not_upgradable" };

  const houses = Math.max(0, Math.floor(own.houses ?? 0));
  const hotels = Math.max(0, Math.floor(own.hotels ?? 0));

  // Can't upgrade beyond hotel level
  if (hotels > 0) return { kind: "max_level" };

  const next =
    houses < MAX_HOUSES_BEFORE_HOTEL
      ? { houses: houses + 1, hotels: 0 }
      : { houses: 0, hotels: 1 };

  const cash = await participantsRepo.findCashByIdAndGame(
    participant.id,
    params.gameId,
  );
  const currentCash = cash ?? 0;
  if (currentCash < cost) {
    return { kind: "insufficient_funds", required: cost, cash: currentCash };
  }

  await db.none(
    "UPDATE ownerships SET houses = $3, hotels = $4, updated_at = now() WHERE game_id = $1 AND tile_id = $2",
    [params.gameId, params.propertyId, next.houses, next.hotels],
  );

  const newBalance = await participantsRepo.incrementCash(
    participant.id,
    -cost,
  );

  const currentTurnRow = await turnsRepo.findLastByGameAndParticipant(
    params.gameId,
    participant.id,
  );

  await transactionsRepo.create({
    gameId: params.gameId,
    turnId: currentTurnRow?.id ?? null,
    fromParticipantId: participant.id,
    toParticipantId: null,
    amount: cost,
    transactionType: "upgrade_property",
    description:
      next.hotels > 0
        ? `Built a hotel on ${tile.name}`
        : `Built house #${next.houses} on ${tile.name}`,
  });

  const publicState = await buildPublicGameState(db, params.gameId);

  const events: GameRealtimeEvent[] = [
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
  ];

  return { kind: "ok", events };
}
