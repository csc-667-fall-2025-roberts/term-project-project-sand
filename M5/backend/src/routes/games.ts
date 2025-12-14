import { randomBytes, randomInt } from "crypto";
import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import logger from "../logger.js";
import { pgPool } from "../database/index.js";
import { ensureReferenceDataSeeded } from "../services/seedData.js";
import {
  emitGameEnded,
  emitGameStateUpdate,
  emitPlayerJoined,
  emitPrivateBalanceUpdate,
  emitPrivateOptions,
  emitTurnChanged,
} from "../realtime/gateway.js";
import {
  buildGameStateForUser,
  GameNotFoundError,
  NotParticipantError,
  buildPublicGameState,
} from "../services/gameState.js";
import { buildOptionsPayloadFromPendingAction } from "../services/pendingActionOptions.js";

interface CreateGameBody {
  max_players?: number;
  starting_balance?: number;
  name?: string;
  token_color?: string;
}

interface JoinGameBody {
  token_color?: string;
}

interface JoinByCodeBody {
  game_code?: string;
  token_color?: string;
}

interface BuyPropertyBody {
  pending_action_id?: string;
}

interface PayRentBody {
  pending_action_id?: string;
}

interface PayDebtBody {
  pending_action_id?: string;
}

interface RollTurnBody {
  pay_to_leave_jail?: boolean;
  use_goojf?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pgErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const code = error["code"];
  return typeof code === "string" ? code : null;
}

function pgConstraint(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const constraint = error["constraint"];
  return typeof constraint === "string" ? constraint : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

function requireParam(
  req: AuthenticatedRequest,
  res: Response,
  name: string,
): string | null {
  const params = req.params as Record<string, string | undefined>;
  const value = params[name];
  if (typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: `${name} is required` });
    return null;
  }
  return value;
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function generateGameCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function computeRent(tile: {
  rent_base: number | null;
  purchase_price: number | null;
}): number {
  if (tile.rent_base != null) return tile.rent_base;
  if (tile.purchase_price != null)
    return Math.max(1, Math.floor(tile.purchase_price / 10));
  return 0;
}

function taxForTileName(name: string): number {
  if (name.toLowerCase().includes("income")) return 200;
  if (name.toLowerCase().includes("luxury")) return 100;
  return 100;
}

