import type { DbClient } from "../../database/dbClient.js";
import type { GameRealtimeEvent } from "./events.js";
import { joinGameTx } from "./joinGameTx.js";

type JoinGameTxResult = Awaited<ReturnType<typeof joinGameTx>>;

export type JoinGameResult =
  | Exclude<JoinGameTxResult, { kind: "ok" }>
  | {
      kind: "ok";
      participant: Extract<JoinGameTxResult, { kind: "ok" }>["participant"];
      publicState: Extract<JoinGameTxResult, { kind: "ok" }>["publicState"];
      maxPlayers: Extract<JoinGameTxResult, { kind: "ok" }>["maxPlayers"];
      events: GameRealtimeEvent[];
    };

export async function joinGameAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    tokenColor: string;
  },
): Promise<JoinGameResult> {
  const result = await joinGameTx(db, {
    gameId: params.gameId,
    userId: params.userId,
    tokenColor: params.tokenColor,
  });

  if (result.kind === "ok") {
    return {
      kind: "ok",
      participant: result.participant,
      publicState: result.publicState,
      maxPlayers: result.maxPlayers,
      events: [
        {
          kind: "gameStateUpdate",
          gameId: params.gameId,
          payload: result.publicState,
        },
      ],
    };
  }

  return result;
}
