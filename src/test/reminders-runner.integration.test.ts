import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const connectionString = process.env.INTEGRATION_DATABASE_URL_PG || process.env.DATABASE_URL_PG;
const canRunIntegration = Boolean(connectionString);
const integrationIt = canRunIntegration ? it : it.skip;

let dbPool: Pool | null = null;
let server: Server | null = null;
let baseUrl = "";
const apiKey = "integration-reminders-key";
let createServerApp: (typeof import("../../backend/server.mjs"))["createServerApp"];

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

describe("reminders runner integration (PostgreSQL)", () => {
  beforeAll(async () => {
    if (!canRunIntegration) return;

    process.env.DATABASE_URL_PG = connectionString || "";
    ({ createServerApp } = await import("../../backend/server.mjs"));

    dbPool = new Pool({
      connectionString,
      ssl: process.env.INTEGRATION_DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 4,
    });

    await dbPool.query("select 1");

    const app = createServerApp({
      dbPool,
      appConfig: {
        apiPort: 0,
        apiPublicUrl: "http://localhost",
        apiSharedKey: apiKey,
        databaseUrl: connectionString,
        databaseSsl: process.env.INTEGRATION_DATABASE_SSL === "true",
        whatsappVerifyToken: "integration-verify-token",
        whatsappAppSecret: "integration-app-secret",
        whatsappGraphApiBaseUrl: "https://graph.facebook.com/v19.0",
        whatsappPhoneNumberId: "",
        whatsappAccessToken: "",
        whatsappTemplateName: "",
        whatsappSenderEnabled: false,
        googleDriveRootFolderId: "",
        googleServiceAccountEmail: "",
        googleServiceAccountPrivateKey: "",
        googleDriveShareWithEmail: "",
        googleDriveShareRole: "reader",
        googleDriveAllowPublic: false,
        trelloApiBaseUrl: "https://api.trello.com/1",
        trelloApiKey: "",
        trelloToken: "",
        trelloBoardId: "",
        trelloDefaultListId: "",
        trelloTaskListId: "",
        trelloBriefingListId: "",
        trelloFollowUpListId: "",
        firecrawlApiKey: "",
        lovableApiKey: "",
        uploadsDir: "backend/uploads",
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (dbPool) await dbPool.end();
  });

  integrationIt("runs dry_run and keeps idempotency for same phone/date/tipo", async () => {
    const unique = Date.now().toString();
    const phone = `+55119${unique.slice(-8)}`;
    const tipo = "relevo";
    const dateResult = await dbPool!.query(
      `
        select (now() at time zone 'America/Belem')::date as target_date
      `,
    );
    const relevoDate = dateResult.rows[0].target_date;

    await dbPool!.query(
      `
        delete from public.reminder_logs
        where phone_e164 = $1
      `,
      [phone],
    );

    await dbPool!.query(
      `
        delete from public.relevo_dates
        where phone_e164 = $1
      `,
      [phone],
    );

    await dbPool!.query(
      `
        insert into public.relevo_dates (
          phone_e164,
          relevo_date,
          tipo,
          timezone,
          ativo
        )
        values ($1, $2::date, $3, 'America/Belem', true)
      `,
      [phone, relevoDate, tipo],
    );

    const first = await postJson("/functions/run-reminders", {
      mode: "today",
      dry_run: true,
    });

    expect(first.status).toBe(200);
    expect(first.data.ok).toBe(true);

    const second = await postJson("/functions/run-reminders", {
      mode: "today",
      dry_run: true,
    });

    expect(second.status).toBe(200);
    expect(second.data.ok).toBe(true);
    expect(Number(second.data.skipped ?? 0)).toBeGreaterThanOrEqual(1);

    const logsResult = await dbPool!.query(
      `
        select status, count(*)::int as total
        from public.reminder_logs
        where phone_e164 = $1
          and relevo_date = $2::date
          and tipo = $3
        group by status
      `,
      [phone, relevoDate, tipo],
    );

    const dryRunRow = logsResult.rows.find((row) => row.status === "dry_run");
    const totalRows = logsResult.rows.reduce((acc, row) => acc + Number(row.total || 0), 0);

    expect(Number(dryRunRow?.total || 0)).toBe(1);
    expect(totalRows).toBe(1);

    await dbPool!.query(
      `
        delete from public.reminder_logs
        where phone_e164 = $1
      `,
      [phone],
    );
    await dbPool!.query(
      `
        delete from public.relevo_dates
        where phone_e164 = $1
      `,
      [phone],
    );
  });
});
