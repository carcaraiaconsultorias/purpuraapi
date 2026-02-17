import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db/pool.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeSqlFile(filename) {
  const sqlPath = path.resolve(__dirname, "..", "db", filename);
  const content = await fs.readFile(sqlPath, "utf8");
  await pool.query(content);
}

async function main() {
  await executeSqlFile("schema.sql");
  await executeSqlFile("20260214193000_whatsapp_onboarding_block_a.sql");
  await executeSqlFile("20260215190000_operational_trello_block_c.sql");
  await executeSqlFile("20260216183000_reminders_block_e.sql");
  await executeSqlFile("seed.sql");
  console.log("Database schema and seeds applied.");
}

main()
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
