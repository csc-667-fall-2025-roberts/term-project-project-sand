import { Router } from "express";
import { login } from "./login.js";
import { register } from "./register.js";
import { whoami } from "./whoami.js";
import { refresh, logout } from "./refresh.js";
import { health } from "./health.js";
import { authenticate } from "../middleware/authenticate.js";
import { gamesRouter } from "./games.js";
import { chatRouter } from "./chat.js";

const privateRouter = Router()
  .get("/whoami", whoami)
  .use(gamesRouter, chatRouter);
const publicRouter = Router()
  .get("/health", health)
  .post("/register", register)
  .post("/login", login)
  .post("/refresh", refresh)
  .post("/logout", logout);

export const router = Router()
  .use(publicRouter)
  .use(authenticate, privateRouter);
