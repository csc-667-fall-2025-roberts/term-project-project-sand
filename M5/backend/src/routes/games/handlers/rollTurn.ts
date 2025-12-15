import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { rollTurnAction } from "../../../services/gameActions/rollTurn.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import type { RollTurnBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function rollTurn(req: AuthenticatedRequest, res: Response) {
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
    const output = await pgPool.tx((t) =>
      rollTurnAction(t, {
        gameId,
        userId,
        payToLeaveJail,
        useGoojf,
      }),
    );

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

    emitEvents(output.events);

    return res.status(202).json({
      dice: output.dice,
      previous_position: output.previous_position,
      new_position: output.new_position,
      pending_action: output.pending_action,
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
}