async function participantHasAnyProperties(
  t: typeof pgPool,
  gameId: string,
  participantId: string,
): Promise<boolean> {
  const row = await t.one<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM ownerships
      WHERE game_id = $1 AND participant_id = $2
    `,
    [gameId, participantId],
  );
  return row.count > 0;
}

async function declareBankruptToBank(
  t: typeof pgPool,
  params: {
    gameId: string;
    participantId: string;
    reason: string;
    turnId: string | null;
  },
): Promise<void> {
  const row = await t.oneOrNone<{ cash: number; goojf_cards: number }>(
    `
      SELECT cash, goojf_cards
      FROM game_participants
      WHERE id = $1 AND game_id = $2
      FOR UPDATE
    `,
    [params.participantId, params.gameId],
  );
  if (!row) return;

  const paid = Math.max(0, row.cash);

  // Clear participant state.
  await t.none(
    `
      UPDATE game_participants
      SET
        is_bankrupt = true,
        cash = 0,
        in_jail = false,
        jail_turns = 0,
        goojf_cards = 0,
        updated_at = now()
      WHERE id = $1
    `,
    [params.participantId],
  );

  // Return properties to the bank.
  await t.none(
    "DELETE FROM ownerships WHERE game_id = $1 AND participant_id = $2",
    [params.gameId, params.participantId],
  );

  // Record the bankruptcy as a transaction for the log.
  await t.none(
    `
      INSERT INTO transactions (
        game_id,
        from_participant_id,
        to_participant_id,
        amount,
        transaction_type,
        description,
        turn_id
      )
      VALUES ($1, $2, NULL, $3, 'bankruptcy', $4, $5)
    `,
    [params.gameId, params.participantId, paid, params.reason, params.turnId],
  );
}

async function maybeEndGameIfWinner(
  t: typeof pgPool,
  gameId: string,
): Promise<{ ended: boolean; winnerParticipantId: string | null }> {
  const game = await t.oneOrNone<{ status: string }>(
    "SELECT status FROM games WHERE id = $1 FOR UPDATE",
    [gameId],
  );
  if (!game) return { ended: false, winnerParticipantId: null };
  if (game.status !== "playing") {
    return { ended: false, winnerParticipantId: null };
  }

  const alive = await t.manyOrNone<{ id: string }>(
    `
      SELECT id
      FROM game_participants
      WHERE game_id = $1 AND is_bankrupt = false
      ORDER BY joined_at ASC
    `,
    [gameId],
  );

  if (alive.length !== 1) return { ended: false, winnerParticipantId: null };

  await t.none(
    "UPDATE games SET status = 'ended', updated_at = now() WHERE id = $1",
    [gameId],
  );

  const winner = alive[0];
  return { ended: true, winnerParticipantId: winner?.id ?? null };
}

async function computeCurrentTurnPlayer(
  t: typeof pgPool,
  gameId: string,
): Promise<{ participantId: string; userId: string } | null> {
  const game = await t.oneOrNone<{ turn_index: number; status: string }>(
    "SELECT turn_index, status FROM games WHERE id = $1",
    [gameId],
  );
  if (!game || game.status !== "playing") return null;

  const active = await t.manyOrNone<{ id: string; user_id: string }>(
    `
      SELECT id, user_id
      FROM game_participants
      WHERE game_id = $1 AND is_bankrupt = false
      ORDER BY joined_at ASC
    `,
    [gameId],
  );
  if (active.length === 0) return null;

  const idx =
    ((game.turn_index % active.length) + active.length) % active.length;
  const row = active[idx];
  return row ? { participantId: row.id, userId: row.user_id } : null;
}

function normalizeTokenColor(value: string): string {
  return value.trim().toLowerCase();
}

const AUTO_TOKEN_COLORS = ["red", "blue", "green", "yellow", "purple", "black"];

function parseTokenColor(value: string): string | null {
  const normalized = normalizeTokenColor(value);
  return AUTO_TOKEN_COLORS.includes(normalized) ? normalized : null;
}

async function pickAvailableTokenColor(
  t: typeof pgPool,
  gameId: string,
): Promise<string | null> {
  const rows = await t.manyOrNone<{ token_color: string | null }>(
    `
      SELECT token_color
      FROM game_participants
      WHERE game_id = $1
    `,
    [gameId],
  );

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

async function joinGameTx(
  t: typeof pgPool,
  params: {
    gameId: string;
    userId: string;
    tokenColor: string;
  },
): Promise<JoinGameTxResult> {
  const game = await t.oneOrNone(
    `
      SELECT id, status, max_players, starting_balance
      FROM games
      WHERE id = $1
      FOR UPDATE
    `,
    [params.gameId],
  );

  if (!game) return { kind: "not_found" };
  if (game.status !== "waiting") return { kind: "bad_phase" };

  const existing = await t.oneOrNone(
    `
      SELECT id, token_color
      FROM game_participants
      WHERE game_id = $1 AND user_id = $2
    `,
    [params.gameId, params.userId],
  );

  if (existing)
    return {
      kind: "already_joined",
      participantId: existing.id as string,
      tokenColor: (existing.token_color as string | null) ?? null,
    };

  const tokenColor = parseTokenColor(params.tokenColor);
  if (!tokenColor) return { kind: "invalid_color" };

  const countRow = await t.one(
    "SELECT COUNT(*)::int AS count FROM game_participants WHERE game_id = $1",
    [params.gameId],
  );
  const playerCount = countRow.count as number;
  if (playerCount >= (game.max_players as number)) {
    return { kind: "full" };
  }

  const colorTaken = await t.oneOrNone(
    `
      SELECT 1
      FROM game_participants
      WHERE game_id = $1 AND lower(token_color) = lower($2)
      LIMIT 1
    `,
    [params.gameId, tokenColor],
  );

  if (colorTaken) return { kind: "color_taken" };

  const participant = await t.one<{
    id: string;
    token_color: string | null;
  }>(
    `
      INSERT INTO game_participants (game_id, user_id, cash, token_color)
      VALUES ($1, $2, $3, $4)
      RETURNING id, token_color
    `,
    [params.gameId, params.userId, game.starting_balance as number, tokenColor],
  );

  const publicState = await buildPublicGameState(t, params.gameId);

  return {
    kind: "ok",
    participant,
    publicState,
    maxPlayers: game.max_players as number,
  };
}

export const gamesRouter = Router()
  .delete("/games/:gameId", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    try {
      const result = await pgPool.tx(async (t) => {
        const game = await t.oneOrNone<{ id: string; created_by: string }>(
          "SELECT id, created_by FROM games WHERE id = $1 FOR UPDATE",
          [gameId],
        );
        if (!game) return { kind: "not_found" as const };
        if (game.created_by !== userId) return { kind: "forbidden" as const };

        await t.none("DELETE FROM games WHERE id = $1", [gameId]);
        return { kind: "ok" as const };
      });

      if (result.kind === "not_found") {
        return res.status(404).json({ error: "Game not found" });
      }
      if (result.kind === "forbidden") {
        return res
          .status(403)
          .json({ error: "Only the creator can delete the game" });
      }

      emitGameEnded(gameId, { game_id: gameId, deleted: true });
      return res.status(204).send();
    } catch (error) {
      logger.error("delete_game_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .get("/games", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    try {
      const games = await pgPool.manyOrNone<{
        id: string;
        name: string;
        game_code: string;
        status: string;
        max_players: number;
        created_at: Date;
        current_players: number;
        is_participant: boolean;
        participant_id: string | null;
      }>(
        `
          SELECT
            g.id,
            g.name,
            g.game_code,
            g.status,
            g.max_players,
            g.created_at,
            COUNT(gp.id)::int AS current_players,
            (mygp.id IS NOT NULL) AS is_participant,
            mygp.id AS participant_id
          FROM games g
          LEFT JOIN game_participants gp ON gp.game_id = g.id
          LEFT JOIN game_participants mygp
            ON mygp.game_id = g.id
           AND mygp.user_id = $1
          GROUP BY g.id, mygp.id
          ORDER BY g.created_at DESC
        `,
        [userId],
      );

      return res.json({ games });
    } catch (error) {
      logger.error("list_games_failed", { error, user_id: userId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/:gameId/join-auto", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    try {
      const result = await pgPool.tx(async (t) => {
        // If already joined, joinGameTx will return already_joined (even if full).
        // Otherwise, pick an available color.
        const existing = await t.oneOrNone<{ token_color: string | null }>(
          `
            SELECT token_color
            FROM game_participants
            WHERE game_id = $1 AND user_id = $2
          `,
          [gameId, userId],
        );

        if (existing) {
          return joinGameTx(t as unknown as typeof pgPool, {
            gameId,
            userId,
            tokenColor: existing.token_color
              ? normalizeTokenColor(existing.token_color)
              : "red",
          });
        }

        const tokenColor = await pickAvailableTokenColor(
          t as unknown as typeof pgPool,
          gameId,
        );

        if (!tokenColor) {
          return { kind: "no_colors" as const };
        }

        return joinGameTx(t as unknown as typeof pgPool, {
          gameId,
          userId,
          tokenColor,
        });
      });

      if (result.kind === "no_colors") {
        return res
          .status(409)
          .json({ error: "No available token colors for this game" });
      }

      if (result.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (result.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not joinable" });
      if (result.kind === "already_joined") {
        return res.status(202).json({ participant_id: result.participantId });
      }
      if (result.kind === "invalid_color") {
        return res.status(400).json({ error: "token_color is invalid" });
      }
      if (result.kind === "full")
        return res.status(409).json({ error: "Game is full" });
      if (result.kind === "color_taken")
        return res.status(409).json({ error: "token_color already taken" });

      emitPlayerJoined(gameId, {
        game_id: gameId,
        player: {
          id: result.participant.id,
          username: req.user?.displayName ?? "Player",
          token_color: result.participant.token_color,
        },
        player_count: result.publicState.players.length,
        max_players: result.maxPlayers,
      });

      emitGameStateUpdate(gameId, result.publicState);

      return res.status(202).json({
        participant_id: result.participant.id,
        token_color: result.participant.token_color,
      });
    } catch (error) {
      logger.error("join_auto_failed", {
        error,
        user_id: userId,
        game_id: gameId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const body = (req.body ?? {}) as CreateGameBody;
    const maxPlayersRaw = parseIntOrNull(body.max_players);
    const startingBalanceRaw = parseIntOrNull(body.starting_balance);

    const maxPlayers = maxPlayersRaw ?? 4;
    const startingBalance = startingBalanceRaw ?? 1500;

    if (maxPlayers < 2 || maxPlayers > 6) {
      return res
        .status(400)
        .json({ error: "max_players must be between 2 and 6" });
    }

    if (startingBalance <= 0 || startingBalance > 1_000_000) {
      return res
        .status(400)
        .json({ error: "starting_balance must be a positive integer" });
    }

    const tokenColorRaw = body.token_color?.trim();
    const tokenColor = tokenColorRaw ? parseTokenColor(tokenColorRaw) : "red";
    if (!tokenColor) {
      return res.status(400).json({ error: "token_color is invalid" });
    }

    try {
      const result = await pgPool.tx(async (t) => {
        await ensureReferenceDataSeeded(t);

        // Retry game code on unique conflict.
        interface CreatedGameRow {
          id: string;
          name: string;
          game_code: string;
          max_players: number;
          starting_balance: number;
          status: string;
          created_by: string;
        }

        let gameRow: CreatedGameRow | null = null;
        let gameCode = "";

        for (let attempt = 0; attempt < 5; attempt += 1) {
          gameCode = generateGameCode();
          const name = body.name?.trim() || `Game ${gameCode}`;

          try {
            gameRow = await t.one<CreatedGameRow>(
              `
                INSERT INTO games (
                  name,
                  created_by,
                  game_code,
                  status,
                  game_type,
                  max_players,
                  turn_index,
                  starting_balance
                )
                VALUES ($1, $2, $3, 'waiting', 'monopoly_sf', $4, 0, $5)
                RETURNING id, name, game_code, max_players, starting_balance, status, created_by
              `,
              [name, userId, gameCode, maxPlayers, startingBalance],
            );
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

        if (!gameRow) throw new Error("Failed to generate unique game code");

        const participant = await t.one<{
          id: string;
          game_id: string;
          user_id: string;
          cash: number;
          token_color: string | null;
        }>(
          `
            INSERT INTO game_participants (game_id, user_id, cash, token_color)
            VALUES ($1, $2, $3, $4)
            RETURNING id, game_id, user_id, cash, token_color
          `,
          [gameRow.id, userId, startingBalance, tokenColor],
        );

        await t.none(
          `
            INSERT INTO card_decks (game_id, deck_type)
            VALUES ($1, 'chance'), ($1, 'community_chest')
            ON CONFLICT (game_id, deck_type) DO NOTHING
          `,
          [gameRow.id],
        );

        const publicState = await buildPublicGameState(t, gameRow.id as string);

        return {
          game: gameRow,
          participant,
          publicState,
        };
      });

      emitPlayerJoined(result.game.id as string, {
        game_id: result.game.id,
        player: {
          id: result.participant.id,
          username: req.user?.displayName ?? "Player",
          token_color: result.participant.token_color,
        },
        player_count: result.publicState.players.length,
        max_players: result.game.max_players,
      });

      emitGameStateUpdate(result.game.id as string, result.publicState);

      return res.status(202).json({
        game_id: result.game.id,
        game_code: result.game.game_code,
        participant_id: result.participant.id,
      });
    } catch (error) {
      logger.error("create_game_failed", { error });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/join-by-code", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const body = (req.body ?? {}) as JoinByCodeBody;
    const gameCode = body.game_code?.trim().toUpperCase();
    const tokenColorRaw = body.token_color?.trim();
    const tokenColor = tokenColorRaw ? parseTokenColor(tokenColorRaw) : null;

    if (!gameCode) {
      return res.status(400).json({ error: "game_code is required" });
    }
    if (!tokenColor) {
      return res.status(400).json({ error: "token_color is invalid" });
    }

    try {
      const gameRow = await pgPool.oneOrNone<{ id: string }>(
        "SELECT id FROM games WHERE game_code = $1",
        [gameCode],
      );

      if (!gameRow) {
        return res.status(404).json({ error: "Game not found" });
      }

      const result = await pgPool.tx(async (t) => {
        return joinGameTx(t as unknown as typeof pgPool, {
          gameId: gameRow.id,
          userId,
          tokenColor,
        });
      });

      if (result.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (result.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not joinable" });
      if (result.kind === "invalid_color")
        return res.status(400).json({ error: "token_color is invalid" });
      if (result.kind === "already_joined") {
        const requested = tokenColor;
        const existing = result.tokenColor;
        if (
          existing &&
          requested &&
          normalizeTokenColor(existing) !== normalizeTokenColor(requested)
        ) {
          return res
            .status(409)
            .json({ error: "Already joined with a different token_color" });
        }
        return res.status(202).json({
          game_id: gameRow.id,
          participant_id: result.participantId,
        });
      }
      if (result.kind === "full")
        return res.status(409).json({ error: "Game is full" });
      if (result.kind === "color_taken")
        return res.status(409).json({ error: "token_color already taken" });

      emitPlayerJoined(gameRow.id, {
        game_id: gameRow.id,
        player: {
          id: result.participant.id,
          username: req.user?.displayName ?? "Player",
          token_color: result.participant.token_color,
        },
        player_count: result.publicState.players.length,
        max_players: result.maxPlayers,
      });

      emitGameStateUpdate(gameRow.id, result.publicState);

      return res.status(202).json({
        game_id: gameRow.id,
        participant_id: result.participant.id,
      });
    } catch (error) {
      logger.error("join_by_code_failed", { error, user_id: userId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/:gameId/join", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;
    const body = (req.body ?? {}) as JoinGameBody;
    const tokenColorRaw = body.token_color?.trim();
    const tokenColor = tokenColorRaw ? parseTokenColor(tokenColorRaw) : null;

    if (!tokenColor) {
      return res.status(400).json({ error: "token_color is invalid" });
    }

    try {
      const result = await pgPool.tx(async (t) => {
        return joinGameTx(t as unknown as typeof pgPool, {
          gameId,
          userId,
          tokenColor,
        });
      });

      if (result.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (result.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not joinable" });
      if (result.kind === "invalid_color")
        return res.status(400).json({ error: "token_color is invalid" });
      if (result.kind === "already_joined") {
        const requested = tokenColor;
        const existing = result.tokenColor;
        if (
          existing &&
          requested &&
          normalizeTokenColor(existing) !== normalizeTokenColor(requested)
        ) {
          return res
            .status(409)
            .json({ error: "Already joined with a different token_color" });
        }
        return res.status(202).json({ participant_id: result.participantId });
      }
      if (result.kind === "full")
        return res.status(409).json({ error: "Game is full" });
      if (result.kind === "color_taken")
        return res.status(409).json({ error: "token_color already taken" });

      emitPlayerJoined(gameId, {
        game_id: gameId,
        player: {
          id: result.participant.id,
          username: req.user?.displayName ?? "Player",
          token_color: result.participant.token_color,
        },
        player_count: result.publicState.players.length,
        max_players: result.maxPlayers,
      });

      emitGameStateUpdate(gameId, result.publicState);

      return res.status(202).json({ participant_id: result.participant.id });
    } catch (error) {
      logger.error("join_game_failed", { error, game_id: gameId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/:gameId/start", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    void req.body;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    try {
      const result = await pgPool.tx(async (t) => {
        const game = await t.oneOrNone(
          `
            SELECT id, status, created_by, max_players, turn_index
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [gameId],
        );
        if (!game) return { kind: "not_found" as const };
        if (game.status !== "waiting") return { kind: "bad_phase" as const };
        if ((game.created_by as string) !== userId)
          return { kind: "forbidden" as const };

        const players = await t.manyOrNone(
          `
            SELECT id, user_id, is_bankrupt
            FROM game_participants
            WHERE game_id = $1
            ORDER BY joined_at ASC
          `,
          [gameId],
        );

        if (players.length < 2) return { kind: "not_enough_players" as const };

        await t.none(
          `
            UPDATE games
            SET status = 'playing', started_at = now(), turn_index = 0, updated_at = now()
            WHERE id = $1
          `,
          [gameId],
        );

        const publicState = await buildPublicGameState(t, gameId);
        const currentParticipantId = publicState.current_player_id;

        const currentPlayer = players.find(
          (p) => p.id === currentParticipantId,
        );
        const currentUserId = currentPlayer?.user_id as string | undefined;

        return {
          kind: "ok" as const,
          publicState,
          currentParticipantId,
          currentUserId,
        };
      });

      if (result.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (result.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not startable" });
      if (result.kind === "forbidden")
        return res
          .status(403)
          .json({ error: "Only the creator can start the game" });
      if (result.kind === "not_enough_players")
        return res
          .status(409)
          .json({ error: "Need at least 2 players to start" });

      emitGameStateUpdate(gameId, result.publicState);

      emitTurnChanged(gameId, {
        game_id: gameId,
        previous_player_id: null,
        current_player_id: result.currentParticipantId,
        turn_number: result.publicState.turn_number,
      });

      if (result.currentUserId) {
        emitPrivateOptions(result.currentUserId, {
          game_id: gameId,
          player_id: result.currentParticipantId,
          context: "start_turn",
          options: [{ action: "roll_dice" }],
        });
      }

      return res.status(202).json({ ok: true });
    } catch (error) {
      logger.error("start_game_failed", { error, game_id: gameId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .get("/games/:gameId/state", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    try {
      const state = await buildGameStateForUser(pgPool, gameId, userId);
      return res.json(state);
    } catch (error: unknown) {
      if (error instanceof GameNotFoundError) {
        return res.status(404).json({ error: "Game not found" });
      }
      if (error instanceof NotParticipantError) {
        return res.status(403).json({ error: "Not a participant" });
      }
      logger.error("get_game_state_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/:gameId/turn/roll", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    const rollBody = (req.body ?? {}) as RollTurnBody;
    const payToLeaveJail = Boolean(rollBody.pay_to_leave_jail);
    const useGoojf = Boolean(rollBody.use_goojf);
    if (payToLeaveJail && useGoojf) {
      return res.status(400).json({
        error: "pay_to_leave_jail and use_goojf cannot both be true",
      });
    }

    try {
      const output = await pgPool.tx(async (t) => {
        const game = await t.oneOrNone(
          `
            SELECT id, status, turn_index
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [gameId],
        );
        if (!game) return { kind: "not_found" as const };
        if (game.status !== "playing") return { kind: "bad_phase" as const };

        const participants = await t.manyOrNone(
          `
            SELECT id, user_id, cash, position, in_jail, jail_turns, goojf_cards, is_bankrupt
            FROM game_participants
            WHERE game_id = $1
            ORDER BY joined_at ASC
            FOR UPDATE
          `,
          [gameId],
        );

        const active = participants.filter((p) => !p.is_bankrupt);
        if (active.length === 0) return { kind: "bad_state" as const };

        const turnIndex = (game.turn_index as number) % active.length;
        const current = active[turnIndex];
        if (!current) return { kind: "bad_state" as const };

        if ((current.user_id as string) !== userId) {
          return { kind: "not_your_turn" as const };
        }

        const pending = await t.oneOrNone(
          `
            SELECT id
            FROM pending_actions
            WHERE game_id = $1 AND participant_id = $2 AND status = 'pending'
            LIMIT 1
          `,
          [gameId, current.id],
        );

        if (pending) {
          return { kind: "has_pending" as const };
        }

        const die1 = randomInt(1, 7);
        const die2 = randomInt(1, 7);
        const total = die1 + die2;
        const isDouble = die1 === die2;
        const messages: string[] = [];
        const actionNotes: string[] = [];

        const prevPos = current.position as number;
        let newPos = (prevPos + total) % 40;

        const inJailBefore =
          isRecord(current) && typeof current["in_jail"] === "boolean"
            ? Boolean(current["in_jail"])
            : false;

        const jailTurns =
          isRecord(current) && typeof current["jail_turns"] === "number"
            ? Math.max(0, Math.trunc(current["jail_turns"]))
            : 0;

        const goojfCards =
          isRecord(current) && typeof current["goojf_cards"] === "number"
            ? Math.max(0, Math.trunc(current["goojf_cards"]))
            : 0;

        let jailFee = 0;
        let usedGoojf = false;

        if (inJailBefore) {
          if (useGoojf) {
            if (goojfCards <= 0) {
              return { kind: "no_goojf" as const };
            }
            usedGoojf = true;
            await t.none(
              `
                UPDATE game_participants
                SET goojf_cards = GREATEST(goojf_cards - 1, 0),
                    in_jail = false,
                    jail_turns = 0,
                    updated_at = now()
                WHERE id = $1
              `,
              [current.id],
            );
            const note = "Used Get Out of Jail Free.";
            messages.push(note);
            actionNotes.push(note);
          } else if (payToLeaveJail) {
            if ((current.cash as number) < 50) {
              return { kind: "insufficient_jail_fee" as const };
            }

            jailFee = 50;
            await t.none(
              `
                UPDATE game_participants
                SET cash = cash - 50,
                    in_jail = false,
                    jail_turns = 0,
                    updated_at = now()
                WHERE id = $1
              `,
              [current.id],
            );
            const note = "Paid $50 to leave jail.";
            messages.push(note);
            actionNotes.push(note);
          }
        }

        const inJailStill =
          inJailBefore && !payToLeaveJail && !(useGoojf && usedGoojf);

        if (inJailStill && !isDouble && jailTurns < 2) {
          // Jail: first/second attempt. Roll doubles to leave; otherwise stay and increment jail_turns.
          messages.push(`You rolled ${die1} and ${die2} (${total}).`);
          messages.push("No doubles. You remain in jail.");

          await t.none(
            `
              UPDATE game_participants
              SET jail_turns = jail_turns + 1, updated_at = now()
              WHERE id = $1
            `,
            [current.id],
          );

          const nextTurnNumberRow = await t.one(
            `
              SELECT (COALESCE(MAX(turn_number), 0) + 1)::int AS next
              FROM turns
              WHERE game_id = $1
            `,
            [gameId],
          );
          const turnNumber = nextTurnNumberRow.next as number;

          const turn = await t.one<{ id: string }>(
            `
              INSERT INTO turns (
                game_id,
                participant_id,
                turn_number,
                dice_roll_1,
                dice_roll_2,
                is_double,
                previous_position,
                new_position,
                action_taken
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id
            `,
            [
              gameId,
              current.id,
              turnNumber,
              die1,
              die2,
              isDouble,
              prevPos,
              newPos,
              `In jail (${jailTurns + 1}/3)`,
            ],
          );

          void turn;

          const publicState = await buildPublicGameState(t, gameId);

          const balanceRow = await t.one(
            "SELECT cash FROM game_participants WHERE id = $1",
            [current.id],
          );

          return {
            kind: "ok" as const,
            dice: [die1, die2] as [number, number],
            previous_position: prevPos,
            new_position: newPos,
            participant_id: current.id as string,
            user_id: userId,
            balance: balanceRow.cash as number,
            publicState,
            optionsPayload: null,
            pendingAction: null,
            messages,
            ended: false,
            winnerParticipantId: null,
            bankruptTurnAdvanced: false,
            nextTurn: null,
          };
        }

        if (inJailStill && isDouble) {
          messages.push(`You rolled ${die1} and ${die2} (${total}).`);
          messages.push("Doubles! You are released from jail.");
          actionNotes.push("Released from jail (doubles).");
          await t.none(
            "UPDATE game_participants SET in_jail = false, jail_turns = 0, updated_at = now() WHERE id = $1",
            [current.id],
          );
        }

        if (inJailStill && !isDouble && jailTurns >= 2) {
          // Third failed attempt: must pay $50, then move with this roll.
          messages.push(`You rolled ${die1} and ${die2} (${total}).`);
          messages.push("No doubles on your third attempt. You must pay $50.");
          if ((current.cash as number) < 50) {
            const note =
              "Bankrupt: unable to pay $50 after third jail attempt.";
            messages.push(note);
            actionNotes.push(note);

            const nextTurnNumberRow = await t.one(
              `
                SELECT (COALESCE(MAX(turn_number), 0) + 1)::int AS next
                FROM turns
                WHERE game_id = $1
              `,
              [gameId],
            );
            const turnNumber = nextTurnNumberRow.next as number;
            const turn = await t.one<{ id: string }>(
              `
                INSERT INTO turns (
                  game_id,
                  participant_id,
                  turn_number,
                  dice_roll_1,
                  dice_roll_2,
                  is_double,
                  previous_position,
                  new_position,
                  action_taken
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
              `,
              [
                gameId,
                current.id,
                turnNumber,
                die1,
                die2,
                isDouble,
                prevPos,
                prevPos,
                note,
              ],
            );

            await declareBankruptToBank(t as unknown as typeof pgPool, {
              gameId,
              participantId: current.id as string,
              reason: "Unable to pay $50 after third jail attempt",
              turnId: turn.id,
            });

            const end = await maybeEndGameIfWinner(
              t as unknown as typeof pgPool,
              gameId,
            );
            const publicState = await buildPublicGameState(t, gameId);

            const nextTurn =
              end.ended === true
                ? null
                : await computeCurrentTurnPlayer(
                    t as unknown as typeof pgPool,
                    gameId,
                  );
            return {
              kind: "ok" as const,
              dice: [die1, die2] as [number, number],
              previous_position: prevPos,
              new_position: prevPos,
              participant_id: current.id as string,
              user_id: userId,
              balance: 0,
              publicState,
              optionsPayload: null,
              pendingAction: null,
              messages,
              ended: end.ended,
              winnerParticipantId: end.winnerParticipantId,
              bankruptTurnAdvanced: true,
              nextTurn,
            };
          }

          jailFee = 50;
          await t.none(
            `
              UPDATE game_participants
              SET cash = cash - 50,
                  in_jail = false,
                  jail_turns = 0,
                  updated_at = now()
              WHERE id = $1
            `,
            [current.id],
          );
          actionNotes.push("Paid $50 to leave jail (3rd attempt).");
        }

        const passedGoByRoll = prevPos + total >= 40;
        let cashDelta = 0;
        if (passedGoByRoll) {
          // You only miss collecting GO if you stayed in jail (handled by early return above).
          cashDelta += 200;
        }

        if (cashDelta !== 0) {
          await t.none(
            "UPDATE game_participants SET cash = cash + $2, updated_at = now() WHERE id = $1",
            [current.id, cashDelta],
          );
        }

        // Apply tile movement.
        await t.none(
          "UPDATE game_participants SET position = $2, updated_at = now() WHERE id = $1",
          [current.id, newPos],
        );

        const nextTurnNumberRow = await t.one(
          `
            SELECT (COALESCE(MAX(turn_number), 0) + 1)::int AS next
            FROM turns
            WHERE game_id = $1
          `,
          [gameId],
        );
        const turnNumber = nextTurnNumberRow.next as number;

        const turn = await t.one<{ id: string }>(
          `
            INSERT INTO turns (game_id, participant_id, turn_number, dice_roll_1, dice_roll_2, is_double, previous_position, new_position, action_taken)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `,
          [
            gameId,
            current.id,
            turnNumber,
            die1,
            die2,
            isDouble,
            prevPos,
            newPos,
            null,
          ],
        );

        if (jailFee !== 0) {
          await t.none(
            `
              INSERT INTO transactions (
                game_id,
                from_participant_id,
                to_participant_id,
                amount,
                transaction_type,
                description,
                turn_id
              )
              VALUES ($1, $2, NULL, $3, 'jail_fee', $4, $5)
            `,
            [
              gameId,
              current.id,
              jailFee,
              "Paid $50 to get out of jail",
              turn.id,
            ],
          );
        }

        if (cashDelta !== 0) {
          await t.none(
            `
              INSERT INTO transactions (
                game_id,
                from_participant_id,
                to_participant_id,
                amount,
                transaction_type,
                description,
                turn_id
              )
              VALUES ($1, NULL, $2, $3, 'pass_go', 'Passed GO', $4)
            `,
            [gameId, current.id, cashDelta, turn.id],
          );
        }

        let pendingAction: {
          id: string;
          type: string;
          tile_id?: string;
          amount?: number;
        } | null = null;
        let optionsPayload: unknown | null = null;

        if (messages.length === 0) {
          messages.push(`You rolled ${die1} and ${die2} (${total}).`);
        }

        const tile = await t.one(
          "SELECT id, name, tile_type, purchase_price, rent_base FROM tiles WHERE position = $1",
          [newPos],
        );

        // Chance / Chest
        if (
          tile.tile_type === "chance" ||
          tile.tile_type === "community_chest"
        ) {
          const deckType =
            tile.tile_type === "chance" ? "chance" : "community_chest";

          const deck = await t.one(
            "SELECT id, current_index FROM card_decks WHERE game_id = $1 AND deck_type = $2 FOR UPDATE",
            [gameId, deckType],
          );

          const cardsCountRow = await t.one(
            "SELECT COUNT(*)::int AS count FROM cards WHERE deck_type = $1",
            [deckType],
          );
          const cardsCount = cardsCountRow.count as number;
          if (cardsCount > 0) {
            const cardOrder = ((deck.current_index as number) % cardsCount) + 1;
            const card = await t.one(
              "SELECT id, message, action_type, action_value FROM cards WHERE deck_type = $1 AND card_order = $2",
              [deckType, cardOrder],
            );

            await t.none(
              "UPDATE card_decks SET current_index = $2 WHERE id = $1",
              [deck.id, (deck.current_index as number) + 1],
            );

            await t.none(
              `
                INSERT INTO card_draws (game_id, card_deck_id, card_id, participant_id, turn_id)
                VALUES ($1, $2, $3, $4, $5)
              `,
              [gameId, deck.id, card.id, current.id, turn.id],
            );

            const cardLine = `${
              deckType === "chance" ? "Chance" : "Community Chest"
            }: ${String(card.message ?? "")}`;
            messages.push(cardLine);
            actionNotes.push(cardLine);

            const actionType = card.action_type as string;
            const actionValue = card.action_value as string | null;
            let actionPayload: unknown = null;
            if (actionValue) {
              try {
                actionPayload = JSON.parse(actionValue) as unknown;
              } catch (_error) {
                actionPayload = null;
              }
            }

            const payloadAmount = isRecord(actionPayload)
              ? toFiniteNumber(actionPayload["amount"])
              : null;

            if (actionType === "collect" && payloadAmount != null) {
              const amount = payloadAmount;
              if (Number.isFinite(amount) && amount > 0) {
                await t.none(
                  "UPDATE game_participants SET cash = cash + $2, updated_at = now() WHERE id = $1",
                  [current.id, amount],
                );
                await t.none(
                  `
                    INSERT INTO transactions (game_id, from_participant_id, to_participant_id, amount, transaction_type, description, turn_id)
                    VALUES ($1, NULL, $2, $3, 'card', $4, $5)
                  `,
                  [gameId, current.id, amount, card.message, turn.id],
                );
              }
            }

            if (actionType === "pay" && payloadAmount != null) {
              const amount = payloadAmount;
              if (Number.isFinite(amount) && amount > 0) {
                const cashRow = await t.one<{ cash: number }>(
                  "SELECT cash FROM game_participants WHERE id = $1 FOR UPDATE",
                  [current.id],
                );
                if (cashRow.cash < amount) {
                  const pa = await t.one<{ id: string }>(
                    `
                      INSERT INTO pending_actions (game_id, participant_id, action_type, payload_json)
                      VALUES ($1, $2, 'pay_bank_debt', $3)
                      RETURNING id
                    `,
                    [
                      gameId,
                      current.id,
                      {
                        amount,
                        transaction_type: "card",
                        description: card.message,
                        turn_id: turn.id,
                      },
                    ],
                  );

                  pendingAction = {
                    id: pa.id,
                    type: "pay_bank_debt",
                    amount,
                  };
                  optionsPayload = await buildOptionsPayloadFromPendingAction(
                    t,
                    {
                      gameId,
                      participantId: current.id as string,
                      pendingAction: {
                        id: pa.id,
                        action_type: "pay_bank_debt",
                        payload_json: {
                          amount,
                          description: card.message,
                        },
                      },
                      context: "pay_bank_debt",
                    },
                  );

                  messages.push(
                    `Card payment due: $${amount}. Sell properties, then pay.`,
                  );
                  actionNotes.push(
                    `Card debt pending: $${amount}. ${String(card.message ?? "")}`,
                  );

                  // Stop processing further roll effects; player must resolve debt.
                  const end = await maybeEndGameIfWinner(
                    t as unknown as typeof pgPool,
                    gameId,
                  );
                  const publicState = await buildPublicGameState(t, gameId);
                  return {
                    kind: "ok" as const,
                    dice: [die1, die2] as [number, number],
                    previous_position: prevPos,
                    new_position: newPos,
                    participant_id: current.id as string,
                    user_id: userId,
                    balance: cashRow.cash,
                    publicState,
                    optionsPayload,
                    pendingAction,
                    messages,
                    ended: end.ended,
                    winnerParticipantId: end.winnerParticipantId,
                    bankruptTurnAdvanced: false,
                    nextTurn: null,
                  };
                }

                await t.none(
                  "UPDATE game_participants SET cash = cash - $2, updated_at = now() WHERE id = $1",
                  [current.id, amount],
                );
                await t.none(
                  `
                    INSERT INTO transactions (game_id, from_participant_id, to_participant_id, amount, transaction_type, description, turn_id)
                    VALUES ($1, $2, NULL, $3, 'card', $4, $5)
                  `,
                  [gameId, current.id, amount, card.message, turn.id],
                );
              }
            }

            const payloadPosition = isRecord(actionPayload)
              ? toFiniteNumber(actionPayload["position"])
              : null;

            if (actionType === "move" && payloadPosition != null) {
              const dest = Math.trunc(payloadPosition);
              if (dest >= 0 && dest < 40) {
                const currentPosRow = await t.one(
                  "SELECT position FROM game_participants WHERE id = $1",
                  [current.id],
                );
                const fromPos = currentPosRow.position as number;
                const passingGo =
                  isRecord(actionPayload) &&
                  Boolean(actionPayload["collect_pass_go"]) &&
                  dest < fromPos;

                if (passingGo) {
                  await t.none(
                    "UPDATE game_participants SET cash = cash + 200, updated_at = now() WHERE id = $1",
                    [current.id],
                  );
                  await t.none(
                    `
                      INSERT INTO transactions (game_id, from_participant_id, to_participant_id, amount, transaction_type, description, turn_id)
                      VALUES ($1, NULL, $2, 200, 'pass_go', 'Passed GO (card)', $3)
                    `,
                    [gameId, current.id, turn.id],
                  );
                }

                await t.none(
                  "UPDATE game_participants SET position = $2, updated_at = now() WHERE id = $1",
                  [current.id, dest],
                );
                newPos = dest;
              }
            }

            if (actionType === "go_to_jail") {
              await t.none(
                "UPDATE game_participants SET position = 9, in_jail = true, jail_turns = 0, updated_at = now() WHERE id = $1",
                [current.id],
              );
              newPos = 9;
              messages.push("Go to Jail.");
              actionNotes.push("Go to Jail.");
            }

            if (actionType === "get_out_of_jail_free") {
              await t.none(
                "UPDATE game_participants SET goojf_cards = goojf_cards + 1, updated_at = now() WHERE id = $1",
                [current.id],
              );
              const note = "Received a Get Out of Jail Free card.";
              messages.push(note);
              actionNotes.push(note);
            }
          }
        }

        // Re-check tile after possible card movement.
        const landed = await t.one(
          "SELECT id, name, tile_type, purchase_price, rent_base FROM tiles WHERE position = $1",
          [newPos],
        );

        if (landed.tile_type === "go_to_jail") {
          await t.none(
            "UPDATE game_participants SET position = 9, in_jail = true, jail_turns = 0, updated_at = now() WHERE id = $1",
            [current.id],
          );
          newPos = 9;
          messages.push("Go to Jail.");
          actionNotes.push("Go to Jail.");
        }

        if (prevPos !== newPos) {
          messages.push(`Moved from ${prevPos} to ${newPos}.`);
        } else {
          messages.push(`Stayed on ${newPos}.`);
        }

        // Ensure the turn row reflects final landing position and action summary.
        const actionText =
          actionNotes.length > 0 ? actionNotes.join(" | ") : null;
        await t.none(
          "UPDATE turns SET new_position = $2, action_taken = $3 WHERE id = $1",
          [turn.id, newPos, actionText],
        );

        if (landed.tile_type === "tax") {
          const amount = taxForTileName(String(landed.name));
          const cashRow = await t.one<{ cash: number }>(
            "SELECT cash FROM game_participants WHERE id = $1 FOR UPDATE",
            [current.id],
          );

          if (cashRow.cash < amount) {
            const pa = await t.one<{ id: string }>(
              `
                INSERT INTO pending_actions (game_id, participant_id, action_type, payload_json)
                VALUES ($1, $2, 'pay_bank_debt', $3)
                RETURNING id
              `,
              [
                gameId,
                current.id,
                {
                  amount,
                  transaction_type: "tax",
                  description: landed.name,
                  turn_id: turn.id,
                },
              ],
            );

            pendingAction = {
              id: pa.id,
              type: "pay_bank_debt",
              amount,
            };
            optionsPayload = await buildOptionsPayloadFromPendingAction(t, {
              gameId,
              participantId: current.id as string,
              pendingAction: {
                id: pa.id,
                action_type: "pay_bank_debt",
                payload_json: { amount, description: landed.name },
              },
              context: "pay_bank_debt",
            });

            messages.push(
              `${String(landed.name)} due: $${amount}. Sell properties, then pay.`,
            );
          } else {
            await t.none(
              "UPDATE game_participants SET cash = cash - $2, updated_at = now() WHERE id = $1",
              [current.id, amount],
            );
            await t.none(
              `
                INSERT INTO transactions (game_id, from_participant_id, to_participant_id, amount, transaction_type, description, turn_id)
                VALUES ($1, $2, NULL, $3, 'tax', $4, $5)
              `,
              [gameId, current.id, amount, landed.name, turn.id],
            );
          }
        }

        if (
          landed.tile_type === "property" ||
          landed.tile_type === "railroad" ||
          landed.tile_type === "utility"
        ) {
          const purchasePrice = landed.purchase_price as number | null;
          if (purchasePrice != null && purchasePrice > 0) {
            const ownership = await t.oneOrNone(
              `
                SELECT o.id, o.participant_id AS owner_participant_id
                FROM ownerships o
                WHERE o.game_id = $1 AND o.tile_id = $2
                LIMIT 1
              `,
              [gameId, landed.id],
            );

            if (!ownership) {
              const pa = await t.one(
                `
                  INSERT INTO pending_actions (game_id, participant_id, action_type, payload_json)
                  VALUES ($1, $2, 'buy_property', $3)
                  RETURNING id
                `,
                [
                  gameId,
                  current.id,
                  { tile_id: landed.id, cost: purchasePrice },
                ],
              );

              pendingAction = {
                id: pa.id as string,
                type: "buy_property",
                tile_id: landed.id as string,
              };
              optionsPayload = await buildOptionsPayloadFromPendingAction(t, {
                gameId,
                participantId: current.id as string,
                pendingAction: {
                  id: pa.id as string,
                  action_type: "buy_property",
                  payload_json: { tile_id: landed.id, cost: purchasePrice },
                },
                context: "landed_on_unowned_property",
              });
            } else if (
              (ownership.owner_participant_id as string) !==
              (current.id as string)
            ) {
              const rent = computeRent({
                rent_base: landed.rent_base as number | null,
                purchase_price: landed.purchase_price as number | null,
              });

              const pa = await t.one(
                `
                  INSERT INTO pending_actions (game_id, participant_id, action_type, payload_json)
                  VALUES ($1, $2, 'pay_rent', $3)
                  RETURNING id
                `,
                [
                  gameId,
                  current.id,
                  {
                    tile_id: landed.id,
                    owner_participant_id: ownership.owner_participant_id,
                    amount: rent,
                  },
                ],
              );

              pendingAction = {
                id: pa.id as string,
                type: "pay_rent",
                tile_id: landed.id as string,
                amount: rent,
              };
              optionsPayload = await buildOptionsPayloadFromPendingAction(t, {
                gameId,
                participantId: current.id as string,
                pendingAction: {
                  id: pa.id as string,
                  action_type: "pay_rent",
                  payload_json: {
                    tile_id: landed.id,
                    owner_participant_id: ownership.owner_participant_id,
                    amount: rent,
                  },
                },
                context: "pay_rent",
              });
            }
          }
        }

        const end = await maybeEndGameIfWinner(
          t as unknown as typeof pgPool,
          gameId,
        );

        const publicState = await buildPublicGameState(t, gameId);

        const balanceRow = await t.one(
          "SELECT cash FROM game_participants WHERE id = $1",
          [current.id],
        );

        return {
          kind: "ok" as const,
          dice: [die1, die2] as [number, number],
          previous_position: prevPos,
          new_position: newPos,
          participant_id: current.id as string,
          user_id: userId,
          balance: balanceRow.cash as number,
          publicState,
          optionsPayload,
          pendingAction,
          messages,
          ended: end.ended,
          winnerParticipantId: end.winnerParticipantId,
          bankruptTurnAdvanced: false,
          nextTurn: null,
        };
      });

      if (output.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (output.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not in playing phase" });
      if (output.kind === "not_your_turn")
        return res.status(409).json({ error: "Not your turn" });
      if (output.kind === "has_pending")
        return res.status(409).json({ error: "You have a pending action" });
      if (output.kind === "bad_state")
        return res.status(500).json({ error: "Invalid game state" });
      if (output.kind === "no_goojf")
        return res
          .status(409)
          .json({ error: "No Get Out of Jail Free cards available" });
      if (output.kind === "insufficient_jail_fee")
        return res
          .status(409)
          .json({ error: "Insufficient funds to pay $50 to leave jail" });

      emitGameStateUpdate(gameId, output.publicState);
      emitPrivateBalanceUpdate(userId, {
        game_id: gameId,
        player_id: output.participant_id,
        balance: output.balance,
      });

      if (output.optionsPayload) {
        emitPrivateOptions(userId, output.optionsPayload);
      }

      if (output.ended && output.winnerParticipantId) {
        emitGameEnded(gameId, {
          game_id: gameId,
          winner_participant_id: output.winnerParticipantId,
        });
      }

      if (
        output.bankruptTurnAdvanced &&
        output.nextTurn &&
        !output.ended &&
        output.publicState.phase === "playing" &&
        output.publicState.current_player_id
      ) {
        emitTurnChanged(gameId, {
          game_id: gameId,
          previous_player_id: output.participant_id,
          current_player_id: output.publicState.current_player_id,
          turn_number: output.publicState.turn_number,
        });

        emitPrivateOptions(output.nextTurn.userId, {
          game_id: gameId,
          player_id: output.publicState.current_player_id,
          context: "start_turn",
          options: [{ action: "roll_dice" }],
        });
      }

      return res.status(202).json({
        dice: output.dice,
        previous_position: output.previous_position,
        new_position: output.new_position,
        pending_action: output.pendingAction,
        messages: output.messages,
      });
    } catch (error) {
      logger.error("roll_turn_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post(
    "/games/:gameId/properties/:propertyId/buy",
    async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const gameId = requireParam(req, res, "gameId");
      if (!gameId) return;
      const propertyId = requireParam(req, res, "propertyId");
      if (!propertyId) return;
      const body = (req.body ?? {}) as BuyPropertyBody;
      const pendingActionId = body.pending_action_id?.trim();

      if (!pendingActionId) {
        return res.status(400).json({ error: "pending_action_id is required" });
      }

      try {
        const output = await pgPool.tx(async (t) => {
          const game = await t.oneOrNone(
            "SELECT id, status FROM games WHERE id = $1 FOR UPDATE",
            [gameId],
          );
          if (!game) return { kind: "not_found" as const };
          if (game.status !== "playing") return { kind: "bad_phase" as const };

          const participant = await t.oneOrNone(
            "SELECT id, cash FROM game_participants WHERE game_id = $1 AND user_id = $2 FOR UPDATE",
            [gameId, userId],
          );
          if (!participant) return { kind: "not_participant" as const };

          const pa = await t.oneOrNone(
            `
              SELECT id, action_type, payload_json
              FROM pending_actions
              WHERE id = $1 AND game_id = $2 AND participant_id = $3 AND status = 'pending'
              FOR UPDATE
            `,
            [pendingActionId, gameId, participant.id],
          );

          if (!pa) return { kind: "no_pending" as const };
          if (pa.action_type !== "buy_property")
            return { kind: "wrong_pending" as const };

          const payload = pa.payload_json as unknown;
          if (!isRecord(payload)) return { kind: "bad_payload" as const };

          const tileId = payload["tile_id"];
          const cost = toFiniteNumber(payload["cost"]);

          if (typeof tileId !== "string" || tileId !== propertyId)
            return { kind: "mismatch" as const };
          if (cost == null || cost <= 0)
            return { kind: "bad_payload" as const };

          const tile = await t.oneOrNone(
            "SELECT id, purchase_price FROM tiles WHERE id = $1",
            [tileId],
          );
          if (!tile) return { kind: "bad_tile" as const };

          const existingOwnership = await t.oneOrNone(
            "SELECT id FROM ownerships WHERE game_id = $1 AND tile_id = $2",
            [gameId, tileId],
          );
          if (existingOwnership) return { kind: "already_owned" as const };

          const cash = participant.cash as number;
          if (cash < cost) return { kind: "insufficient" as const };

          await t.none(
            "UPDATE game_participants SET cash = cash - $2, updated_at = now() WHERE id = $1",
            [participant.id, cost],
          );

          await t.none(
            "INSERT INTO ownerships (game_id, tile_id, participant_id) VALUES ($1, $2, $3)",
            [gameId, tileId, participant.id],
          );

          const lastTurn = await t.oneOrNone<{ id: string }>(
            `
              SELECT id
              FROM turns
              WHERE game_id = $1 AND participant_id = $2
              ORDER BY turn_number DESC
              LIMIT 1
            `,
            [gameId, participant.id],
          );

          await t.none(
            `
              INSERT INTO transactions (
                game_id,
                from_participant_id,
                to_participant_id,
                amount,
                transaction_type,
                description,
                turn_id
              )
              VALUES ($1, $2, NULL, $3, 'purchase', 'Purchased property', $4)
            `,
            [gameId, participant.id, cost, lastTurn?.id ?? null],
          );

          await t.none(
            "UPDATE pending_actions SET status = 'completed', updated_at = now() WHERE id = $1",
            [pendingActionId],
          );

          const publicState = await buildPublicGameState(t, gameId);
          const newBalanceRow = await t.one(
            "SELECT cash FROM game_participants WHERE id = $1",
            [participant.id],
          );

          return {
            kind: "ok" as const,
            publicState,
            participantId: participant.id as string,
            balance: newBalanceRow.cash as number,
          };
        });

        if (output.kind === "not_found")
          return res.status(404).json({ error: "Game not found" });
        if (output.kind === "bad_phase")
          return res
            .status(409)
            .json({ error: "Game is not in playing phase" });
        if (output.kind === "not_participant")
          return res.status(403).json({ error: "Not a participant" });
        if (output.kind === "no_pending")
          return res.status(409).json({ error: "No pending action" });
        if (output.kind === "wrong_pending")
          return res.status(409).json({ error: "Wrong pending action" });
        if (output.kind === "mismatch")
          return res
            .status(409)
            .json({ error: "Pending action does not match property" });
        if (output.kind === "bad_payload")
          return res
            .status(500)
            .json({ error: "Invalid pending action payload" });
        if (output.kind === "bad_tile")
          return res.status(404).json({ error: "Property not found" });
        if (output.kind === "already_owned")
          return res.status(409).json({ error: "Property already owned" });
        if (output.kind === "insufficient")
          return res.status(409).json({ error: "Insufficient funds" });

        emitGameStateUpdate(gameId, output.publicState);
        emitPrivateBalanceUpdate(userId, {
          game_id: gameId,
          player_id: output.participantId,
          balance: output.balance,
        });

        return res.status(202).json({ ok: true });
      } catch (error) {
        logger.error("buy_property_failed", {
          error,
          game_id: gameId,
          user_id: userId,
        });
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  )
  .post(
    "/games/:gameId/properties/:propertyId/pay-rent",
    async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const gameId = requireParam(req, res, "gameId");
      if (!gameId) return;
      const propertyId = requireParam(req, res, "propertyId");
      if (!propertyId) return;
      const body = (req.body ?? {}) as PayRentBody;
      const pendingActionId = body.pending_action_id?.trim();

      if (!pendingActionId) {
        return res.status(400).json({ error: "pending_action_id is required" });
      }

      try {
        const output = await pgPool.tx(async (t) => {
          const game = await t.oneOrNone(
            "SELECT id, status FROM games WHERE id = $1 FOR UPDATE",
            [gameId],
          );
          if (!game) return { kind: "not_found" as const };
          if (game.status !== "playing") return { kind: "bad_phase" as const };

          const payer = await t.oneOrNone(
            "SELECT id, cash FROM game_participants WHERE game_id = $1 AND user_id = $2 FOR UPDATE",
            [gameId, userId],
          );
          if (!payer) return { kind: "not_participant" as const };

          const pa = await t.oneOrNone(
            `
              SELECT id, action_type, payload_json
              FROM pending_actions
              WHERE id = $1 AND game_id = $2 AND participant_id = $3 AND status = 'pending'
              FOR UPDATE
            `,
            [pendingActionId, gameId, payer.id],
          );

          if (!pa) return { kind: "no_pending" as const };
          if (pa.action_type !== "pay_rent")
            return { kind: "wrong_pending" as const };

          const payload = pa.payload_json as unknown;
          if (!isRecord(payload)) return { kind: "bad_payload" as const };

          const tileId = payload["tile_id"];
          const ownerParticipantId = payload["owner_participant_id"];
          const amount = toFiniteNumber(payload["amount"]);

          if (typeof tileId !== "string" || tileId !== propertyId)
            return { kind: "mismatch" as const };
          if (typeof ownerParticipantId !== "string")
            return { kind: "bad_payload" as const };
          if (amount == null || amount <= 0)
            return { kind: "bad_payload" as const };

          const owner = await t.oneOrNone(
            "SELECT id FROM game_participants WHERE id = $1 AND game_id = $2 FOR UPDATE",
            [ownerParticipantId, gameId],
          );
          if (!owner) return { kind: "bad_payload" as const };

          const payerCash = payer.cash as number;
          if (payerCash < amount) {
            // Keep the rent pending so the payer can sell properties and try again.
            return { kind: "insufficient" as const };
          }

          const lastTurn = await t.oneOrNone<{ id: string }>(
            `
              SELECT id
              FROM turns
              WHERE game_id = $1 AND participant_id = $2
              ORDER BY turn_number DESC
              LIMIT 1
            `,
            [gameId, payer.id],
          );

          await t.none(
            "UPDATE game_participants SET cash = cash - $2, updated_at = now() WHERE id = $1",
            [payer.id, amount],
          );

          await t.none(
            "UPDATE game_participants SET cash = cash + $2, updated_at = now() WHERE id = $1",
            [ownerParticipantId, amount],
          );

          await t.none(
            `
              INSERT INTO transactions (
                game_id,
                from_participant_id,
                to_participant_id,
                amount,
                transaction_type,
                description,
                turn_id
              )
              VALUES ($1, $2, $3, $4, 'rent', 'Paid rent', $5)
            `,
            [
              gameId,
              payer.id,
              ownerParticipantId,
              amount,
              lastTurn?.id ?? null,
            ],
          );

          await t.none(
            "UPDATE pending_actions SET status = 'completed', updated_at = now() WHERE id = $1",
            [pendingActionId],
          );

          const publicState = await buildPublicGameState(t, gameId);
          const payerBalanceRow = await t.one(
            "SELECT cash, is_bankrupt FROM game_participants WHERE id = $1",
            [payer.id],
          );
          const ownerBalanceRow = await t.one(
            "SELECT cash FROM game_participants WHERE id = $1",
            [ownerParticipantId],
          );

          const end = await maybeEndGameIfWinner(
            t as unknown as typeof pgPool,
            gameId,
          );

          return {
            kind: "ok" as const,
            publicState,
            payerParticipantId: payer.id as string,
            payerBalance: payerBalanceRow.cash as number,
            payerBankrupt: payerBalanceRow.is_bankrupt as boolean,
            ownerParticipantId: ownerParticipantId,
            ownerBalance: ownerBalanceRow.cash as number,
            ended: end.ended,
            winnerParticipantId: end.winnerParticipantId,
          };
        });

        if (output.kind === "not_found")
          return res.status(404).json({ error: "Game not found" });
        if (output.kind === "bad_phase")
          return res
            .status(409)
            .json({ error: "Game is not in playing phase" });
        if (output.kind === "not_participant")
          return res.status(403).json({ error: "Not a participant" });
        if (output.kind === "no_pending")
          return res.status(409).json({ error: "No pending action" });
        if (output.kind === "wrong_pending")
          return res.status(409).json({ error: "Wrong pending action" });
        if (output.kind === "mismatch")
          return res
            .status(409)
            .json({ error: "Pending action does not match property" });
        if (output.kind === "bad_payload")
          return res
            .status(500)
            .json({ error: "Invalid pending action payload" });
        if (output.kind === "insufficient")
          return res.status(409).json({
            error:
              "Insufficient funds to pay rent. Sell properties and try again.",
          });

        emitGameStateUpdate(gameId, output.publicState);

        if (output.ended && output.winnerParticipantId) {
          emitGameEnded(gameId, {
            game_id: gameId,
            winner_participant_id: output.winnerParticipantId,
          });
        }
        emitPrivateBalanceUpdate(userId, {
          game_id: gameId,
          player_id: output.payerParticipantId,
          balance: output.payerBalance,
        });

        // Best-effort: also notify owner if they have a socket connection.
        const ownerUser = await pgPool.oneOrNone(
          "SELECT user_id FROM game_participants WHERE id = $1",
          [output.ownerParticipantId],
        );
        if (ownerUser?.user_id) {
          emitPrivateBalanceUpdate(ownerUser.user_id as string, {
            game_id: gameId,
            player_id: output.ownerParticipantId,
            balance: output.ownerBalance,
          });
        }

        return res
          .status(202)
          .json({ ok: true, bankrupt: output.payerBankrupt });
      } catch (error) {
        logger.error("pay_rent_failed", {
          error,
          game_id: gameId,
          user_id: userId,
        });
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  )
  .post("/games/:gameId/debts/pay", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    const body = (req.body ?? {}) as PayDebtBody;
    const pendingActionId = body.pending_action_id?.trim();
    if (!pendingActionId) {
      return res.status(400).json({ error: "pending_action_id is required" });
    }

    try {
      const output = await pgPool.tx(async (t) => {
        const game = await t.oneOrNone(
          "SELECT id, status FROM games WHERE id = $1 FOR UPDATE",
          [gameId],
        );
        if (!game) return { kind: "not_found" as const };
        if (game.status !== "playing") return { kind: "bad_phase" as const };

        const participant = await t.oneOrNone<{ id: string; cash: number }>(
          `
            SELECT id, cash
            FROM game_participants
            WHERE game_id = $1 AND user_id = $2
            FOR UPDATE
          `,
          [gameId, userId],
        );
        if (!participant) return { kind: "not_participant" as const };

        const pa = await t.oneOrNone<{
          id: string;
          action_type: string;
          payload_json: unknown;
        }>(
          `
            SELECT id, action_type, payload_json
            FROM pending_actions
            WHERE id = $1 AND game_id = $2 AND participant_id = $3 AND status = 'pending'
            FOR UPDATE
          `,
          [pendingActionId, gameId, participant.id],
        );
        if (!pa) return { kind: "no_pending" as const };
        if (pa.action_type !== "pay_bank_debt")
          return { kind: "wrong_pending" as const };

        const payload = pa.payload_json;
        if (!isRecord(payload)) return { kind: "bad_payload" as const };

        const amount = toFiniteNumber(payload["amount"]);
        const transactionType =
          typeof payload["transaction_type"] === "string"
            ? (payload["transaction_type"] as string)
            : "tax";
        const description =
          typeof payload["description"] === "string"
            ? (payload["description"] as string)
            : "Bank debt";
        const turnId =
          typeof payload["turn_id"] === "string"
            ? (payload["turn_id"] as string)
            : null;

        if (amount == null || amount <= 0) {
          return { kind: "bad_payload" as const };
        }

        const cashRow = await t.one<{ cash: number }>(
          "SELECT cash FROM game_participants WHERE id = $1 FOR UPDATE",
          [participant.id],
        );
        if (cashRow.cash < amount) return { kind: "insufficient" as const };

        await t.none(
          "UPDATE game_participants SET cash = cash - $2, updated_at = now() WHERE id = $1",
          [participant.id, amount],
        );
        await t.none(
          `
            INSERT INTO transactions (
              game_id,
              from_participant_id,
              to_participant_id,
              amount,
              transaction_type,
              description,
              turn_id
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6)
          `,
          [
            gameId,
            participant.id,
            amount,
            transactionType,
            description,
            turnId,
          ],
        );
        await t.none(
          "UPDATE pending_actions SET status = 'completed', updated_at = now() WHERE id = $1",
          [pa.id],
        );

        const publicState = await buildPublicGameState(t, gameId);
        const balanceRow = await t.one<{ cash: number }>(
          "SELECT cash FROM game_participants WHERE id = $1",
          [participant.id],
        );

        return {
          kind: "ok" as const,
          publicState,
          participantId: participant.id,
          balance: balanceRow.cash,
        };
      });

      if (output.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (output.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not in playing phase" });
      if (output.kind === "not_participant")
        return res.status(403).json({ error: "Not a participant" });
      if (output.kind === "no_pending")
        return res.status(409).json({ error: "No pending action" });
      if (output.kind === "wrong_pending")
        return res.status(409).json({ error: "Wrong pending action" });
      if (output.kind === "bad_payload")
        return res
          .status(500)
          .json({ error: "Invalid pending action payload" });
      if (output.kind === "insufficient")
        return res.status(409).json({ error: "Insufficient funds" });

      emitGameStateUpdate(gameId, output.publicState);
      emitPrivateBalanceUpdate(userId, {
        game_id: gameId,
        player_id: output.participantId,
        balance: output.balance,
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      logger.error("pay_bank_debt_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post(
    "/games/:gameId/debts/bankrupt",
    async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const gameId = requireParam(req, res, "gameId");
      if (!gameId) return;

      const body = (req.body ?? {}) as PayDebtBody;
      const pendingActionId = body.pending_action_id?.trim();
      if (!pendingActionId) {
        return res.status(400).json({ error: "pending_action_id is required" });
      }

      try {
        const output = await pgPool.tx(async (t) => {
          const game = await t.oneOrNone(
            "SELECT id, status FROM games WHERE id = $1 FOR UPDATE",
            [gameId],
          );
          if (!game) return { kind: "not_found" as const };
          if (game.status !== "playing") return { kind: "bad_phase" as const };

          const participant = await t.oneOrNone<{ id: string }>(
            `
              SELECT id
              FROM game_participants
              WHERE game_id = $1 AND user_id = $2
              FOR UPDATE
            `,
            [gameId, userId],
          );
          if (!participant) return { kind: "not_participant" as const };

          const pa = await t.oneOrNone<{
            id: string;
            action_type: string;
            payload_json: unknown;
          }>(
            `
              SELECT id, action_type, payload_json
              FROM pending_actions
              WHERE id = $1 AND game_id = $2 AND participant_id = $3 AND status = 'pending'
              FOR UPDATE
            `,
            [pendingActionId, gameId, participant.id],
          );
          if (!pa) return { kind: "no_pending" as const };
          if (pa.action_type !== "pay_bank_debt")
            return { kind: "wrong_pending" as const };

          const hasProperties = await participantHasAnyProperties(
            t as unknown as typeof pgPool,
            gameId,
            participant.id,
          );
          if (hasProperties) return { kind: "must_sell_properties" as const };

          const currentBefore = await computeCurrentTurnPlayer(
            t as unknown as typeof pgPool,
            gameId,
          );
          const wasCurrent = currentBefore?.participantId === participant.id;

          const payload = pa.payload_json;
          const turnId =
            isRecord(payload) && typeof payload["turn_id"] === "string"
              ? (payload["turn_id"] as string)
              : null;

          await t.none(
            "UPDATE pending_actions SET status = 'completed', updated_at = now() WHERE id = $1",
            [pa.id],
          );

          await declareBankruptToBank(t as unknown as typeof pgPool, {
            gameId,
            participantId: participant.id,
            reason: "Declared bankruptcy",
            turnId,
          });

          const end = await maybeEndGameIfWinner(
            t as unknown as typeof pgPool,
            gameId,
          );
          const publicState = await buildPublicGameState(t, gameId);

          const nextTurn =
            wasCurrent && !end.ended
              ? await computeCurrentTurnPlayer(
                  t as unknown as typeof pgPool,
                  gameId,
                )
              : null;

          return {
            kind: "ok" as const,
            publicState,
            ended: end.ended,
            winnerParticipantId: end.winnerParticipantId,
            wasCurrent,
            nextTurn,
            bankruptParticipantId: participant.id,
          };
        });

        if (output.kind === "not_found")
          return res.status(404).json({ error: "Game not found" });
        if (output.kind === "bad_phase")
          return res
            .status(409)
            .json({ error: "Game is not in playing phase" });
        if (output.kind === "not_participant")
          return res.status(403).json({ error: "Not a participant" });
        if (output.kind === "no_pending")
          return res.status(409).json({ error: "No pending action" });
        if (output.kind === "wrong_pending")
          return res.status(409).json({ error: "Wrong pending action" });
        if (output.kind === "must_sell_properties")
          return res.status(409).json({
            error: "You must sell all properties before declaring bankruptcy",
          });

        emitGameStateUpdate(gameId, output.publicState);
        if (output.ended && output.winnerParticipantId) {
          emitGameEnded(gameId, {
            game_id: gameId,
            winner_participant_id: output.winnerParticipantId,
          });
        }

        if (
          output.wasCurrent &&
          output.nextTurn &&
          !output.ended &&
          output.publicState.phase === "playing" &&
          output.publicState.current_player_id
        ) {
          emitTurnChanged(gameId, {
            game_id: gameId,
            previous_player_id: output.bankruptParticipantId,
            current_player_id: output.publicState.current_player_id,
            turn_number: output.publicState.turn_number,
          });

          emitPrivateOptions(output.nextTurn.userId, {
            game_id: gameId,
            player_id: output.publicState.current_player_id,
            context: "start_turn",
            options: [{ action: "roll_dice" }],
          });
        }

        return res.status(200).json({ ok: true });
      } catch (error) {
        logger.error("declare_bankruptcy_failed", {
          error,
          game_id: gameId,
          user_id: userId,
        });
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  )
  .post(
    "/games/:gameId/properties/:propertyId/sell",
    async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req, res);
      if (!userId) return;

      const gameId = requireParam(req, res, "gameId");
      if (!gameId) return;
      const propertyId = requireParam(req, res, "propertyId");
      if (!propertyId) return;

      try {
        const output = await pgPool.tx(async (t) => {
          const game = await t.oneOrNone(
            "SELECT id, status FROM games WHERE id = $1 FOR UPDATE",
            [gameId],
          );
          if (!game) return { kind: "not_found" as const };
          if (game.status !== "playing") return { kind: "bad_phase" as const };

          const participant = await t.oneOrNone<{
            id: string;
            is_bankrupt: boolean;
          }>(
            `
              SELECT id, is_bankrupt
              FROM game_participants
              WHERE game_id = $1 AND user_id = $2
              FOR UPDATE
            `,
            [gameId, userId],
          );
          if (!participant) return { kind: "not_participant" as const };
          if (participant.is_bankrupt) return { kind: "bankrupt" as const };

          const tile = await t.oneOrNone<{
            id: string;
            name: string;
            tile_type: string;
            purchase_price: number | null;
          }>(
            `
              SELECT id, name, tile_type, purchase_price
              FROM tiles
              WHERE id = $1
            `,
            [propertyId],
          );
          if (!tile) return { kind: "bad_tile" as const };

          const own = await t.oneOrNone<{ id: string }>(
            `
              SELECT id
              FROM ownerships
              WHERE game_id = $1 AND tile_id = $2 AND participant_id = $3
              FOR UPDATE
            `,
            [gameId, propertyId, participant.id],
          );
          if (!own) return { kind: "not_owner" as const };

          const price = tile.purchase_price ?? 0;
          if (!Number.isFinite(price) || price <= 0) {
            return { kind: "not_sellable" as const };
          }

          const saleValue = Math.floor(price / 2);

          await t.none("DELETE FROM ownerships WHERE id = $1", [own.id]);
          await t.none(
            "UPDATE game_participants SET cash = cash + $2, updated_at = now() WHERE id = $1",
            [participant.id, saleValue],
          );

          const lastTurn = await t.oneOrNone<{ id: string }>(
            `
              SELECT id
              FROM turns
              WHERE game_id = $1 AND participant_id = $2
              ORDER BY turn_number DESC
              LIMIT 1
            `,
            [gameId, participant.id],
          );

          await t.none(
            `
              INSERT INTO transactions (
                game_id,
                from_participant_id,
                to_participant_id,
                amount,
                transaction_type,
                description,
                turn_id
              )
              VALUES ($1, NULL, $2, $3, 'sale', $4, $5)
            `,
            [
              gameId,
              participant.id,
              saleValue,
              `Sold ${tile.name}`,
              lastTurn?.id ?? null,
            ],
          );

          const pending = await t.oneOrNone<{
            id: string;
            action_type: string;
            payload_json: unknown;
          }>(
            `
              SELECT id, action_type, payload_json
              FROM pending_actions
              WHERE game_id = $1 AND participant_id = $2 AND status = 'pending'
              LIMIT 1
            `,
            [gameId, participant.id],
          );

          const optionsPayload = pending
            ? await buildOptionsPayloadFromPendingAction(
                t as unknown as typeof pgPool,
                {
                  gameId,
                  participantId: participant.id,
                  pendingAction: pending,
                  context: "pending_action",
                },
              )
            : null;

          const publicState = await buildPublicGameState(t, gameId);
          const balanceRow = await t.one<{ cash: number }>(
            "SELECT cash FROM game_participants WHERE id = $1",
            [participant.id],
          );

          return {
            kind: "ok" as const,
            publicState,
            participantId: participant.id,
            balance: balanceRow.cash,
            optionsPayload,
          };
        });

        if (output.kind === "not_found")
          return res.status(404).json({ error: "Game not found" });
        if (output.kind === "bad_phase")
          return res
            .status(409)
            .json({ error: "Game is not in playing phase" });
        if (output.kind === "not_participant")
          return res.status(403).json({ error: "Not a participant" });
        if (output.kind === "bankrupt")
          return res.status(409).json({ error: "You are bankrupt" });
        if (output.kind === "bad_tile")
          return res.status(404).json({ error: "Property not found" });
        if (output.kind === "not_owner")
          return res
            .status(409)
            .json({ error: "You do not own this property" });
        if (output.kind === "not_sellable")
          return res.status(409).json({ error: "This tile is not sellable" });

        emitGameStateUpdate(gameId, output.publicState);
        emitPrivateBalanceUpdate(userId, {
          game_id: gameId,
          player_id: output.participantId,
          balance: output.balance,
        });
        if (output.optionsPayload) {
          emitPrivateOptions(userId, output.optionsPayload);
        }

        return res.status(200).json({ ok: true });
      } catch (error) {
        logger.error("sell_property_failed", {
          error,
          game_id: gameId,
          user_id: userId,
        });
        return res.status(500).json({ error: "Internal server error" });
      }
    },
  )
  .post("/games/:gameId/turn/end", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;

    try {
      const output = await pgPool.tx(async (t) => {
        const game = await t.oneOrNone(
          "SELECT id, status, turn_index FROM games WHERE id = $1 FOR UPDATE",
          [gameId],
        );
        if (!game) return { kind: "not_found" as const };
        if (game.status !== "playing") return { kind: "bad_phase" as const };

        const participants = await t.manyOrNone(
          `
            SELECT id, user_id, is_bankrupt
            FROM game_participants
            WHERE game_id = $1
            ORDER BY joined_at ASC
            FOR UPDATE
          `,
          [gameId],
        );

        const active = participants.filter((p) => !p.is_bankrupt);
        if (active.length === 0) return { kind: "bad_state" as const };

        const currentIndex = (game.turn_index as number) % active.length;
        const current = active[currentIndex];
        if (!current) return { kind: "bad_state" as const };
        if ((current.user_id as string) !== userId)
          return { kind: "not_your_turn" as const };

        const pending = await t.oneOrNone(
          `
            SELECT id, action_type
            FROM pending_actions
            WHERE game_id = $1 AND participant_id = $2 AND status = 'pending'
            LIMIT 1
            FOR UPDATE
          `,
          [gameId, current.id],
        );

        if (pending) {
          // Allow ending the turn if the only pending action is an optional purchase decision.
          if (pending.action_type === "buy_property") {
            await t.none(
              "UPDATE pending_actions SET status = 'cancelled', updated_at = now() WHERE id = $1",
              [pending.id],
            );
          } else {
            return { kind: "has_pending" as const };
          }
        }

        // Check for game end.
        if (active.length === 1) {
          await t.none(
            "UPDATE games SET status = 'ended', ended_at = now(), updated_at = now() WHERE id = $1",
            [gameId],
          );

          const standings = await t.manyOrNone<{
            player_id: string;
            balance: number;
          }>(
            `
              SELECT id AS player_id, cash AS balance
              FROM game_participants
              WHERE game_id = $1
              ORDER BY is_bankrupt ASC, cash DESC
            `,
            [gameId],
          );

          const winner = standings[0]?.player_id ?? null;

          return {
            kind: "ended" as const,
            winner_id: winner,
            final_standings: standings.map((s, idx: number) => ({
              player_id: s.player_id,
              rank: idx + 1,
              balance: s.balance,
            })),
          };
        }

        const nextIndex = (currentIndex + 1) % active.length;
        const next = active[nextIndex];

        await t.none(
          "UPDATE games SET turn_index = $2, updated_at = now() WHERE id = $1",
          [gameId, nextIndex],
        );

        const publicState = await buildPublicGameState(t, gameId);

        return {
          kind: "ok" as const,
          previousParticipantId: current.id as string,
          currentParticipantId: next.id as string,
          currentUserId: next.user_id as string,
          publicState,
        };
      });

      if (output.kind === "not_found")
        return res.status(404).json({ error: "Game not found" });
      if (output.kind === "bad_phase")
        return res.status(409).json({ error: "Game is not in playing phase" });
      if (output.kind === "not_your_turn")
        return res.status(409).json({ error: "Not your turn" });
      if (output.kind === "has_pending")
        return res.status(409).json({ error: "You have a pending action" });
      if (output.kind === "bad_state")
        return res.status(500).json({ error: "Invalid game state" });

      if (output.kind === "ended") {
        emitGameEnded(gameId, {
          game_id: gameId,
          winner_id: output.winner_id,
          final_standings: output.final_standings,
        });
        return res.status(202).json({ ok: true, ended: true });
      }

      emitGameStateUpdate(gameId, output.publicState);

      emitTurnChanged(gameId, {
        game_id: gameId,
        previous_player_id: output.previousParticipantId,
        current_player_id: output.currentParticipantId,
        turn_number: output.publicState.turn_number,
      });

      emitPrivateOptions(output.currentUserId, {
        game_id: gameId,
        player_id: output.currentParticipantId,
        context: "start_turn",
        options: [{ action: "roll_dice" }],
      });

      return res.status(202).json({ ok: true });
    } catch (error) {
      logger.error("end_turn_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  });
