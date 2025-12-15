import type { DbClient } from "../../database/dbClient.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import type { GameRealtimeEvent } from "./events.js";
import { joinGameTx, pickAvailableTokenColor } from "./joinGameTx.js";
import { normalizeTokenColor } from "./shared/tokenColors.js";

type JoinGameTxResult = Awaited<ReturnType<typeof joinGameTx>>;
type JoinGameTxOk = Extract<JoinGameTxResult, { kind: "ok" }>;

export type JoinAutoResult =
  | { kind: "no_colors" }
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "invalid_color" }
  | { kind: "already_joined"; participantId: string; tokenColor: string | null }
  | { kind: "full" }
  | { kind: "color_taken" }
  | {
      kind: "ok";
      participant: JoinGameTxOk["participant"];
      publicState: JoinGameTxOk["publicState"];
      maxPlayers: JoinGameTxOk["maxPlayers"];
      events: GameRealtimeEvent[];
    };

export async function joinAutoAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
  },
): Promise<JoinAutoResult> {
  const participantsRepo = createGameParticipantsRepository(db);
  const existing = await participantsRepo.findByGameAndUser(
    params.gameId,
    params.userId,
  );

  if (existing) {
    const result = await joinGameTx(db, {
      gameId: params.gameId,
      userId: params.userId,
      tokenColor: existing.token_color
        ? normalizeTokenColor(existing.token_color)
        : "red",
    });
    if (result.kind === "ok") {
      return {
        ...result,
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

  const tokenColor = await pickAvailableTokenColor(db, params.gameId);
  if (!tokenColor) {
    return { kind: "no_colors" };
  }

  const result = await joinGameTx(db, {
    gameId: params.gameId,
    userId: params.userId,
    tokenColor,
  });

  if (result.kind === "ok") {
    return {
      ...result,
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
