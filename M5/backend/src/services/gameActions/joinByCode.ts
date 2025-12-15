import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import type { GameRealtimeEvent } from "./events.js";
import { joinGameTx } from "./joinGameTx.js";

type JoinGameTxResult = Awaited<ReturnType<typeof joinGameTx>>;

export type JoinByCodeResult =
  | { kind: "code_not_found" }
  | ({ gameId: string } & Exclude<JoinGameTxResult, { kind: "ok" }>)
  | {
      kind: "ok";
      gameId: string;
      participant: Extract<JoinGameTxResult, { kind: "ok" }>["participant"];
      publicState: Extract<JoinGameTxResult, { kind: "ok" }>["publicState"];
      maxPlayers: Extract<JoinGameTxResult, { kind: "ok" }>["maxPlayers"];
      events: GameRealtimeEvent[];
    };

export async function joinByCodeAction(
  db: DbClient,
  params: {
    userId: string;
    gameCode: string;
    tokenColor: string;
  },
): Promise<JoinByCodeResult> {
  const gamesRepo = createGamesRepository(db);
  const gameId = await gamesRepo.findIdByGameCode(params.gameCode);
  if (!gameId) return { kind: "code_not_found" };

  const result = await joinGameTx(db, {
    gameId,
    userId: params.userId,
    tokenColor: params.tokenColor,
  });

  if (result.kind === "ok") {
    return {
      kind: "ok",
      gameId,
      participant: result.participant,
      publicState: result.publicState,
      maxPlayers: result.maxPlayers,
      events: [
        { kind: "gameStateUpdate", gameId, payload: result.publicState },
      ],
    };
  }

  return { gameId, ...result };
}
