import { dashboardRoom, gameRoom, getIo, userRoom } from "./io.js";

export function emitGameStateUpdate(gameId: string, payload: unknown): void {
  getIo().to(gameRoom(gameId)).emit("game:state:update", payload);
}

export function emitTurnChanged(gameId: string, payload: unknown): void {
  getIo().to(gameRoom(gameId)).emit("game:turn:changed", payload);
}

export function emitPlayerJoined(gameId: string, payload: unknown): void {
  getIo().to(gameRoom(gameId)).emit("game:player:joined", payload);
}

export function emitPrivateOptions(userId: string, payload: unknown): void {
  getIo().to(userRoom(userId)).emit("game:player:options", payload);
}

export function emitPrivateBalanceUpdate(
  userId: string,
  payload: unknown,
): void {
  getIo().to(userRoom(userId)).emit("game:player:balance:update", payload);
}

export function emitGameEnded(gameId: string, payload: unknown): void {
  getIo().to(gameRoom(gameId)).emit("game:ended", payload);
}

export function emitDashboardChatMessage(payload: unknown): void {
  getIo().to(dashboardRoom()).emit("chat:dashboard:message", payload);
}

export function emitGameChatMessage(gameId: string, payload: unknown): void {
  getIo().to(gameRoom(gameId)).emit("chat:game:message", payload);
}
