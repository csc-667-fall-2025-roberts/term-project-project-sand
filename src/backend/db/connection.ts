import { configDotenv } from "dotenv";
import pgPromise from "pg-promise";

configDotenv(); // Load .env file contents into process.env

const connectionString = process.env.DATABASE_URL; // es:password@localhost:5432/sand";
if (connectionString == undefined) {
  throw " Connection string is undefined ";
}

const db = pgPromise()(connectionString);

export default db;
