import pgPromise from "pg-promise";
import config from "../config.js";

export const pgp = pgPromise();
export const pgPool = pgp(config.database.url);
