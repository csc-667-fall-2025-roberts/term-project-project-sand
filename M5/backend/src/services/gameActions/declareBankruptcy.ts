import type { DbClient } from "../../database/dbClient.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { buildPublicGameState } from "../gameState.js";
import type { GameRealtimeEvent } from "./events.js";
import {
  computeCurrentTurnPlayer,
  declareBankruptToBank,
  maybeEndGameIfWinner,
  participantHasAnyProperties,
} from "./shared/gameProgression.js";
import { isRecord } from "./shared/typeGuards.js";

export type DeclareBankruptcyResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_participant" }
  | { kind: "no_pending" }
  | { kind: "wrong_pending" }
  | { kind: "must_sell_properties" }
  | { kind: "ok"; events: GameRealtimeEvent[] };

export async function declareBankruptcyAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    pendingActionId: string;
  },
): Promise<DeclareBankruptcyResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);

  const game = await gamesRepo.findByIdForUpdate(params.gameId);
  if (!game) return { kind: "not_found" };
  if (game.status !== "playing") return { kind: "bad_phase" };

  const participant = await participantsRepo.findByGameAndUserForUpdate(
    params.gameId,
    params.userId,
  );
  if (!participant) return { kind: "not_participant" };

  const pa = await pendingActionsRepo.findPendingForUpdate({
    id: params.pendingActionId,
    gameId: params.gameId,
    participantId: participant.id,
  });
  if (!pa) return { kind: "no_pending" };
  if (pa.action_type !== "pay_bank_debt" && pa.action_type !== "pay_rent") {
    return { kind: "wrong_pending" };
  }

  const hasProperties = await participantHasAnyProperties(
    db,
    params.gameId,
    participant.id,
  );
  if (hasProperties) return { kind: "must_sell_properties" };

  const currentBefore = await computeCurrentTurnPlayer(db, params.gameId);
  const wasCurrent = currentBefore?.participantId === participant.id;

  const payload = pa.payload_json;
  const turnId =
    isRecord(payload) && typeof payload["turn_id"] === "string"
      ? (payload["turn_id"] as string)
      : null;

  await pendingActionsRepo.markCompleted(pa.id);

  await declareBankruptToBank(db, {
    gameId: params.gameId,
    participantId: participant.id,
    reason: "Declared bankruptcy",
    turnId,
  });

  const end = await maybeEndGameIfWinner(db, params.gameId);
  const publicState = await buildPublicGameState(db, params.gameId);

  const nextTurn =
    wasCurrent && !end.ended
      ? await computeCurrentTurnPlayer(db, params.gameId)
      : null;

  const events: GameRealtimeEvent[] = [
    {
      kind: "gameStateUpdate",
      gameId: params.gameId,
      payload: publicState,
    },
  ];

  if (end.ended && end.winnerParticipantId) {
    events.push({
      kind: "gameEnded",
      gameId: params.gameId,
      payload: {
        game_id: params.gameId,
        winner_participant_id: end.winnerParticipantId,
      },
    });
  }

  if (
    wasCurrent &&
    nextTurn &&
    !end.ended &&
    publicState.phase === "playing" &&
    publicState.current_player_id
  ) {
    events.push({
      kind: "turnChanged",
      gameId: params.gameId,
      payload: {
        game_id: params.gameId,
        previous_player_id: participant.id,
        current_player_id: publicState.current_player_id,
        turn_number: publicState.turn_number,
      },
    });

    events.push({
      kind: "privateOptions",
      userId: nextTurn.userId,
      payload: {
        game_id: params.gameId,
        player_id: publicState.current_player_id,
        context: "start_turn",
        options: [{ action: "roll_dice" }],
      },
    });
  }

  return { kind: "ok", events };
}
