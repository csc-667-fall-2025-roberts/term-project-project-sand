import cors from "cors";
import express from "express";
import { createServer } from "http";
import config from "./config.js";
import logger from "./logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { initRealtime } from "./realtime/io.js";
import { router } from "./routes/index.js";

logger.info("config", {
  host: config.host,
  port: config.port,
  isProduction: config.isProduction,
  corsOrigins: config.corsOrigins,
  auth: {
    jwtExpiresIn: config.auth.jwtExpiresIn,
    refreshTokenTtlDays: config.auth.refreshTokenTtlDays,
    refreshTokenCookieName: config.auth.refreshTokenCookieName,
    cookieSecure: config.auth.cookieSecure,
  },
});

const app = express();

app.use(
  cors({
    credentials: true,
    origin: config.corsOrigins,
  }),
);

app.use(requestLogger);
app.use(express.json());

app.use("/api", router);

const server = createServer(app);
initRealtime(server);

server.on("error", (error: unknown) => {
  logger.error("server_error", { error });
});

server.listen(config.port, config.host, () => {
  logger.info(`Server is running on http://${config.host}:${config.port}`);
});
