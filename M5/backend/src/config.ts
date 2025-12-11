import "dotenv/config";

interface Config {
  host: string;
  port: number;
  isProduction: boolean;
  database: DatabaseConfig;
  auth: AuthConfig;
}

interface DatabaseConfig {
  url: string;
}

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenTtlDays: number;
  refreshTokenCookieName: string;
}

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl == undefined) throw new Error("DATABASE_URL is not set");

const jwtSecret = process.env["JWT_SECRET"]?.trim();
if (!jwtSecret) throw new Error("JWT_SECRET is not set");

const config: Config = {
  host: process.env["HOST"] ?? "localhost",
  port: parseInt(process.env["PORT"] ?? "3000"),
  isProduction: process.env["NODE_ENV"] === "production",
  database: {
    url: databaseUrl,
  },
  auth: {
    jwtSecret,
    jwtExpiresIn: process.env["JWT_EXPIRES_IN"] ?? "1h",
    refreshTokenTtlDays: parseInt(
      process.env["REFRESH_TOKEN_TTL_DAYS"] ?? "30",
    ),
    refreshTokenCookieName:
      process.env["REFRESH_TOKEN_COOKIE_NAME"] ?? "refresh_token",
  },
};

export default config;
