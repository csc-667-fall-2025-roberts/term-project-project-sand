import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { joinGameAction } from "../../../services/gameActions/joinGame.js";
import {
  normalizeTokenColor,
  parseTokenColor,
} from "../../../services/gameActions/shared/tokenColors.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import type { JoinGameBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function joinGame(req: AuthenticatedRequest, res: Response) {
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
    const result = await pgPool.tx((t) =>
      joinGameAction(t, { gameId, userId, tokenColor }),
    );

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

    emitEvents([
      {
        kind: "playerJoined",
        gameId,
        payload: {
          game_id: gameId,
          player: {
            id: result.participant.id,
            username: req.user?.displayName ?? "Player",
            token_color: result.participant.token_color,
          },
          player_count: result.publicState.players.length,
          max_players: result.maxPlayers,
        },
      },
      ...result.events,
    ]);

    return res.status(202).json({ participant_id: result.participant.id });
  } catch (error) {
    logger.error("join_game_failed", { error, game_id: gameId });
    return res.status(500).json({ error: "Internal server error" });
  }
}
