import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeMetaSignature } from "../../backend/services/whatsapp-signature.mjs";

type SessionState = {
  sessionId: string;
  trackingToken: string;
  clienteId: string;
  status: string;
  statusUpdatedAt: string;
};

function buildWebhookPayload(providerMessageId: string, phone = "5511999998888") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: phone, profile: { name: "Joao Teste" } }],
              messages: [
                {
                  id: providerMessageId,
                  from: phone,
                  timestamp: "1739550000",
                  text: { body: "Oi" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function createMockPool() {
  const seenMessageIds = new Set<string>();
  const sessions = new Map<string, SessionState>();

  return {
    async query(_sql: string, params: unknown[] = []) {
      const phone = String(params[0] ?? "");
      const providerMessageId = String(params[1] ?? "");
      const eventTimestamp = new Date(String(params[4] ?? new Date().toISOString())).toISOString();
      const status = typeof params[5] === "string" && params[5] ? params[5] : "in_progress";

      let session = sessions.get(phone);
      if (!session) {
        session = {
          sessionId: randomUUID(),
          trackingToken: randomUUID(),
          clienteId: randomUUID(),
          status,
          statusUpdatedAt: eventTimestamp,
        };
        sessions.set(phone, session);
      }

      if (seenMessageIds.has(providerMessageId)) {
        return {
          rows: [
            {
              session_id: session.sessionId,
              cliente_id: session.clienteId,
              tracking_token: session.trackingToken,
              status: session.status,
              status_updated_at: session.statusUpdatedAt,
              message_id: null,
              duplicate: true,
            },
          ],
        };
      }

      seenMessageIds.add(providerMessageId);
      session.status = status;
      session.statusUpdatedAt = eventTimestamp;

      return {
        rows: [
          {
            session_id: session.sessionId,
            cliente_id: session.clienteId,
            tracking_token: session.trackingToken,
            status: session.status,
            status_updated_at: session.statusUpdatedAt,
            message_id: randomUUID(),
            duplicate: false,
          },
        ],
      };
    },
  };
}

describe("whatsapp webhook http", () => {
  const appSecret = "webhook-app-secret";
  const verifyToken = "verify-token-test";
  let createServerApp: (typeof import("../../backend/server.mjs"))["createServerApp"];
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.DATABASE_URL_PG = process.env.DATABASE_URL_PG || "postgres://unused";
    ({ createServerApp } = await import("../../backend/server.mjs"));

    const app = createServerApp({
      dbPool: createMockPool(),
      appConfig: {
        apiPort: 0,
        apiPublicUrl: "http://localhost",
        apiSharedKey: "",
        databaseUrl: "postgres://unused",
        databaseSsl: false,
        whatsappVerifyToken: verifyToken,
        whatsappAppSecret: appSecret,
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
  }, 30_000);

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("validates webhook challenge on GET", async () => {
    const response = await fetch(
      `${baseUrl}/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge-ok`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBe("challenge-ok");
  });

  it("rejects invalid signature on POST", async () => {
    const rawBody = JSON.stringify(buildWebhookPayload("wamid.invalid.signature"));
    const response = await fetch(`${baseUrl}/whatsapp-webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=invalid",
      },
      body: rawBody,
    });
    const body = (await response.json()) as { ok: boolean; error?: string };

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("accepts valid signature and keeps idempotency by provider_message_id", async () => {
    const payload = buildWebhookPayload("wamid.same.id");
    const rawBody = JSON.stringify(payload);
    const signature = computeMetaSignature(rawBody, appSecret);

    const first = await fetch(`${baseUrl}/whatsapp-webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });
    const firstBody = (await first.json()) as { ok: boolean; processed: number; duplicates: number };

    expect(first.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(firstBody.processed).toBe(1);
    expect(firstBody.duplicates).toBe(0);

    const second = await fetch(`${baseUrl}/whatsapp-webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });
    const secondBody = (await second.json()) as { ok: boolean; processed: number; duplicates: number };

    expect(second.status).toBe(200);
    expect(secondBody.ok).toBe(true);
    expect(secondBody.processed).toBe(1);
    expect(secondBody.duplicates).toBe(1);
  });
});
