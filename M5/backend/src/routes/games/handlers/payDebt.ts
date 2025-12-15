import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { payDebtAction } from "../../../services/gameActions/payDebt.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import type { PayDebtBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function payDebt(req: AuthenticatedRequest, res: Response) {
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
    const output = await pgPool.tx((t) =>
      payDebtAction(t, { gameId, userId, pendingActionId }),
    );

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
      return res.status(500).json({ error: "Invalid pending action payload" });
    if (output.kind === "insufficient")
      return res.status(409).json({ error: "Insufficient funds" });

    emitEvents(output.events);
    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("pay_bank_debt_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
