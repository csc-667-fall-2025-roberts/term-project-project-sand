import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import config from "../config.js";
import { authRepository } from "../database/repositories/auth.js";
import { usersRepository } from "../database/repositories/users.js";
import logger from "../logger.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
  } catch (error) {
    logger.warn("Invalid JWT", { error });
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userId = payload.sub;
  if (typeof userId !== "string") {
    return res.status(401).json({ error: "Invalid token payload" });
  }

  const user = await usersRepository.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const auth = await authRepository.findByUserId(user.id);
  if (!auth) {
    return res.status(404).json({ error: "Credentials not found" });
  }

  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };

  return next();
}
