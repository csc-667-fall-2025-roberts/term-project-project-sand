import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import * as cookie from "cookie";
import config from "../config.js";
import type { UserRecord } from "../database/repositories/users.js";
import { refreshTokensRepository } from "../database/repositories/refreshTokens.js";

const accessTokenOptions: SignOptions = {
  expiresIn: config.auth.jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>,
};

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: config.auth.cookieSecure,
  path: "/api",
};

export function signAccessToken(user: UserRecord): string {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.auth.jwtSecret,
    accessTokenOptions,
  );
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiresAt(): Date {
  const ttlMs = config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ttlMs);
}

export async function issueRefreshToken(
  res: Response,
  userId: string,
): Promise<void> {
  await refreshTokensRepository.deleteExpiredForUser(userId);

  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = refreshExpiresAt();

  await refreshTokensRepository.create(userId, tokenHash, expiresAt);

  res.cookie(config.auth.refreshTokenCookieName, token, {
    ...refreshCookieOptions,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.auth.refreshTokenCookieName, refreshCookieOptions);
}

export function readRefreshTokenFromRequest(req: Request): string | null {
  const rawCookieHeader = req.headers["cookie"];
  if (!rawCookieHeader) return null;

  const cookies = cookie.parse(rawCookieHeader);
  const token = cookies[config.auth.refreshTokenCookieName];
  return token ?? null;
}
