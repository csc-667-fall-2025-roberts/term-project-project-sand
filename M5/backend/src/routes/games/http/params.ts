import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";

export function requireParam(
  req: AuthenticatedRequest,
  res: Response,
  name: string,
): string | null {
  const params = req.params as Record<string, string | undefined>;
  const value = params[name];
  if (typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: `${name} is required` });
    return null;
  }
  return value;
}

export function parseIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}
