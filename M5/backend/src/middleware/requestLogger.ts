import type { NextFunction, Request, Response } from "express";
import logger from "../logger.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const durationMs = Date.now() - started;
    logger.info("http_request", {
      method,
      path: originalUrl,
      status: res.statusCode,
      duration_ms: durationMs,
    });
  });

  next();
}
