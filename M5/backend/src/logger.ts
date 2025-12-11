import { createLogger, format, transports } from "winston";
import config from "./config.js";

const level = config.isProduction ? "info" : "debug";

const now = new Date().getTime();
const logsDir = config.isProduction ? `/tmp/backend-${now}/logs` : "logs";

const logger = createLogger({
  level,
  format: format.combine(format.colorize(), format.timestamp(), format.json()),
  transports: [
    new transports.File({ filename: `${logsDir}/error.log`, level: "error" }),
    new transports.File({ filename: `${logsDir}/combined.log` }),
  ],
});

if (!config.isProduction) {
  logger.add(
    new transports.Console({
      format: format.simple(),
    }),
  );
}

export default logger;
