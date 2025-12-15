import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import {
  buildGameStateForUser,
  GameNotFoundError,
  NotParticipantError,
} from "../../../services/gameState.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";

export async function getGameState(req: AuthenticatedRequest, res: Response) {
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
}
