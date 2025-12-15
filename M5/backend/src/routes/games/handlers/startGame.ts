import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { startGameAction } from "../../../services/gameActions/startGame.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function startGame(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  void req.body;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;

  try {
    const result = await pgPool.tx((t) =>
      startGameAction(t, { gameId, userId }),
    );

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

    emitEvents(result.events);
    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error("start_game_failed", { error, game_id: gameId });
    return res.status(500).json({ error: "Internal server error" });
  }
}
