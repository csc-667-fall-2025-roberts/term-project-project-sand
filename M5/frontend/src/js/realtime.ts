import { io, type Socket } from "socket.io-client";
import { client } from "./api";

type Handler = (payload: unknown) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class RealtimeClient {
  private socket: Socket;
  private handlers = new Map<string, Set<Handler>>();
  private joinedGameIds = new Set<string>();

  constructor(socket: Socket) {
    this.socket = socket;

    const forward = (event: string) => {
      this.socket.on(event, (payload: unknown) => {
        const set = this.handlers.get(event);
        if (!set) return;
        for (const handler of set) {
          handler(payload);
        }
      });
    };

    forward("game:state:update");
    forward("game:turn:changed");
    forward("game:player:joined");
    forward("game:player:options");
    forward("game:player:balance:update");
    forward("game:ended");

    forward("chat:dashboard:message");
    forward("chat:game:message");

    this.socket.on("connect", () => {
      for (const gameId of this.joinedGameIds) {
        this.socket.emit("game:room:join", { gameId });
      }
    });
  }

  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set<Handler>();
      this.handlers.set(event, set);
    }
    set.add(handler);

    return () => {
      const existing = this.handlers.get(event);
      if (!existing) return;
      existing.delete(handler);
      if (existing.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  async joinGameRoom(gameId: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket.emit("game:room:join", { gameId }, (ack: unknown) => {
        if (isRecord(ack) && ack.ok === true) {
          this.joinedGameIds.add(gameId);
          resolve();
          return;
        }

        const error =
          isRecord(ack) && typeof ack.error === "string" && ack.error.trim()
            ? ack.error
            : "Unable to join game room";
        reject(new Error(error));
      });
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

let singleton: Promise<RealtimeClient> | null = null;
let singletonInstance: RealtimeClient | null = null;

function clearSingleton(): void {
  singleton = null;
  singletonInstance = null;
}

export async function connectRealtime(): Promise<RealtimeClient> {
  if (singleton) return singleton;

  singleton = (async () => {
    const origin =
      ((import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ?? "") ||
      window.location.origin;

    let token = await client.getSocketToken();
    if (!token) throw new Error("Missing socket auth token");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const socket = io(origin, {
        auth: { token },
        transports: ["websocket"],
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (error: unknown) => {
            socket.off("connect", onConnect);
            socket.off("connect_error", onError);
            clearSingleton();
            reject(error instanceof Error ? error : new Error("Socket error"));
          };

          const onConnect = () => {
            socket.off("connect_error", onError);
            resolve();
          };

          socket.on("connect", onConnect);
          socket.on("connect_error", onError);
        });

        const realtime = new RealtimeClient(socket);
        singletonInstance = realtime;

        socket.on("connect_error", () => {
          if (singletonInstance === realtime) clearSingleton();
        });

        socket.on("disconnect", (reason) => {
          if (singletonInstance !== realtime) return;
          if (reason === "io server disconnect") {
            clearSingleton();
          }
        });

        return realtime;
      } catch (error) {
        socket.disconnect();

        const message = error instanceof Error ? error.message : "";
        if (
          attempt === 0 &&
          message.toLowerCase().includes("invalid") &&
          message.toLowerCase().includes("token")
        ) {
          token = await client.getSocketToken();
          if (!token) throw new Error("Missing socket auth token");
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unable to connect to realtime server");
  })().catch((error) => {
    clearSingleton();
    throw error;
  });

  return singleton;
}
