import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { authRepository } from "../database/repositories/auth.js";
import logger from "../logger.js";
import { issueRefreshToken, signAccessToken } from "../services/authTokens.js";

interface LoginBody {
  email?: string;
  password?: string;
}

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

export async function login(
  req: Request<never, unknown, LoginBody>,
  res: Response<AuthResponse | ErrorResponse>,
) {
  const { email, password } = req.body ?? {};

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await authRepository.findByEmail(email);
    if (!result) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      result.auth.password_hash,
    );

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await issueRefreshToken(res, result.user.id);
    const token = signAccessToken(result.user);

    return res.json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.display_name,
      },
    });
  } catch (error) {
    logger.error("Failed to login user", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
}
