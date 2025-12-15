import type { Response } from "express";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../middleware/authenticate.js";

interface ErrorResponse {
  error: string;
}

export async function whoami(
  req: AuthenticatedRequest,
  res: Response<AuthenticatedUser | ErrorResponse>,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json(req.user);
}
