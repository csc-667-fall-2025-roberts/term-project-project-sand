import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";

export type StartGameResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "forbidden" }
  | { kind: "not_enough_players" }
  | {
      kind: "ok";
      events: GameRealtimeEvent[];
    };

export async function startGameAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
  },
): Promise<StartGameResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "waiting") return { kind: "bad_phase" };
  if (game.created_by !== params.userId) return { kind: "forbidden" };

  const players = await participantsRepo.listByGame(params.gameId);
  if (players.length < 2) return { kind: "not_enough_players" };

  await gamesRepo.startPlaying(params.gameId);

  const publicState = await buildPublicGameState(db, params.gameId);
  const currentParticipantId = publicState.current_player_id;

  const currentPlayer = players.find((p) => p.id === currentParticipantId);
  const currentUserId = currentPlayer?.user_id;

  const events: GameRealtimeEvent[] = [
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
        previous_player_id: null,
        current_player_id: currentParticipantId,
        turn_number: publicState.turn_number,
      },
    },
  ];

  if (currentUserId) {
    events.push({
      kind: "privateOptions",
      userId: currentUserId,
      payload: {
        game_id: params.gameId,
        player_id: currentParticipantId,
        context: "start_turn",
        options: [{ action: "roll_dice" }],
      },
    });
  }

  return { kind: "ok", events };
}
