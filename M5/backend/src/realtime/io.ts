import type { Server as HttpServer } from "http";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import config from "../config.js";
import { pgPool } from "../database/index.js";
import logger from "../logger.js";
import { buildOptionsPayloadFromPendingAction } from "../services/pendingActionOptions.js";

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function gameRoom(gameId: string): string {
  return `game:${gameId}`;
}

export function dashboardRoom(): string {
  return "dashboard";
}

type AckResponse = { ok: true } | { ok: false; error: string };
type Ack = (response: AckResponse) => void;

function extractBearerToken(headerValue: unknown): string | null {
  if (typeof headerValue !== "string") return null;
  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function readHandshakeToken(socket: {
  handshake: { auth: unknown; headers: Record<string, unknown> };
}): string | null {
  const auth = socket.handshake.auth;
  if (auth && typeof auth === "object" && "token" in auth) {
    const token = (auth as { token?: unknown }).token;
    if (typeof token === "string" && token.trim()) return token;
  }

  return extractBearerToken(socket.handshake.headers["authorization"]);
}

async function isUserParticipantInGame(
  userId: string,
  gameId: string,
): Promise<boolean> {
  const query = `
    SELECT 1
    FROM game_participants
    WHERE user_id = $1
      AND game_id = $2
    LIMIT 1
  `;

  const row = await pgPool.oneOrNone(query, [userId, gameId]);
  return Boolean(row);
}

let ioInstance: Server | null = null;

export function initRealtime(httpServer: HttpServer): Server {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      credentials: true,
      origin: config.corsOrigins,
    },
  });

  ioInstance.use((socket, next) => {
    const token = readHandshakeToken(socket);
    if (!token) return next(new Error("Missing auth token"));

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    } catch (error) {
      logger.warn("socket_invalid_jwt", { error });
      return next(new Error("Invalid or expired token"));
    }

    const userId = payload.sub;
    if (typeof userId !== "string") {
      return next(new Error("Invalid token payload"));
    }

    socket.data.userId = userId;
    socket.join(userRoom(userId));
    return next();
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    logger.info("socket_connected", { socket_id: socket.id, user_id: userId });

    socket.join(dashboardRoom());

    socket.on(
      "game:room:join",
      async (data: unknown, ack?: Ack): Promise<void> => {
        try {
          if (!userId) {
            ack?.({ ok: false, error: "Unauthorized" });
            return;
          }

          const gameId =
            data && typeof data === "object" && "gameId" in data
              ? (data as { gameId?: unknown }).gameId
              : undefined;

          if (typeof gameId !== "string" || !gameId.trim()) {
            ack?.({ ok: false, error: "gameId is required" });
            return;
          }

          const allowed = await isUserParticipantInGame(userId, gameId);
          if (!allowed) {
            ack?.({ ok: false, error: "Not a participant in this game" });
            return;
          }

          await socket.join(gameRoom(gameId));

          // Best-effort: if the user has a pending action, emit options on join
          // so refresh/rejoin doesn't lose the action UI.
          try {
            const participant = await pgPool.oneOrNone<{ id: string }>(
              `
                SELECT id
                FROM game_participants
                WHERE user_id = $1 AND game_id = $2
                LIMIT 1
              `,
              [userId, gameId],
            );
            if (participant?.id) {
              const pending = await pgPool.oneOrNone<{
                id: string;
                action_type: string;
                payload_json: unknown;
              }>(
                `
                  SELECT id, action_type, payload_json
                  FROM pending_actions
                  WHERE game_id = $1 AND participant_id = $2 AND status = 'pending'
                  LIMIT 1
                `,
                [gameId, participant.id],
              );

              if (pending) {
                const optionsPayload =
                  await buildOptionsPayloadFromPendingAction(pgPool, {
                    gameId,
                    participantId: participant.id,
                    pendingAction: pending,
                    context: "pending_action",
                  });
                if (optionsPayload && ioInstance) {
                  ioInstance
                    .to(userRoom(userId))
                    .emit("game:player:options", optionsPayload);
                }
              }
            }
          } catch (error) {
            logger.warn("socket_emit_pending_options_failed", {
              error,
              user_id: userId,
              game_id: gameId,
            });
          }

          ack?.({ ok: true });
        } catch (error) {
          logger.error("socket_join_game_failed", { error, user_id: userId });
          ack?.({ ok: false, error: "Internal server error" });
        }
      },
    );

    socket.on("disconnect", (reason) => {
      logger.info("socket_disconnected", {
        socket_id: socket.id,
        user_id: userId,
        reason,
      });
    });
  });

  return ioInstance;
}

export function getIo(): Server {
  if (!ioInstance) {
    throw new Error("Socket.io is not initialized. Call initRealtime() first.");
  }
  return ioInstance;
}
