import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import type { GameRealtimeEvent } from "./events.js";

export type DeleteGameResult =
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function deleteGameAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
  },
): Promise<DeleteGameResult> {
  const gamesRepo = createGamesRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.created_by !== params.userId) return { kind: "forbidden" };

  await gamesRepo.deleteById(params.gameId);

  return {
    kind: "ok",
    events: [
      {
        kind: "gameEnded",
        gameId: params.gameId,
        payload: { game_id: params.gameId, deleted: true },
      },
    ],
  };
}
