import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { createGameAction } from "../../../services/gameActions/createGame.js";
import { parseTokenColor } from "../../../services/gameActions/shared/tokenColors.js";
import { requireUserId } from "../http/guards.js";
import { parseIntOrNull } from "../http/params.js";
import type { CreateGameBody } from "../http/bodyTypes.js";
import { emitEvents } from "../realtime.js";

export async function createGame(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const body = (req.body ?? {}) as CreateGameBody;
  const maxPlayersRaw = parseIntOrNull(body.max_players);
  const startingBalanceRaw = parseIntOrNull(body.starting_balance);

  const maxPlayers = maxPlayersRaw ?? 4;
  const startingBalance = startingBalanceRaw ?? 1500;

  if (maxPlayers < 2 || maxPlayers > 6) {
    return res
      .status(400)
      .json({ error: "max_players must be between 2 and 6" });
  }

  if (startingBalance <= 0 || startingBalance > 1_000_000) {
    return res
      .status(400)
      .json({ error: "starting_balance must be a positive integer" });
  }

  const tokenColorRaw = body.token_color?.trim();
  const tokenColor = tokenColorRaw ? parseTokenColor(tokenColorRaw) : "red";
  if (!tokenColor) {
    return res.status(400).json({ error: "token_color is invalid" });
  }

  try {
    const result = await pgPool.tx((t) =>
      createGameAction(t, {
        userId,
        name: body.name?.trim() || "",
        maxPlayers,
        startingBalance,
        tokenColor,
      }),
    );

    emitEvents([
      {
        kind: "playerJoined",
        gameId: result.game.id,
        payload: {
          game_id: result.game.id,
          player: {
            id: result.participant.id,
            username: req.user?.displayName ?? "Player",
            token_color: result.participant.token_color,
          },
          player_count: result.publicState.players.length,
          max_players: result.game.max_players,
        },
      },
      ...result.events,
    ]);

    return res.status(202).json({
      game_id: result.game.id,
      game_code: result.game.game_code,
      participant_id: result.participant.id,
    });
  } catch (error) {
    logger.error("create_game_failed", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
}
