import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/authenticate.js";

export function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.user.id;
}
