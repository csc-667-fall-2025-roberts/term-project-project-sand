import cors from "cors";
import express from "express";
import config from "./config.js";
import logger from "./logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { router } from "./routes/index.js";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: [
      "http://localhost",
      "http://localhost:4173",
      "http://localhost:5173",
    ],
  }),
);

app.use(requestLogger);
app.use(express.json());

app.use("/api", router);

app.listen(config.port, config.host, (error) => {
  if (error) {
    logger.error(error);
    return;
  }
  logger.info(`Server is running on http://${config.host}:${config.port}`);
});
