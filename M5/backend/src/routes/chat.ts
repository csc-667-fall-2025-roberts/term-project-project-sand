import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authenticate.js";
import logger from "../logger.js";
import { pgPool } from "../database/index.js";
import {
  emitDashboardChatMessage,
  emitGameChatMessage,
} from "../realtime/gateway.js";

interface SendMessageBody {
  message?: string;
}

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

async function requireGameParticipant(
  gameId: string,
  userId: string,
): Promise<boolean> {
  const row = await pgPool.oneOrNone(
    `
      SELECT 1
      FROM game_participants
      WHERE game_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [gameId, userId],
  );
  return Boolean(row);
}

export const chatRouter = Router()
  // Dashboard-wide chat
  .get("/chat/dashboard", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    try {
      const messages = await pgPool.manyOrNone<{
        id: string;
        message: string;
        created_at: Date;
        user_id: string;
        display_name: string;
      }>(
        `
          SELECT
            m.id,
            m.message,
            m.created_at,
            u.id AS user_id,
            u.display_name
          FROM dashboard_chat_messages m
          JOIN users u ON u.id = m.user_id
          ORDER BY m.created_at DESC
          LIMIT 50
        `,
      );

      return res.json({ messages: messages.reverse() });
    } catch (error) {
      logger.error("dashboard_chat_list_failed", { error, user_id: userId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/chat/dashboard", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const body = (req.body ?? {}) as SendMessageBody;
    const message = body.message?.trim();
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const row = await pgPool.one<{
        id: string;
        message: string;
        created_at: Date;
      }>(
        `
          INSERT INTO dashboard_chat_messages (user_id, message)
          VALUES ($1, $2)
          RETURNING id, message, created_at
        `,
        [userId, message],
      );

      emitDashboardChatMessage({
        id: row.id,
        message: row.message,
        created_at: row.created_at,
        user: {
          id: userId,
          displayName: req.user?.displayName ?? "Player",
        },
      });

      return res.status(202).json({ ok: true });
    } catch (error) {
      logger.error("dashboard_chat_send_failed", { error, user_id: userId });
      return res.status(500).json({ error: "Internal server error" });
    }
  })

  // Per-game chat (participants only)
  .get("/games/:gameId/chat", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = req.params["gameId"];
    if (!gameId) return res.status(400).json({ error: "gameId is required" });

    try {
      const allowed = await requireGameParticipant(gameId, userId);
      if (!allowed) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const messages = await pgPool.manyOrNone<{
        id: string;
        message: string;
        created_at: Date;
        user_id: string;
        display_name: string;
      }>(
        `
          SELECT
            m.id,
            m.message,
            m.created_at,
            u.id AS user_id,
            u.display_name
          FROM chat_messages m
          JOIN users u ON u.id = m.user_id
          WHERE m.game_id = $1
          ORDER BY m.created_at DESC
          LIMIT 50
        `,
        [gameId],
      );

      return res.json({ messages: messages.reverse() });
    } catch (error) {
      logger.error("game_chat_list_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .post("/games/:gameId/chat", async (req: AuthenticatedRequest, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const gameId = req.params["gameId"];
    if (!gameId) return res.status(400).json({ error: "gameId is required" });

    const body = (req.body ?? {}) as SendMessageBody;
    const message = body.message?.trim();
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const allowed = await requireGameParticipant(gameId, userId);
      if (!allowed) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const row = await pgPool.one<{
        id: string;
        message: string;
        created_at: Date;
      }>(
        `
          INSERT INTO chat_messages (game_id, user_id, message)
          VALUES ($1, $2, $3)
          RETURNING id, message, created_at
        `,
        [gameId, userId, message],
      );

      emitGameChatMessage(gameId, {
        id: row.id,
        game_id: gameId,
        message: row.message,
        created_at: row.created_at,
        user: {
          id: userId,
          displayName: req.user?.displayName ?? "Player",
        },
      });

      return res.status(202).json({ ok: true });
    } catch (error) {
      logger.error("game_chat_send_failed", {
        error,
        game_id: gameId,
        user_id: userId,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  });
