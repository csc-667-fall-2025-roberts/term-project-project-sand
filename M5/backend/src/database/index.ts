import pgPromise from "pg-promise";
import config from "../config.js";

export const pgPool = pgPromise()(config.database.url);
