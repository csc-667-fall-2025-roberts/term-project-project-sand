import { randomBytes } from "crypto";

import type { DbClient } from "../../database/dbClient.js";
import type { GameRecord } from "../../database/repositories/games.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createCardDecksRepository } from "../../database/repositories/cardDecks.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { ensureReferenceDataSeeded } from "../seedData.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";
import { pgConstraint, pgErrorCode } from "./shared/pgErrors.js";

function generateGameCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

interface CreatedGameRow {
  id: string;
  name: string;
  game_code: string;
  max_players: number;
  starting_balance: number;
  status: string;
  created_by: string;
}

export interface CreateGameResult {
  kind: "ok";
  game: CreatedGameRow;
  participant: {
    id: string;
    game_id: string;
    user_id: string;
    cash: number;
    token_color: string | null;
  };
  publicState: Awaited<ReturnType<typeof buildPublicGameState>>;
  events: GameRealtimeEvent[];
}

function toCreatedGameRow(game: GameRecord): CreatedGameRow {
  return {
    id: game.id,
    name: game.name,
    game_code: game.game_code,
    max_players: game.max_players,
    starting_balance: game.starting_balance,
    status: game.status,
    created_by: game.created_by,
  };
}

export async function createGameAction(
  db: DbClient,
  params: {
    userId: string;
    name: string;
    maxPlayers: number;
    startingBalance: number;
    tokenColor: string;
  },
): Promise<CreateGameResult> {
  await ensureReferenceDataSeeded(db);

  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const cardDecksRepo = createCardDecksRepository(db);

  let game: GameRecord | null = null;
  let gameCode = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    gameCode = generateGameCode();
    const name = params.name.trim() || `Game ${gameCode}`;

    try {
      game = await gamesRepo.create({
        name,
        createdBy: params.userId,
        gameCode,
        maxPlayers: params.maxPlayers,
        startingBalance: params.startingBalance,
        gameType: "monopoly_sf",
      });
      break;
    } catch (error: unknown) {
      const code = pgErrorCode(error);
      if (code === "23505") {
        const constraint = pgConstraint(error);
        if (constraint?.includes("game_code")) continue;
        continue;
      }
      throw error;
    }
  }

  if (!game) throw new Error("Failed to generate unique game code");

  const participantRecord = await participantsRepo.create({
    gameId: game.id,
    userId: params.userId,
    cash: params.startingBalance,
    tokenColor: params.tokenColor,
  });

  await cardDecksRepo.ensureDefaultDecksForGame(game.id);

  const publicState = await buildPublicGameState(db, game.id);

  return {
    kind: "ok",
    game: toCreatedGameRow(game),
    participant: {
      id: participantRecord.id,
      game_id: participantRecord.game_id,
      user_id: participantRecord.user_id,
      cash: participantRecord.cash,
      token_color: participantRecord.token_color,
    },
    publicState,
    events: [
      { kind: "gameStateUpdate", gameId: game.id, payload: publicState },
    ],
  };
}
