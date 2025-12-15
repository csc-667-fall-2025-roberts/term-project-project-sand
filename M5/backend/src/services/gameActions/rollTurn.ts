import { randomInt } from "crypto";

import type { DbClient } from "../../database/dbClient.js";
import { createCardDecksRepository } from "../../database/repositories/cardDecks.js";
import { createCardDrawsRepository } from "../../database/repositories/cardDraws.js";
import { createCardsRepository } from "../../database/repositories/cards.js";
import { createGamesRepository } from "../../database/repositories/games.js";
import { createGameParticipantsRepository } from "../../database/repositories/gameParticipants.js";
import { createOwnershipsRepository } from "../../database/repositories/ownerships.js";
import { createPendingActionsRepository } from "../../database/repositories/pendingActions.js";
import { createTilesRepository } from "../../database/repositories/tiles.js";
import { createTransactionsRepository } from "../../database/repositories/transactions.js";
import { createTurnsRepository } from "../../database/repositories/turns.js";
import { buildPublicGameState } from "../gameState.js";
import { buildOptionsPayloadFromPendingAction } from "../pendingActionOptions.js";
import type { GameRealtimeEvent } from "./events.js";
import { computeRent, taxForTileName } from "./shared/gameMath.js";
import {
  computeCurrentTurnPlayer,
  declareBankruptToBank,
  maybeEndGameIfWinner,
} from "./shared/gameProgression.js";
import { isRecord, toFiniteNumber } from "./shared/typeGuards.js";

type PendingActionSummary = {
  id: string;
  type: string;
  tile_id?: string;
  amount?: number;
} | null;

type RollTurnTxResult =
  | { kind: "not_found" }
  | { kind: "bad_phase" }
  | { kind: "not_your_turn" }
  | { kind: "has_pending" }
  | { kind: "bad_state" }
  | { kind: "no_goojf" }
  | { kind: "insufficient_jail_fee" }
  | {
      kind: "ok";
      dice: [number, number];
      previous_position: number;
      new_position: number;
      participant_id: string;
      user_id: string;
      balance: number;
      publicState: Awaited<ReturnType<typeof buildPublicGameState>>;
      optionsPayload: unknown | null;
      pendingAction: PendingActionSummary;
      messages: string[];
      ended: boolean;
      winnerParticipantId: string | null;
      bankruptTurnAdvanced: boolean;
      nextTurn: { participantId: string; userId: string } | null;
    };

export type RollTurnResult =
  | Exclude<RollTurnTxResult, { kind: "ok" }>
  | {
      kind: "ok";
      dice: [number, number];
      previous_position: number;
      new_position: number;
      pending_action: PendingActionSummary;
      messages: string[];
      events: GameRealtimeEvent[];
    };

