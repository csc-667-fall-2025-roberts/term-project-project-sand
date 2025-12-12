import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { authRepository } from "../database/repositories/auth.js";
import { usersRepository } from "../database/repositories/users.js";
import logger from "../logger.js";
import { issueRefreshToken, signAccessToken } from "../services/authTokens.js";

interface RegisterBody {
  email?: string;
  password?: string;
  displayName?: string;
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

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  return null;
}

export async function register(
  req: Request<never, unknown, RegisterBody>,
  res: Response<AuthResponse | ErrorResponse>,
) {
  const { email, password, displayName } = req.body ?? {};

  if (!email?.trim() || !password || !displayName?.trim()) {
    return res
      .status(400)
      .json({ error: "email, password, and displayName are required" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const existingUser = await usersRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await usersRepository.create(displayName.trim(), email);
    await authRepository.createCredential(user.id, passwordHash);

    await issueRefreshToken(res, user.id);
    const token = signAccessToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    logger.error("Failed to register user", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
}
