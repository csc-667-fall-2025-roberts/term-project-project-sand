import { Router } from "express";
import { whoami } from "./whoami.js";

export const router = Router().get("/whoami", whoami);
