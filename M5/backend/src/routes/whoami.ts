import type { Response } from "express";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../middleware/authenticate.js";

interface WhoAmIResponse {
  user: AuthenticatedUser;
}

interface ErrorResponse {
  error: string;
}

export async function whoami(
  req: AuthenticatedRequest,
  res: Response<WhoAmIResponse | ErrorResponse>,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    user: req.user,
  });
}
