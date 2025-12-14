import type { DbClient } from "../database/dbClient.js";

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
  const game = await db.oneOrNone<{
    id: string;
    status: string;
    turn_index: number;
    created_by: string;
  }>(
    `
      SELECT id, status, turn_index, created_by
      FROM games
      WHERE id = $1
    `,
    [gameId],
  );
  if (!game) throw new GameNotFoundError(gameId);

  const board: BoardTileState[] = await db.manyOrNone(
    `
      SELECT
        t.id,
        t.position,
        t.name,
        t.tile_type,
        t.property_group,
        t.purchase_price,
        t.rent_base,
        o.participant_id AS owner_participant_id
      FROM tiles t
      LEFT JOIN ownerships o
        ON o.tile_id = t.id
        AND o.game_id = $1
      ORDER BY t.position ASC
    `,
    [gameId],
  );

  const players: PublicPlayerState[] = await db.manyOrNone(
    `
      SELECT
        gp.id,
        gp.user_id,
        u.display_name,
        gp.position,
        gp.cash,
        gp.jail_turns,
        gp.goojf_cards,
        gp.is_bankrupt,
        gp.in_jail,
        gp.token_color
      FROM game_participants gp
      JOIN users u ON u.id = gp.user_id
      WHERE gp.game_id = $1
      ORDER BY gp.joined_at ASC
    `,
    [gameId],
  );

  const recentMoves = await db.manyOrNone<{
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
  }>(
    `
      SELECT
        id AS turn_id,
        participant_id,
        turn_number,
        created_at,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken
      FROM turns
      WHERE game_id = $1
      ORDER BY turn_number DESC
      LIMIT 50
    `,
    [gameId],
  );

  const recentTransactions = await db.manyOrNone<{
    id: string;
    created_at: string | Date;
    turn_id: string | null;
    turn_number: number | null;
    from_participant_id: string | null;
    to_participant_id: string | null;
    amount: number;
    transaction_type: string;
    description: string | null;
  }>(
    `
      SELECT
        tx.id,
        tx.created_at,
        tx.turn_id,
        t.turn_number,
        tx.from_participant_id,
        tx.to_participant_id,
        tx.amount,
        tx.transaction_type,
        tx.description
      FROM transactions tx
      LEFT JOIN turns t ON t.id = tx.turn_id
      WHERE tx.game_id = $1
      ORDER BY tx.created_at DESC
      LIMIT 100
    `,
    [gameId],
  );

  const turnRow = await db.one<{ turn_number: number }>(
    `
      SELECT COALESCE(MAX(turn_number), 0)::int AS turn_number
      FROM turns
      WHERE game_id = $1
    `,
    [gameId],
  );

  const lastRollRow = await db.oneOrNone<{
    participant_id: string;
    turn_number: number;
    dice_roll_1: number | null;
    dice_roll_2: number | null;
    is_double: boolean | null;
    previous_position: number | null;
    new_position: number | null;
    action_taken: string | null;
  }>(
    `
      SELECT
        participant_id,
        turn_number,
        dice_roll_1,
        dice_roll_2,
        is_double,
        previous_position,
        new_position,
        action_taken
      FROM turns
      WHERE game_id = $1
      ORDER BY turn_number DESC
      LIMIT 1
    `,
    [gameId],
  );

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
    turn_number: turnRow.turn_number,
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

  const participant = await db.oneOrNone<{ id: string; cash: number }>(
    `
      SELECT id, cash
      FROM game_participants
      WHERE game_id = $1 AND user_id = $2
    `,
    [gameId, userId],
  );

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
