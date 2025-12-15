import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { buildPublicGameState } from "../gameState.js";
import {
  AUTO_TOKEN_COLORS,
  normalizeTokenColor,
  parseTokenColor,
  type TokenColor,
} from "./shared/tokenColors.js";

export async function pickAvailableTokenColor(
  db: DbClient,
  gameId: string,
): Promise<TokenColor | null> {
  const participantsRepo = createGameParticipantsRepository(db);
  const rows = await participantsRepo.listTokenColorsByGame(gameId);

  const used = new Set(
    rows
      .map((r) => r.token_color)
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c) => normalizeTokenColor(c)),
  );

  for (const color of AUTO_TOKEN_COLORS) {
    if (!used.has(color)) return color;
  }

  return null;
}

type JoinGameTxResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "invalid_color" }
  | {
      kind: "already_joined";
      participantId: string;
      tokenColor: string | null;
    }
  | { kind: "full" }
  | { kind: "color_taken" }
  | {
      kind: "ok";
      participant: { id: string; token_color: string | null };
      publicState: Awaited<ReturnType<typeof buildPublicGameState>>;
      maxPlayers: number;
    };

export async function joinGameTx(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    tokenColor: string;
  },
): Promise<JoinGameTxResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);

  if (!game) return { kind: "not_found" };
  if (game.status !== "waiting") return { kind: "bad_phase" };

  const existing = await participantsRepo.findByGameAndUser(
    params.gameId,
    params.userId,
  );

  if (existing)
    return {
      kind: "already_joined",
      participantId: existing.id,
      tokenColor: existing.token_color ?? null,
    };

  const tokenColor = parseTokenColor(params.tokenColor);
  if (!tokenColor) return { kind: "invalid_color" };

  const playerCount = await participantsRepo.countByGame(params.gameId);
  if (playerCount >= game.max_players) {
    return { kind: "full" };
  }

  const colorTaken = await participantsRepo.isTokenColorTaken(
    params.gameId,
    tokenColor,
  );

  if (colorTaken) return { kind: "color_taken" };

  const participant = await participantsRepo.create({
    gameId: params.gameId,
    userId: params.userId,
    cash: game.starting_balance,
    tokenColor,
  });

  const publicState = await buildPublicGameState(db, params.gameId);

  return {
    kind: "ok",
    participant: { id: participant.id, token_color: participant.token_color },
    publicState,
    maxPlayers: game.max_players,
  };
}
