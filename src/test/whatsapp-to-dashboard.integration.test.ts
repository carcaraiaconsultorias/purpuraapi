import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeMetaSignature } from "../../backend/services/whatsapp-signature.mjs";

const connectionString = process.env.INTEGRATION_DATABASE_URL_PG || process.env.DATABASE_URL_PG;
const canRunIntegration = Boolean(connectionString);
const integrationIt = canRunIntegration ? it : it.skip;

let dbPool: Pool | null = null;
let server: Server | null = null;
let baseUrl = "";
let createServerApp: (typeof import("../../backend/server.mjs"))["createServerApp"];

const apiKey = "integration-dashboard-key";
const appSecret = "integration-dashboard-app-secret";

function buildWebhookPayload(providerMessageId: string, phone: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: phone, profile: { name: "Cliente Dashboard" } }],
              messages: [
                {
                  id: providerMessageId,
                  from: phone,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: "Teste dashboard" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("whatsapp -> dashboard integration", () => {
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
        databaseUrl: connectionString || "",
        databaseSsl: process.env.INTEGRATION_DATABASE_SSL === "true",
        whatsappVerifyToken: "integration-verify-token",
        whatsappAppSecret: appSecret,
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

  integrationIt("persists webhook event and exposes session in onboarding dashboard", async () => {
    const unique = Date.now().toString();
    const phoneDigits = `55119${unique.slice(-8)}`;
    const providerMessageId = `wamid.dashboard.${unique}`;
    const payload = buildWebhookPayload(providerMessageId, phoneDigits);
    const rawBody = JSON.stringify(payload);
    const signature = computeMetaSignature(rawBody, appSecret);

    const webhookResponse = await fetch(`${baseUrl}/whatsapp-webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });

    const webhookData = (await webhookResponse.json()) as { ok?: boolean; processed?: number };
    expect(webhookResponse.status).toBe(200);
    expect(webhookData.ok).toBe(true);
    expect((webhookData.processed || 0) >= 1).toBe(true);

    const dashboardResponse = await fetch(`${baseUrl}/functions/onboarding-dashboard`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ limit: 50 }),
    });

    const dashboardData = (await dashboardResponse.json()) as {
      ok?: boolean;
      recent_sessions?: Array<{ phone_e164: string; current_status: string }>;
    };

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardData.ok).toBe(true);
    expect(Array.isArray(dashboardData.recent_sessions)).toBe(true);

    const expectedPhone = `+${phoneDigits}`;
    const session = (dashboardData.recent_sessions || []).find((row) => row.phone_e164 === expectedPhone);
    expect(session).toBeTruthy();
    expect(["in_progress", "awaiting_client", "started"]).toContain(String(session?.current_status || ""));

    await dbPool!.query("delete from public.onboarding_sessions where phone_e164 = $1", [expectedPhone]);
    await dbPool!.query("delete from public.clientes where whatsapp_phone = $1", [expectedPhone]);
  });
});
