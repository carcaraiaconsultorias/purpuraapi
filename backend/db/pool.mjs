import pg from "pg";
import { config } from "../config.mjs";

const { Pool, types } = pg;

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL_PG is required");
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
