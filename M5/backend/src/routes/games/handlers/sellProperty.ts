import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { sellPropertyAction } from "../../../services/gameActions/sellProperty.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function sellProperty(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;
  const propertyId = requireParam(req, res, "propertyId");
  if (!propertyId) return;

  try {
    const output = await pgPool.tx((t) =>
      sellPropertyAction(t, { gameId, userId, propertyId }),
    );

    if (output.kind === "not_found")
      return res.status(404).json({ error: "Game not found" });
    if (output.kind === "bad_phase")
      return res.status(409).json({ error: "Game is not in playing phase" });
    if (output.kind === "not_participant")
      return res.status(403).json({ error: "Not a participant" });
    if (output.kind === "bankrupt")
      return res.status(409).json({ error: "You are bankrupt" });
    if (output.kind === "bad_tile")
      return res.status(404).json({ error: "Property not found" });
    if (output.kind === "not_owner")
      return res.status(409).json({ error: "You do not own this property" });
    if (output.kind === "not_sellable")
      return res.status(409).json({ error: "This tile is not sellable" });

    emitEvents(output.events);
    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("sell_property_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
