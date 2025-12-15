import type { DbClient } from "../database/dbClient.js";
import { createGameParticipantsRepository } from "../database/repositories/gameParticipants.js";
import { createOwnershipsRepository } from "../database/repositories/ownerships.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(payload: unknown, key: string): number | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function canDeclareBankruptcy(
  db: DbClient,
  params: { gameId: string; participantId: string },
): Promise<boolean> {
  const ownershipsRepo = createOwnershipsRepository(db);
  const count = await ownershipsRepo.countByParticipant(
    params.gameId,
    params.participantId,
  );
  return count === 0;
}

export type PendingActionType = "buy_property" | "pay_rent" | "pay_bank_debt";

export interface PendingActionRow {
  id: string;
  action_type: string;
  payload_json: unknown;
}

export interface PlayerOptionsPayload {
  game_id: string;
  player_id: string;
  context: string;
  options: Record<string, unknown>[];
}

export async function buildOptionsPayloadFromPendingAction(
  db: DbClient,
  params: {
    gameId: string;
    participantId: string;
    pendingAction: PendingActionRow;
    context?: string;
  },
): Promise<PlayerOptionsPayload | null> {
  const context = params.context ?? "pending_action";

  const type = params.pendingAction.action_type;
  const payload = params.pendingAction.payload_json;

  if (type === "buy_property") {
    const tileId = readString(payload, "tile_id") ?? "";
    const cost = readNumber(payload, "cost");
    return {
      game_id: params.gameId,
      player_id: params.participantId,
      context,
      options: [
        {
          action: "buy_property",
          property_id: tileId,
          cost,
          pending_action_id: params.pendingAction.id,
        },
        { action: "skip_purchase", pending_action_id: params.pendingAction.id },
      ],
    };
  }

  if (type === "pay_rent") {
    const tileId = readString(payload, "tile_id") ?? "";
    const amount = readNumber(payload, "amount");
    const options: Record<string, unknown>[] = [
      {
        action: "pay_rent",
        property_id: tileId,
        amount,
        pending_action_id: params.pendingAction.id,
      },
    ];

    // If you can't pay rent and have no properties to sell, allow bankruptcy to unblock the game.
    if (amount != null && amount > 0) {
      const participantsRepo = createGameParticipantsRepository(db);
      const cash =
        (await participantsRepo.findCashByIdAndGame(
          params.participantId,
          params.gameId,
        )) ?? 0;
      if (cash < amount && (await canDeclareBankruptcy(db, params))) {
        options.push({
          action: "declare_bankruptcy",
          pending_action_id: params.pendingAction.id,
        });
      }
    }

    return {
      game_id: params.gameId,
      player_id: params.participantId,
      context,
      options,
    };
  }

  if (type === "pay_bank_debt") {
    const amount = readNumber(payload, "amount");
    const description = readString(payload, "description") ?? "Bank debt";
    const options: Record<string, unknown>[] = [
      {
        action: "pay_bank_debt",
        amount,
        description,
        pending_action_id: params.pendingAction.id,
      },
    ];

    if (await canDeclareBankruptcy(db, params)) {
      options.push({
        action: "declare_bankruptcy",
        pending_action_id: params.pendingAction.id,
      });
    }

    return {
      game_id: params.gameId,
      player_id: params.participantId,
      context,
      options,
    };
  }

  return null;
}
