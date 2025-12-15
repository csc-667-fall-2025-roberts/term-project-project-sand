import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";

export type EndTurnResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_your_turn" }
  | { kind: "has_pending" }
  | { kind: "bad_state" }
  | {
      kind: "ended";
      events: GameRealtimeEvent[];
    }
  | {
      kind: "ok";
      events: GameRealtimeEvent[];
    };

export async function endTurnAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
  },
): Promise<EndTurnResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const participants = await participantsRepo.listByGameForUpdate(
    params.gameId,
  );
  const active = participants.filter((p) => !p.is_bankrupt);
  if (active.length === 0) return { kind: "bad_state" };

  const currentIndex = game.turn_index % active.length;
  const current = active[currentIndex];
  if (!current) return { kind: "bad_state" };
  if (current.user_id !== params.userId) return { kind: "not_your_turn" };

  const pending = await pendingActionsRepo.findPendingByParticipantForUpdate(
    params.gameId,
    current.id,
  );

  if (pending) {
    if (pending.action_type === "buy_property") {
      await pendingActionsRepo.markCancelled(pending.id);
    } else {
      return { kind: "has_pending" };
    }
  }

  if (active.length === 1) {
    await gamesRepo.markEnded(params.gameId);

    const standings = [...participants]
      .sort((a, b) => {
        if (a.is_bankrupt !== b.is_bankrupt) return a.is_bankrupt ? 1 : -1;
        return b.cash - a.cash;
      })
      .map((p) => ({ player_id: p.id, balance: p.cash }));

    const winner = standings[0]?.player_id ?? null;

    return {
      kind: "ended",
      events: [
        {
          kind: "gameEnded",
          gameId: params.gameId,
          payload: {
            game_id: params.gameId,
            winner_id: winner,
            final_standings: standings.map((s, idx: number) => ({
              player_id: s.player_id,
              rank: idx + 1,
              balance: s.balance,
            })),
          },
        },
      ],
    };
  }

  const nextIndex = (currentIndex + 1) % active.length;
  const next = active[nextIndex];
  if (!next) return { kind: "bad_state" };

  await gamesRepo.setTurnIndex(params.gameId, nextIndex);

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
        kind: "turnChanged",
        gameId: params.gameId,
        payload: {
          game_id: params.gameId,
          previous_player_id: current.id,
          current_player_id: next.id,
          turn_number: publicState.turn_number,
        },
      },
      {
        kind: "privateOptions",
        userId: next.user_id,
        payload: {
          game_id: params.gameId,
          player_id: next.id,
          context: "start_turn",
          options: [{ action: "roll_dice" }],
        },
      },
    ],
  };
}
