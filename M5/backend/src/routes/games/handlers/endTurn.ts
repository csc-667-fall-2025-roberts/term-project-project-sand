import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { endTurnAction } from "../../../services/gameActions/endTurn.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function endTurn(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;

  try {
    const output = await pgPool.tx((t) => endTurnAction(t, { gameId, userId }));

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

    emitEvents(output.events);

    if (output.kind === "ended") {
      return res.status(202).json({ ok: true, ended: true });
    }

    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error("end_turn_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
