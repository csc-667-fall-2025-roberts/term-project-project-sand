import type { Request, Response } from "express";
import {
  clearRefreshCookie,
  hashRefreshToken,
  issueRefreshToken,
  readRefreshTokenFromRequest,
  signAccessToken,
} from "../services/authTokens.js";
import { refreshTokensRepository } from "../database/repositories/refreshTokens.js";
import logger from "../logger.js";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

interface ErrorResponse {
  error: string;
}

export async function refresh(
  req: Request,
  res: Response<AuthResponse | ErrorResponse>,
) {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) {
    return res.status(401).json({ error: "Missing refresh token" });
  }

  const tokenHash = hashRefreshToken(refreshToken);

  try {
    const record = await refreshTokensRepository.findValidByHash(tokenHash);
    if (!record) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    await refreshTokensRepository.revokeById(record.token.id);
    await issueRefreshToken(res, record.user.id);

    const accessToken = signAccessToken(record.user);

    return res.json({
      token: accessToken,
      user: {
        id: record.user.id,
        email: record.user.email,
        displayName: record.user.display_name,
      },
    });
  } catch (error) {
    logger.error("Failed to refresh token", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function logout(
  req: Request,
  res: Response<{ success: true } | ErrorResponse>,
) {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) {
    clearRefreshCookie(res);
    return res.status(204).end();
  }

  const tokenHash = hashRefreshToken(refreshToken);

  try {
    await refreshTokensRepository.revokeByHash(tokenHash);
  } catch (error) {
    logger.warn("Failed to revoke refresh token on logout", { error });
  }

  clearRefreshCookie(res);
  return res.status(204).end();
}
