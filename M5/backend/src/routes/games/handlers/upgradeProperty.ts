import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { upgradePropertyAction } from "../../../services/gameActions/upgradeProperty.js";
import { requireUserId } from "../http/guards.js";
import { requireParam } from "../http/params.js";
import { emitEvents } from "../realtime.js";

export async function upgradeProperty(req: AuthenticatedRequest, res: Response) {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = requireParam(req, res, "gameId");
    if (!gameId) return;
    const propertyId = requireParam(req, res, "propertyId");
    if (!propertyId) return;

    try {
        const output = await upgradePropertyAction(pgPool, {
            userId,
            gameId,
            propertyId
        });

        logger.error("output", output);
        if (output.kind === "not_found")
            return res.status(404).json({ error: "Game or property not found"});
        if (output.kind === "bad_phase")
            return res.status(409).json({ error: "Game is not in a playable phase"});
        if (output.kind === "not_participant")
            return res.status(403).json({ error: "Not a game participant"});
        if (output.kind === "not_your_turn")
            return res.status(409).json({ error: "Not your turn"});
        if (output.kind === "has_pending")
            return res.status(409).json({ error: "Resolve your pending action first"});
        if (output.kind === "not_owner")
            return res.status(403).json({ error: "You do not own this property"});
        if (output.kind === "not_upgradable")
            return res.status(409).json({ error: "This property is not upgradable"});
        if (output.kind === "max_level")
            return res.status(409).json({ error: "This property is already fully upgraded"});
        if (output.kind === "insufficient_funds")
            return res.status(409).json({ error: "Insufficient funds", required: output.required, cash: output.cash});

        emitEvents(output.events);
        return res.status(200).json({ ok: true});
    } catch (error) {
        logger.error("upgrade_property_failed", {
            error,
            game_id: gameId,
            user_id: userId
        });
        return res.status(500).json({ error: "Internal server error"});
    }
}