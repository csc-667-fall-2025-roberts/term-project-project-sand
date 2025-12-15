import {
  emitGameEnded,
  emitGameStateUpdate,
  emitPlayerJoined,
  emitPrivateBalanceUpdate,
  emitPrivateOptions,
  emitTurnChanged,
} from "../../realtime/gateway.js";
import type { GameRealtimeEvent } from "../../services/gameActions/events.js";

export function emitEvents(events: GameRealtimeEvent[]): void {
  for (const event of events) {
    switch (event.kind) {
      case "gameStateUpdate":
        emitGameStateUpdate(event.gameId, event.payload);
        break;
      case "turnChanged":
        emitTurnChanged(event.gameId, event.payload);
        break;
      case "playerJoined":
        emitPlayerJoined(event.gameId, event.payload);
        break;
      case "privateOptions":
        emitPrivateOptions(event.userId, event.payload);
        break;
      case "privateBalanceUpdate":
        emitPrivateBalanceUpdate(event.userId, event.payload);
        break;
      case "gameEnded":
        emitGameEnded(event.gameId, event.payload);
        break;
      default: {
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
  }
}
