import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { payRentAction } from "../../../services/gameActions/payRent.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import type { PayRentBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function payRent(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const gameId = requireParam(req, res, "gameId");
  if (!gameId) return;
  const propertyId = requireParam(req, res, "propertyId");
  if (!propertyId) return;

  const body = (req.body ?? {}) as PayRentBody;
  const pendingActionId = body.pending_action_id?.trim();

  if (!pendingActionId) {
    return res.status(400).json({ error: "pending_action_id is required" });
  }

  try {
    const output = await pgPool.tx((t) =>
      payRentAction(t, {
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
    if (output.kind === "insufficient")
      return res.status(409).json({
        error: "Insufficient funds to pay rent. Sell properties and try again.",
      });

    emitEvents(output.events);

    const ownerUser = await pgPool.oneOrNone<{ user_id: string }>(
      "SELECT user_id FROM game_participants WHERE id = $1",
      [output.ownerParticipantId],
    );
    if (ownerUser?.user_id) {
      emitEvents([
        {
          kind: "privateBalanceUpdate",
          userId: ownerUser.user_id,
          payload: {
            game_id: gameId,
            player_id: output.ownerParticipantId,
            balance: output.ownerBalance,
          },
        },
      ]);
    }

    return res.status(202).json({ ok: true, bankrupt: output.payerBankrupt });
  } catch (error) {
    logger.error("pay_rent_failed", {
      error,
      game_id: gameId,
      user_id: userId,
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
