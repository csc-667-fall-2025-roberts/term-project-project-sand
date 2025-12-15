import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";
import logger from "../../../logger.js";
import { pgPool } from "../../../database/index.js";
import { requireUserId } from "../http/guards.js";

export async function listGames(req: AuthenticatedRequest, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const games = await pgPool.manyOrNone<{
      id: string;
      name: string;
      game_code: string;
      status: string;
      max_players: number;
      created_at: Date;
      current_players: number;
      is_participant: boolean;
      participant_id: string | null;
    }>(
      `
          SELECT
            g.id,
            g.name,
            g.game_code,
            g.status,
            g.max_players,
            g.created_at,
            COUNT(gp.id)::int AS current_players,
            (mygp.id IS NOT NULL) AS is_participant,
            mygp.id AS participant_id
          FROM games g
          LEFT JOIN game_participants gp ON gp.game_id = g.id
          LEFT JOIN game_participants mygp
            ON mygp.game_id = g.id
           AND mygp.user_id = $1
          GROUP BY g.id, mygp.id
          ORDER BY g.created_at DESC
        `,
      [userId],
    );

    return res.json({ games });
  } catch (error) {
    logger.error("list_games_failed", { error, user_id: userId });
    return res.status(500).json({ error: "Internal server error" });
  }
}
