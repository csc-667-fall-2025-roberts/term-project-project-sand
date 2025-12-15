import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { buyPropertyAction } from "../../../services/gameActions/buyProperty.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import type { BuyPropertyBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function buyProperty(req: AuthenticatedRequest, res: Response) {
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
    const output = await pgPool.tx((t) =>
      buyPropertyAction(t, {
        gameId,
        userId,
        propertyId,
        pendingActionId,
      }),
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
    if (output.kind === "mismatch")
      return res
        .status(409)
        .json({ error: "Pending action does not match property" });
    if (output.kind === "bad_payload")
      return res.status(500).json({ error: "Invalid pending action payload" });
    if (output.kind === "bad_tile")
      return res.status(404).json({ error: "Property not found" });
    if (output.kind === "already_owned")
      return res.status(409).json({ error: "Property already owned" });
    if (output.kind === "insufficient")
      return res.status(409).json({ error: "Insufficient funds" });

    emitEvents(output.events);
    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error("buy_property_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
