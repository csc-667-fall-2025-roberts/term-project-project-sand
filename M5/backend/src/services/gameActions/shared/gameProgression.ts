import type { DbClient } from "../../../database/dbClient.js";
import { createGamesRepository } from "../../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../../database/repositories/gameParticipants.js";
import { createOwnershipsRepository } from "../../../database/repositories/ownerships.js";
import { createTransactionsRepository } from "../../../database/repositories/transactions.js";

export async function participantHasAnyProperties(
  db: DbClient,
  gameId: string,
  participantId: string,
): Promise<boolean> {
  const ownershipsRepo = createOwnershipsRepository(db);
  const count = await ownershipsRepo.countByParticipant(gameId, participantId);
  return count > 0;
}

export async function declareBankruptToBank(
  db: DbClient,
  params: {
    gameId: string;
    participantId: string;
    reason: string;
    turnId: string | null;
  },
): Promise<void> {
  const participantsRepo = createGameParticipantsRepository(db);
  const participant = await participantsRepo.findByIdAndGameForUpdate(
    params.participantId,
    params.gameId,
  );
  if (!participant) return;

  const paid = Math.max(0, participant.cash);

  await participantsRepo.applyBankruptcyReset(params.participantId);

  const ownershipsRepo = createOwnershipsRepository(db);
  await ownershipsRepo.deleteByParticipant(params.gameId, params.participantId);

  const transactionsRepo = createTransactionsRepository(db);
  await transactionsRepo.create({
    gameId: params.gameId,
    fromParticipantId: params.participantId,
    toParticipantId: null,
    amount: paid,
    transactionType: "bankruptcy",
    description: params.reason,
    turnId: params.turnId,
  });
}

export async function maybeEndGameIfWinner(
  db: DbClient,
  gameId: string,
): Promise<{ ended: boolean; winnerParticipantId: string | null }> {
  const gamesRepo = createGamesRepository(db);
  const game = await gamesRepo.findByIdForUpdate(gameId);
  if (!game) return { ended: false, winnerParticipantId: null };
  if (game.status !== "playing") {
    return { ended: false, winnerParticipantId: null };
  }

  const participantsRepo = createGameParticipantsRepository(db);
  const alive = await participantsRepo.listActiveByGame(gameId);

  if (alive.length !== 1) return { ended: false, winnerParticipantId: null };

  await gamesRepo.markEnded(gameId);

  const winner = alive[0];
  return { ended: true, winnerParticipantId: winner?.id ?? null };
}

export async function computeCurrentTurnPlayer(
  db: DbClient,
  gameId: string,
): Promise<{ participantId: string; userId: string } | null> {
  const gamesRepo = createGamesRepository(db);
  const game = await gamesRepo.findById(gameId);
  if (!game || game.status !== "playing") return null;

  const participantsRepo = createGameParticipantsRepository(db);
  const active = await participantsRepo.listActiveByGame(gameId);
  if (active.length === 0) return null;

  const idx =
    ((game.turn_index % active.length) + active.length) % active.length;
  const row = active[idx];
  return row ? { participantId: row.id, userId: row.user_id } : null;
}
