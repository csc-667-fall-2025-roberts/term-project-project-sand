import type { Request, Response } from "express";
import { pgPool } from "../database/index.js";
import logger from "../logger.js";

interface HealthResponse {
  status: "ok";
}

interface ErrorResponse {
  error: string;
}

export async function health(
  _req: Request,
  res: Response<HealthResponse | ErrorResponse>,
) {
  try {
    await pgPool.one("select 1");
    return res.status(200).end();
  } catch (error) {
    logger.error("Healthcheck failed", { error });
    return res.status(503).json({ error: "Service unavailable" });
  }
}
