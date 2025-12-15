export type GameRealtimeEvent =
  | { kind: "gameStateUpdate"; gameId: string; payload: unknown }
  | { kind: "turnChanged"; gameId: string; payload: unknown }
  | { kind: "playerJoined"; gameId: string; payload: unknown }
  | { kind: "privateOptions"; userId: string; payload: unknown }
  | { kind: "privateBalanceUpdate"; userId: string; payload: unknown }
  | { kind: "gameEnded"; gameId: string; payload: unknown };