export async function rollTurnAction(
  db: DbClient,
  params: {
    gameId: string;
    userId: string;
    payToLeaveJail: boolean;
    useGoojf: boolean;
  },
): Promise<RollTurnResult> {
  const gamesRepo = createGamesRepository(db);
  const participantsRepo = createGameParticipantsRepository(db);
  const pendingActionsRepo = createPendingActionsRepository(db);
  const turnsRepo = createTurnsRepository(db);
  const tilesRepo = createTilesRepository(db);
  const ownershipsRepo = createOwnershipsRepository(db);
  const transactionsRepo = createTransactionsRepository(db);
  const cardDecksRepo = createCardDecksRepository(db);
  const cardsRepo = createCardsRepository(db);
  const cardDrawsRepo = createCardDrawsRepository(db);

  const output: RollTurnTxResult =
    await (async (): Promise<RollTurnTxResult> => {
      const game = await gamesRepo.findByIdForUpdate(params.gameId);
      if (!game) return { kind: "not_found" };
      if (game.status !== "playing") return { kind: "bad_phase" };

      const participants = await participantsRepo.listByGameForUpdate(
        params.gameId,
      );
      const active = participants.filter((p) => !p.is_bankrupt);
      if (active.length === 0) return { kind: "bad_state" };

      const turnIndex = game.turn_index % active.length;
      const current = active[turnIndex];
      if (!current) return { kind: "bad_state" };
      if (current.user_id !== params.userId) return { kind: "not_your_turn" };

      const existingPending = await pendingActionsRepo.findPendingByParticipant(
        params.gameId,
        current.id,
      );
      if (existingPending) return { kind: "has_pending" };

      const die1 = randomInt(1, 7);
      const die2 = randomInt(1, 7);
      const total = die1 + die2;
      const isDouble = die1 === die2;

      const messages: string[] = [];
      const actionNotes: string[] = [];

      const prevPos = current.position;
      let newPos = (prevPos + total) % 40;

      const inJailBefore = Boolean(current.in_jail);
      const jailTurns = Math.max(0, Math.trunc(current.jail_turns));
      const goojfCards = Math.max(0, Math.trunc(current.goojf_cards));

      let jailFee = 0;
      let usedGoojf = false;

      if (inJailBefore) {
        if (params.useGoojf) {
          if (goojfCards <= 0) return { kind: "no_goojf" };
          usedGoojf = true;
          await participantsRepo.useGoojfAndReleaseFromJail(current.id);
          const note = "Used Get Out of Jail Free.";
          messages.push(note);
          actionNotes.push(note);
        } else if (params.payToLeaveJail) {
          if (current.cash < 50) return { kind: "insufficient_jail_fee" };
          jailFee = 50;
          await participantsRepo.payJailFeeAndRelease(current.id, 50);
          const note = "Paid $50 to leave jail.";
          messages.push(note);
          actionNotes.push(note);
        }
      }

      const inJailStill =
        inJailBefore &&
        !params.payToLeaveJail &&
        !(params.useGoojf && usedGoojf);

      if (inJailStill && !isDouble && jailTurns < 2) {
        messages.push(`You rolled ${die1} and ${die2} (${total}).`);
        messages.push("No doubles. You remain in jail.");

        await participantsRepo.incrementJailTurns(current.id);

        const turnNumber = (await turnsRepo.lastTurnNumber(params.gameId)) + 1;
        await turnsRepo.create({
          gameId: params.gameId,
          participantId: current.id,
          turnNumber,
          diceRoll1: die1,
          diceRoll2: die2,
          isDouble,
          previousPosition: prevPos,
          newPosition: newPos,
          actionTaken: `In jail (${jailTurns + 1}/3)`,
        });

        const publicState = await buildPublicGameState(db, params.gameId);
        const balance = (await participantsRepo.findCashById(current.id)) ?? 0;

        return {
          kind: "ok",
          dice: [die1, die2],
          previous_position: prevPos,
          new_position: newPos,
          participant_id: current.id,
          user_id: params.userId,
          balance,
          publicState,
          optionsPayload: null,
          pendingAction: null,
          messages,
          ended: false,
          winnerParticipantId: null,
          bankruptTurnAdvanced: false,
          nextTurn: null,
        };
      }

      if (inJailStill && isDouble) {
        messages.push(`You rolled ${die1} and ${die2} (${total}).`);
        messages.push("Doubles! You are released from jail.");
        actionNotes.push("Released from jail (doubles).");
        await participantsRepo.releaseFromJail(current.id);
      }

      if (inJailStill && !isDouble && jailTurns >= 2) {
        messages.push(`You rolled ${die1} and ${die2} (${total}).`);
        messages.push("No doubles on your third attempt. You must pay $50.");
        if (current.cash < 50) {
          const note = "Bankrupt: unable to pay $50 after third jail attempt.";
          messages.push(note);
          actionNotes.push(note);

          const turnNumber =
            (await turnsRepo.lastTurnNumber(params.gameId)) + 1;
          const turn = await turnsRepo.create({
            gameId: params.gameId,
            participantId: current.id,
            turnNumber,
            diceRoll1: die1,
            diceRoll2: die2,
            isDouble,
            previousPosition: prevPos,
            newPosition: prevPos,
            actionTaken: note,
          });

          await declareBankruptToBank(db, {
            gameId: params.gameId,
            participantId: current.id,
            reason: "Unable to pay $50 after third jail attempt",
            turnId: turn.id,
          });

          const end = await maybeEndGameIfWinner(db, params.gameId);
          const publicState = await buildPublicGameState(db, params.gameId);
          const nextTurn = end.ended
            ? null
            : await computeCurrentTurnPlayer(db, params.gameId);

          return {
            kind: "ok",
            dice: [die1, die2],
            previous_position: prevPos,
            new_position: prevPos,
            participant_id: current.id,
            user_id: params.userId,
            balance: 0,
            publicState,
            optionsPayload: null,
            pendingAction: null,
            messages,
            ended: end.ended,
            winnerParticipantId: end.winnerParticipantId,
            bankruptTurnAdvanced: true,
            nextTurn,
          };
        }

        jailFee = 50;
        await participantsRepo.payJailFeeAndRelease(current.id, 50);
        actionNotes.push("Paid $50 to leave jail (3rd attempt).");
      }

      const passedGoByRoll = prevPos + total >= 40;
      let cashDelta = 0;
      if (passedGoByRoll) cashDelta += 200;

      if (cashDelta !== 0) {
        await participantsRepo.incrementCash(current.id, cashDelta);
      }

      await participantsRepo.updatePosition(current.id, newPos);

      const turnNumber = (await turnsRepo.lastTurnNumber(params.gameId)) + 1;
      const turn = await turnsRepo.create({
        gameId: params.gameId,
        participantId: current.id,
        turnNumber,
        diceRoll1: die1,
        diceRoll2: die2,
        isDouble,
        previousPosition: prevPos,
        newPosition: newPos,
        actionTaken: null,
      });

      if (jailFee !== 0) {
        await transactionsRepo.create({
          gameId: params.gameId,
          fromParticipantId: current.id,
          toParticipantId: null,
          amount: jailFee,
          transactionType: "jail_fee",
          description: "Paid $50 to get out of jail",
          turnId: turn.id,
        });
      }

      if (cashDelta !== 0) {
        await transactionsRepo.create({
          gameId: params.gameId,
          fromParticipantId: null,
          toParticipantId: current.id,
          amount: cashDelta,
          transactionType: "pass_go",
          description: "Passed GO",
          turnId: turn.id,
        });
      }

      let pendingAction: PendingActionSummary = null;
      let optionsPayload: unknown | null = null;

      if (messages.length === 0) {
        messages.push(`You rolled ${die1} and ${die2} (${total}).`);
      }

      const tileAtPos = await tilesRepo.findByPosition(newPos);
      if (
        tileAtPos &&
        (tileAtPos.tile_type === "chance" ||
          tileAtPos.tile_type === "community_chest")
      ) {
        const deckType =
          tileAtPos.tile_type === "chance" ? "chance" : "community_chest";

        const deck = await cardDecksRepo.findByGameAndTypeForUpdate(
          params.gameId,
          deckType,
        );
        if (deck) {
          const cardsCount = await cardsRepo.countByDeckType(deckType);
          if (cardsCount > 0) {
            const cardOrder = (deck.current_index % cardsCount) + 1;
            const card = await cardsRepo.findByDeckTypeAndOrder(
              deckType,
              cardOrder,
            );
            if (card) {
              await cardDecksRepo.advanceIndex(deck.id, deck.current_index + 1);
              await cardDrawsRepo.create({
                gameId: params.gameId,
                cardDeckId: deck.id,
                cardId: card.id,
                participantId: current.id,
                turnId: turn.id,
              });

              const cardLine = `${deckType === "chance" ? "Chance" : "Community Chest"}: ${String(
                card.message ?? "",
              )}`;
              messages.push(cardLine);
              actionNotes.push(cardLine);

              const actionType = card.action_type;
              const actionValue = card.action_value;
              let actionPayload: unknown = null;
              if (actionValue) {
                try {
                  actionPayload = JSON.parse(actionValue) as unknown;
                } catch {
                  actionPayload = null;
                }
              }

              const payloadAmount = isRecord(actionPayload)
                ? toFiniteNumber(actionPayload["amount"])
                : null;

              if (actionType === "collect" && payloadAmount != null) {
                const amount = payloadAmount;
                if (Number.isFinite(amount) && amount > 0) {
                  await participantsRepo.incrementCash(current.id, amount);
                  await transactionsRepo.create({
                    gameId: params.gameId,
                    fromParticipantId: null,
                    toParticipantId: current.id,
                    amount,
                    transactionType: "card",
                    description: card.message,
                    turnId: turn.id,
                  });
                }
              }

              if (actionType === "pay" && payloadAmount != null) {
                const amount = payloadAmount;
                if (Number.isFinite(amount) && amount > 0) {
                  const cashRow =
                    await participantsRepo.findByIdAndGameForUpdate(
                      current.id,
                      params.gameId,
                    );
                  const cash = cashRow?.cash ?? 0;
                  if (cash < amount) {
                    const pa = await pendingActionsRepo.create({
                      gameId: params.gameId,
                      participantId: current.id,
                      actionType: "pay_bank_debt",
                      payload: {
                        amount,
                        transaction_type: "card",
                        description: card.message,
                        turn_id: turn.id,
                      },
                    });

                    pendingAction = {
                      id: pa.id,
                      type: "pay_bank_debt",
                      amount,
                    };
                    optionsPayload = await buildOptionsPayloadFromPendingAction(
                      db,
                      {
                        gameId: params.gameId,
                        participantId: current.id,
                        pendingAction: {
                          id: pa.id,
                          action_type: "pay_bank_debt",
                          payload_json: { amount, description: card.message },
                        },
                        context: "pay_bank_debt",
                      },
                    );

                    messages.push(
                      `Card payment due: $${amount}. Sell properties, then pay.`,
                    );
                    actionNotes.push(
                      `Card debt pending: $${amount}. ${String(card.message ?? "")}`,
                    );

                    const end = await maybeEndGameIfWinner(db, params.gameId);
                    const publicState = await buildPublicGameState(
                      db,
                      params.gameId,
                    );

                    return {
                      kind: "ok",
                      dice: [die1, die2],
                      previous_position: prevPos,
                      new_position: newPos,
                      participant_id: current.id,
                      user_id: params.userId,
                      balance: cash,
                      publicState,
                      optionsPayload,
                      pendingAction,
                      messages,
                      ended: end.ended,
                      winnerParticipantId: end.winnerParticipantId,
                      bankruptTurnAdvanced: false,
                      nextTurn: null,
                    };
                  }

                  await participantsRepo.decrementCash(current.id, amount);
                  await transactionsRepo.create({
                    gameId: params.gameId,
                    fromParticipantId: current.id,
                    toParticipantId: null,
                    amount,
                    transactionType: "card",
                    description: card.message,
                    turnId: turn.id,
                  });
                }
              }

              const payloadPosition = isRecord(actionPayload)
                ? toFiniteNumber(actionPayload["position"])
                : null;

              if (actionType === "move" && payloadPosition != null) {
                const dest = Math.trunc(payloadPosition);
                if (dest >= 0 && dest < 40) {
                  const fromPos = newPos;
                  const passingGo =
                    isRecord(actionPayload) &&
                    Boolean(actionPayload["collect_pass_go"]) &&
                    dest < fromPos;

                  if (passingGo) {
                    await participantsRepo.incrementCash(current.id, 200);
                    await transactionsRepo.create({
                      gameId: params.gameId,
                      fromParticipantId: null,
                      toParticipantId: current.id,
                      amount: 200,
                      transactionType: "pass_go",
                      description: "Passed GO (card)",
                      turnId: turn.id,
                    });
                  }

                  await participantsRepo.updatePosition(current.id, dest);
                  newPos = dest;
                }
              }

              if (actionType === "go_to_jail") {
                await participantsRepo.goToJail(current.id);
                newPos = 9;
                messages.push("Go to Jail.");
                actionNotes.push("Go to Jail.");
              }

              if (actionType === "get_out_of_jail_free") {
                await participantsRepo.incrementGoojfCards(current.id, 1);
                const note = "Received a Get Out of Jail Free card.";
                messages.push(note);
                actionNotes.push(note);
              }
            }
          }
        }
      }

      const landed = await tilesRepo.findByPosition(newPos);
      if (landed && landed.tile_type === "go_to_jail") {
        await participantsRepo.goToJail(current.id);
        newPos = 9;
        messages.push("Go to Jail.");
        actionNotes.push("Go to Jail.");
      }

      if (prevPos !== newPos) {
        messages.push(`Moved from ${prevPos} to ${newPos}.`);
      } else {
        messages.push(`Stayed on ${newPos}.`);
      }

      const actionText =
        actionNotes.length > 0 ? actionNotes.join(" | ") : null;
      await turnsRepo.updateOutcome(turn.id, {
        newPosition: newPos,
        actionTaken: actionText,
      });

      if (landed && landed.tile_type === "tax") {
        const amount = taxForTileName(String(landed.name));
        const cashRow = await participantsRepo.findByIdAndGameForUpdate(
          current.id,
          params.gameId,
        );
        const cash = cashRow?.cash ?? 0;

        if (cash < amount) {
          const pa = await pendingActionsRepo.create({
            gameId: params.gameId,
            participantId: current.id,
            actionType: "pay_bank_debt",
            payload: {
              amount,
              transaction_type: "tax",
              description: landed.name,
              turn_id: turn.id,
            },
          });

          pendingAction = { id: pa.id, type: "pay_bank_debt", amount };
          optionsPayload = await buildOptionsPayloadFromPendingAction(db, {
            gameId: params.gameId,
            participantId: current.id,
            pendingAction: {
              id: pa.id,
              action_type: "pay_bank_debt",
              payload_json: { amount, description: landed.name },
            },
            context: "pay_bank_debt",
          });

          messages.push(
            `${String(landed.name)} due: $${amount}. Sell properties, then pay.`,
          );
        } else {
          await participantsRepo.decrementCash(current.id, amount);
          await transactionsRepo.create({
            gameId: params.gameId,
            fromParticipantId: current.id,
            toParticipantId: null,
            amount,
            transactionType: "tax",
            description: landed.name,
            turnId: turn.id,
          });
        }
      }

      if (
        landed &&
        (landed.tile_type === "property" ||
          landed.tile_type === "railroad" ||
          landed.tile_type === "utility")
      ) {
        const purchasePrice = landed.purchase_price;
        if (purchasePrice != null && purchasePrice > 0) {
          const ownership = await ownershipsRepo.findByGameAndTile(
            params.gameId,
            landed.id,
          );
          if (!ownership) {
            const pa = await pendingActionsRepo.create({
              gameId: params.gameId,
              participantId: current.id,
              actionType: "buy_property",
              payload: { tile_id: landed.id, cost: purchasePrice },
            });

            pendingAction = {
              id: pa.id,
              type: "buy_property",
              tile_id: landed.id,
            };
            optionsPayload = await buildOptionsPayloadFromPendingAction(db, {
              gameId: params.gameId,
              participantId: current.id,
              pendingAction: {
                id: pa.id,
                action_type: "buy_property",
                payload_json: { tile_id: landed.id, cost: purchasePrice },
              },
              context: "landed_on_unowned_property",
            });
          } else if (ownership.participant_id !== current.id) {
            const rent = computeRent({
              rent_base: landed.rent_base,
              purchase_price: landed.purchase_price,
            });

            const pa = await pendingActionsRepo.create({
              gameId: params.gameId,
              participantId: current.id,
              actionType: "pay_rent",
              payload: {
                tile_id: landed.id,
                owner_participant_id: ownership.participant_id,
                amount: rent,
              },
            });

            pendingAction = {
              id: pa.id,
              type: "pay_rent",
              tile_id: landed.id,
              amount: rent,
            };
            optionsPayload = await buildOptionsPayloadFromPendingAction(db, {
              gameId: params.gameId,
              participantId: current.id,
              pendingAction: {
                id: pa.id,
                action_type: "pay_rent",
                payload_json: {
                  tile_id: landed.id,
                  owner_participant_id: ownership.participant_id,
                  amount: rent,
                },
              },
              context: "pay_rent",
            });
          }
        }
      }

      const end = await maybeEndGameIfWinner(db, params.gameId);
      const publicState = await buildPublicGameState(db, params.gameId);
      const balance = (await participantsRepo.findCashById(current.id)) ?? 0;

      return {
        kind: "ok",
        dice: [die1, die2],
        previous_position: prevPos,
        new_position: newPos,
        participant_id: current.id,
        user_id: params.userId,
        balance,
        publicState,
        optionsPayload,
        pendingAction,
        messages,
        ended: end.ended,
        winnerParticipantId: end.winnerParticipantId,
        bankruptTurnAdvanced: false,
        nextTurn: null,
      };
    })();

  if (output.kind !== "ok") return output;

  const events: GameRealtimeEvent[] = [
    {
      kind: "gameStateUpdate",
      gameId: params.gameId,
      payload: output.publicState,
    },
    {
      kind: "privateBalanceUpdate",
      userId: params.userId,
      payload: {
        game_id: params.gameId,
        player_id: output.participant_id,
        balance: output.balance,
      },
    },
  ];

  if (output.optionsPayload) {
    events.push({
      kind: "privateOptions",
      userId: params.userId,
      payload: output.optionsPayload,
    });
  }

  if (output.ended && output.winnerParticipantId) {
    events.push({
      kind: "gameEnded",
      gameId: params.gameId,
      payload: {
        game_id: params.gameId,
        winner_participant_id: output.winnerParticipantId,
      },
    });
  }

  if (
    output.bankruptTurnAdvanced &&
    output.nextTurn &&
    !output.ended &&
    output.publicState.phase === "playing" &&
    output.publicState.current_player_id
  ) {
    events.push({
      kind: "turnChanged",
      gameId: params.gameId,
      payload: {
        game_id: params.gameId,
        previous_player_id: output.participant_id,
        current_player_id: output.publicState.current_player_id,
        turn_number: output.publicState.turn_number,
      },
    });

    events.push({
      kind: "privateOptions",
      userId: output.nextTurn.userId,
      payload: {
        game_id: params.gameId,
        player_id: output.publicState.current_player_id,
        context: "start_turn",
        options: [{ action: "roll_dice" }],
      },
    });
  }

  return {
    kind: "ok",
    dice: output.dice,
    previous_position: output.previous_position,
    new_position: output.new_position,
    pending_action: output.pendingAction,
    messages: output.messages,
    events,
  };
}
