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
const apiKey = "integration-operational-key";
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

describe("operational flow http integration (PostgreSQL)", () => {
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

  integrationIt("creates, updates, lists and deletes an operational task", async () => {
    const unique = Date.now().toString();
    const idempotencyKey = `op-e2e-${unique}`;
    const title = `Task E2E ${unique}`;

    const createResponse = await postJson("/functions/operational-upsert", {
      idempotency_key: idempotencyKey,
      tipo: "task",
      titulo: title,
      descricao: "Task de teste para Bloco C",
      prioridade: "high",
      status: "open",
      detalhes: { origem: "integration_test" },
      sync_trello: false,
    });

    expect(createResponse.status).toBe(200);
    expect(createResponse.data.ok).toBe(true);
    expect(createResponse.data.item?.id).toBeTruthy();
    expect(createResponse.data.item?.titulo).toBe(title);

    const itemId = String(createResponse.data.item.id);
    const dbCreated = await dbPool!.query(
      `
        select id, titulo, status
        from public.operational_items
        where id = $1
        limit 1
      `,
      [itemId],
    );
    expect(dbCreated.rows.length).toBe(1);
    expect(dbCreated.rows[0].titulo).toBe(title);

    const updateResponse = await postJson("/functions/operational-upsert", {
      id: itemId,
      status: "in_progress",
      responsavel: "QA Operacional",
      sync_trello: false,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.ok).toBe(true);
    expect(updateResponse.data.item?.status).toBe("in_progress");

    const listResponse = await postJson("/functions/operational-list", {
      tipo: "task",
      search: unique,
      limit: 20,
    });

    expect(listResponse.status).toBe(200);
    expect(listResponse.data.ok).toBe(true);
    expect(Array.isArray(listResponse.data.items)).toBe(true);
    expect(listResponse.data.items.some((item: { id: string }) => item.id === itemId)).toBe(true);

    const deleteResponse = await postJson("/functions/operational-delete", { id: itemId });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.ok).toBe(true);

    const dbDeleted = await dbPool!.query(
      `
        select id
        from public.operational_items
        where id = $1
      `,
      [itemId],
    );
    expect(dbDeleted.rows.length).toBe(0);
  });
});
