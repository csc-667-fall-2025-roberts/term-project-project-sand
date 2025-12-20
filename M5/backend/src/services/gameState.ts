import type { DbClient } from "../database/dbClient.js";
import { createGamesRepository } from "../database/repositories/games.js";
import { createGameParticipantsRepository } from "../database/repositories/gameParticipants.js";
import { createTilesRepository } from "../database/repositories/tiles.js";
import { createTransactionsRepository } from "../database/repositories/transactions.js";
import { createTurnsRepository } from "../database/repositories/turns.js";

export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
    this.name = "GameNotFoundError";
  }
}

export class NotParticipantError extends Error {
  constructor() {
    super("Not a participant");
    this.name = "NotParticipantError";
  }
}

export interface PublicPlayerState {
  id: string;
  user_id: string;
  display_name: string;
  position: number;
  cash: number;
  jail_turns: number;
  goojf_cards: number;
  is_bankrupt: boolean;
  in_jail: boolean;
  token_color: string | null;
}

export interface BoardTileState {
  id: string;
  position: number;
  name: string;
  tile_type: string;
  property_group: string | null;
  purchase_price: number | null;
  rent_base: number | null;
  owner_participant_id: string | null;
  houses: number | null;
  hotels: number | null;
  is_mortgaged: boolean | null;
}

export interface GameStateUpdate {
  game_id: string;
  created_by: string;
  board: BoardTileState[];
  players: PublicPlayerState[];
  current_player_id: string | null;
  phase: string;
  turn_number: number;
  last_roll_participant_id: string | null;
  last_roll_turn_number: number | null;
  last_roll_dice_1: number | null;
  last_roll_dice_2: number | null;
  last_roll_is_double: boolean | null;
  last_roll_previous_position: number | null;
  last_roll_new_position: number | null;
  last_roll_action_taken: string | null;
  recent_moves: {
    turn_id: string;
    participant_id: string;
    turn_number: number;
    created_at: string | Date;
    dice_roll_1: number | null;
    dice_roll_2: number | null;
    is_double: boolean | null;
    previous_position: number | null;
    new_position: number | null;
    action_taken: string | null;
  }[];
  recent_transactions: {
    id: string;
    created_at: string | Date;
    turn_id: string | null;
    turn_number: number | null;
    from_participant_id: string | null;
    to_participant_id: string | null;
    amount: number;
    transaction_type: string;
    description: string | null;
  }[];
}

export interface GameStateForUser extends GameStateUpdate {
  self: {
    participant_id: string;
    balance: number;
  };
}

function pickCurrentParticipantId(params: {
  phase: string;
  turnIndex: number;
  participants: { id: string; is_bankrupt: boolean }[];
}): string | null {
  if (params.phase !== "playing") return null;
  const active = params.participants.filter((p) => !p.is_bankrupt);
  if (active.length === 0) return null;
  const idx =
    ((params.turnIndex % active.length) + active.length) % active.length;
  return active[idx]?.id ?? null;
}

export async function buildPublicGameState(
  db: DbClient,
  gameId: string,
): Promise<GameStateUpdate> {
  const gamesRepo = createGamesRepository(db);
  const game = await gamesRepo.findById(gameId);
  if (!game) throw new GameNotFoundError(gameId);

  const tilesRepo = createTilesRepository(db);
  const board: BoardTileState[] = await tilesRepo.listBoardState(gameId);

  const participantsRepo = createGameParticipantsRepository(db);
  const players: PublicPlayerState[] = (
    await participantsRepo.listWithUsersByGame(gameId)
  ).map(({ participant, user }) => ({
    id: participant.id,
    user_id: participant.user_id,
    display_name: user.display_name,
    position: participant.position,
    cash: participant.cash,
    jail_turns: participant.jail_turns,
    goojf_cards: participant.goojf_cards,
    is_bankrupt: participant.is_bankrupt,
    in_jail: participant.in_jail,
    token_color: participant.token_color,
  }));

  const turnsRepo = createTurnsRepository(db);
  const recentMoves = await turnsRepo.listRecentMovesByGame(gameId, 50);

  const transactionsRepo = createTransactionsRepository(db);
  const recentTransactions =
    await transactionsRepo.listRecentByGameWithTurnNumber(gameId, 100);

  const turnNumber = await turnsRepo.lastTurnNumber(gameId);
  const lastRollRow = await turnsRepo.findLastRollByGame(gameId);

  const currentPlayerId = pickCurrentParticipantId({
    phase: game.status,
    turnIndex: game.turn_index,
    participants: players.map((p) => ({
      id: p.id,
      is_bankrupt: p.is_bankrupt,
    })),
  });

  return {
    game_id: gameId,
    created_by: game.created_by,
    board,
    players,
    current_player_id: currentPlayerId,
    phase: game.status,
    turn_number: turnNumber,
    last_roll_participant_id: lastRollRow?.participant_id ?? null,
    last_roll_turn_number: lastRollRow?.turn_number ?? null,
    last_roll_dice_1: lastRollRow?.dice_roll_1 ?? null,
    last_roll_dice_2: lastRollRow?.dice_roll_2 ?? null,
    last_roll_is_double:
      typeof lastRollRow?.is_double === "boolean"
        ? lastRollRow.is_double
        : null,
    last_roll_previous_position: lastRollRow?.previous_position ?? null,
    last_roll_new_position: lastRollRow?.new_position ?? null,
    last_roll_action_taken: lastRollRow?.action_taken ?? null,
    recent_moves: recentMoves,
    recent_transactions: recentTransactions,
  };
}

export async function buildGameStateForUser(
  db: DbClient,
  gameId: string,
  userId: string,
): Promise<GameStateForUser> {
  const state = await buildPublicGameState(db, gameId);

  const participantsRepo = createGameParticipantsRepository(db);
  const participant = await participantsRepo.findByGameAndUser(gameId, userId);

  if (!participant) {
    throw new NotParticipantError();
  }

  return {
    ...state,
    self: {
      participant_id: participant.id,
      balance: participant.cash,
    },
  };
}
