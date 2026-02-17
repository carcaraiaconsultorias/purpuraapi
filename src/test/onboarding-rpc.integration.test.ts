import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.INTEGRATION_DATABASE_URL_PG || process.env.DATABASE_URL_PG;
const canRunIntegration = Boolean(connectionString);
const integrationIt = canRunIntegration ? it : it.skip;

let client: Client | null = null;

beforeAll(async () => {
  if (!canRunIntegration) return;
  client = new Client({
    connectionString,
    ssl: process.env.INTEGRATION_DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
});

afterAll(async () => {
  if (!client) return;
  await client.end();
});

async function callProcessEvent(params: {
  phone: string;
  providerMessageId: string;
  direction: "inbound" | "outbound" | "system" | "invalid";
  payload: Record<string, unknown>;
  eventTimestamp: string;
  status: string;
  clienteData: Record<string, unknown>;
}) {
  if (!client) throw new Error("Integration client is not initialized");

  const result = await client.query(
    `
      select *
      from public.process_whatsapp_onboarding_event(
        $1::text,
        $2::text,
        $3::text,
        $4::jsonb,
        $5::timestamptz,
        $6::text,
        $7::jsonb
      )
    `,
    [
      params.phone,
      params.providerMessageId,
      params.direction,
      JSON.stringify(params.payload),
      params.eventTimestamp,
      params.status,
      JSON.stringify(params.clienteData),
    ],
  );

  return result.rows[0] ?? null;
}

describe("process_whatsapp_onboarding_event integration (PostgreSQL)", () => {
  integrationIt("handles idempotency by provider_message_id", async () => {
    const uniqueSuffix = Date.now().toString();
    const phone = `+55119${uniqueSuffix.slice(-8)}`;
    const messageId = `test-idempotency-${uniqueSuffix}`;

    const first = await callProcessEvent({
      phone,
      providerMessageId: messageId,
      direction: "inbound",
      payload: { source: "integration_test" },
      eventTimestamp: new Date().toISOString(),
      status: "in_progress",
      clienteData: { nome: "Teste Idempotencia", telefone: phone },
    });

    expect(first).toBeTruthy();
    expect(first.duplicate).toBe(false);

    const second = await callProcessEvent({
      phone,
      providerMessageId: messageId,
      direction: "inbound",
      payload: { source: "integration_test" },
      eventTimestamp: new Date().toISOString(),
      status: "in_progress",
      clienteData: { nome: "Teste Idempotencia", telefone: phone },
    });

    expect(second).toBeTruthy();
    expect(second.duplicate).toBe(true);

    const countResult = await client!.query(
      `
        select count(*)::int as total
        from public.onboarding_messages
        where provider_message_id = $1
      `,
      [messageId],
    );
    expect(countResult.rows[0].total).toBe(1);
  });

  integrationIt("updates status and timestamp in session", async () => {
    const uniqueSuffix = Date.now().toString();
    const phone = `+55118${uniqueSuffix.slice(-8)}`;
    const t1 = new Date();
    const t2 = new Date(t1.getTime() + 1_500);

    await callProcessEvent({
      phone,
      providerMessageId: `status-1-${uniqueSuffix}`,
      direction: "outbound",
      payload: { step: 1 },
      eventTimestamp: t1.toISOString(),
      status: "started",
      clienteData: { nome: "Teste Status", telefone: phone },
    });

    await callProcessEvent({
      phone,
      providerMessageId: `status-2-${uniqueSuffix}`,
      direction: "inbound",
      payload: { step: 2 },
      eventTimestamp: t2.toISOString(),
      status: "in_progress",
      clienteData: {},
    });

    const sessionResult = await client!.query(
      `
        select current_status, status_updated_at
        from public.onboarding_sessions
        where phone_e164 = $1
        limit 1
      `,
      [phone],
    );

    expect(sessionResult.rows.length).toBe(1);
    expect(sessionResult.rows[0].current_status).toBe("in_progress");
    expect(new Date(sessionResult.rows[0].status_updated_at).getTime()).toBeGreaterThanOrEqual(t2.getTime());
  });

  integrationIt("rolls back when direction is invalid", async () => {
    const uniqueSuffix = Date.now().toString();
    const phone = `+55117${uniqueSuffix.slice(-8)}`;
    const providerMessageId = `rollback-${uniqueSuffix}`;

    let caught = false;
    try {
      await callProcessEvent({
        phone,
        providerMessageId,
        direction: "invalid",
        payload: { test: "rollback" },
        eventTimestamp: new Date().toISOString(),
        status: "in_progress",
        clienteData: { nome: "Rollback Test", telefone: phone },
      });
    } catch {
      caught = true;
    }

    expect(caught).toBe(true);

    const sessionResult = await client!.query(
      `
        select id
        from public.onboarding_sessions
        where phone_e164 = $1
      `,
      [phone],
    );
    expect(sessionResult.rows).toHaveLength(0);
  });

  integrationIt("creates cliente and links cliente_id when receiving only status event", async () => {
    const phone = "+5511666009988";
    const uniqueSuffix = Date.now().toString();
    const providerMessageId = `status-only-${uniqueSuffix}`;

    await client!.query(
      `
        delete from public.onboarding_sessions
        where phone_e164 = $1
      `,
      [phone],
    );
    await client!.query(
      `
        delete from public.clientes
        where whatsapp_phone = $1
      `,
      [phone],
    );

    const row = await callProcessEvent({
      phone,
      providerMessageId,
      direction: "system",
      payload: {
        source: "integration_test",
        type: "status",
      },
      eventTimestamp: new Date().toISOString(),
      status: "awaiting_client",
      clienteData: { telefone: phone },
    });

    expect(row).toBeTruthy();
    expect(row.cliente_id).toBeTruthy();

    const clienteResult = await client!.query(
      `
        select id, whatsapp_phone, onboarding_status
        from public.clientes
        where whatsapp_phone = $1
        limit 1
      `,
      [phone],
    );
    expect(clienteResult.rows.length).toBe(1);
    expect(clienteResult.rows[0].whatsapp_phone).toBe(phone);

    const sessionResult = await client!.query(
      `
        select id, cliente_id, current_status
        from public.onboarding_sessions
        where phone_e164 = $1
        limit 1
      `,
      [phone],
    );
    expect(sessionResult.rows.length).toBe(1);
    expect(sessionResult.rows[0].cliente_id).toBeTruthy();
    expect(sessionResult.rows[0].current_status).toBe("awaiting_client");
  });
});
