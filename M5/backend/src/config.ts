import "dotenv/config";

interface Config {
  host: string;
  port: number;
  isProduction: boolean;
  database: DatabaseConfig;
}

interface DatabaseConfig {
  url: string;
}

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl == undefined) throw new Error("DATABASE_URL is not set");

const config: Config = {
  host: process.env["HOST"] ?? "localhost",
  port: parseInt(process.env["PORT"] ?? "3000"),
  isProduction: process.env["NODE_ENV"] === "production",
  database: {
    url: databaseUrl,
  },
};

export default config;
