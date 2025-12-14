import "dotenv/config";

interface Config {
  host: string;
  port: number;
  isProduction: boolean;
  corsOrigins: string[];
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
  cookieSecure: boolean;
}

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl == undefined) throw new Error("DATABASE_URL is not set");

const jwtSecret = process.env["JWT_SECRET"]?.trim();
if (!jwtSecret) throw new Error("JWT_SECRET is not set");

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

const defaultDevOrigins = [
  "http://localhost",
  "http://localhost:4173",
  "http://localhost:5173",
];

const isProduction = process.env["NODE_ENV"] === "production";
const corsOriginsEnv = parseCorsOrigins(process.env["CORS_ORIGINS"]);
const corsOrigins =
  corsOriginsEnv.length > 0
    ? corsOriginsEnv
    : isProduction
      ? []
      : defaultDevOrigins;

if (isProduction && corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS is not set (required in production)");
}

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value == null) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

const cookieSecure = parseBoolean(process.env["COOKIE_SECURE"], isProduction);

const config: Config = {
  host: process.env["HOST"] ?? "localhost",
  port: parseInt(process.env["PORT"] ?? "3000"),
  isProduction,
  corsOrigins,
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
    cookieSecure,
  },
};

export default config;
