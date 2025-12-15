import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { deleteGameAction } from "../../../services/gameActions/deleteGame.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function deleteGame(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;

  try {
    const result = await pgPool.tx((t) =>
      deleteGameAction(t, { gameId, userId }),
    );

    if (result.kind === "not_found") {
      return res.status(404).json({ error: "Game not found" });
    }
    if (result.kind === "forbidden") {
      return res
        .status(403)
        .json({ error: "Only the creator can delete the game" });
    }

    emitEvents(result.events);
    return res.status(204).send();
  } catch (error) {
    logger.error("delete_game_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
