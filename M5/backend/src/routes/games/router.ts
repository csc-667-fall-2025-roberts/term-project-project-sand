import { Router } from "express";

import { deleteGame } from "./handlers/deleteGame.js";
import { listGames } from "./handlers/listGames.js";
import { joinAuto } from "./handlers/joinAuto.js";
import { createGame } from "./handlers/createGame.js";
import { joinByCode } from "./handlers/joinByCode.js";
import { joinGame } from "./handlers/joinGame.js";
import { startGame } from "./handlers/startGame.js";
import { getGameState } from "./handlers/getGameState.js";
import { rollTurn } from "./handlers/rollTurn.js";
import { buyProperty } from "./handlers/buyProperty.js";
import { payRent } from "./handlers/payRent.js";
import { payDebt } from "./handlers/payDebt.js";
import { declareBankruptcy } from "./handlers/declareBankruptcy.js";
import { sellProperty } from "./handlers/sellProperty.js";
import { upgradeProperty } from "./handlers/upgradeProperty.js";
import { endTurn } from "./handlers/endTurn.js";

export const gamesRouter = Router()
  .delete("/games/:gameId", deleteGame)
  .get("/games", listGames)
  .post("/games/:gameId/join-auto", joinAuto)
  .post("/games", createGame)
  .post("/games/join-by-code", joinByCode)
  .post("/games/:gameId/join", joinGame)
  .post("/games/:gameId/start", startGame)
  .get("/games/:gameId/state", getGameState)
  .post("/games/:gameId/turn/roll", rollTurn)
  .post("/games/:gameId/properties/:propertyId/buy", buyProperty)
  .post("/games/:gameId/properties/:propertyId/pay-rent", payRent)
  .post("/games/:gameId/debts/pay", payDebt)
  .post("/games/:gameId/debts/bankrupt", declareBankruptcy)
  .post("/games/:gameId/properties/:propertyId/sell", sellProperty)
  .post("/games/:gameId/properties/:propertyId/upgrade", upgradeProperty)
  .post("/games/:gameId/turn/end", endTurn);
