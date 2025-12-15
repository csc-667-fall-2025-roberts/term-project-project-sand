import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { joinAutoAction } from "../../../services/gameActions/joinAuto.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function joinAuto(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;

  try {
    const result = await pgPool.tx((t) =>
      joinAutoAction(t, { gameId, userId }),
    );

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
}
