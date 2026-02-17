import { Pool } from "pg";
import { config } from "../backend/config.mjs";
import { createServerApp } from "../backend/server.mjs";
import { getTrelloEnvReadiness } from "../backend/services/trello-service.mjs";

function normalizeText(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function safeTrelloErrorDetail(detail, fallback = "request failed") {
  const text = normalizeText(detail, 500);
  if (!text) return fallback;
  return text
    .replace(/([?&](?:key|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
}

function redactSensitive(text) {
  return safeTrelloErrorDetail(String(text || ""), "");
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveApiAuthConfig(appConfig) {
  const backendApiSharedKey = normalizeText(appConfig.apiSharedKey, 500);
  const runtimeApiSharedKey = normalizeText(process.env.API_SHARED_KEY, 500);
  const apiProtected = backendApiSharedKey.length > 0;

  if (apiProtected && !runtimeApiSharedKey) {
    throw new Error("Smoke test aborted: API_SHARED_KEY not configured");
  }

  return {
    apiProtected,
    apiSharedKey: runtimeApiSharedKey,
  };
}

function buildApiHeaders(apiSharedKey) {
  const headers = { "content-type": "application/json" };
  if (normalizeText(apiSharedKey, 500)) {
    headers["x-api-key"] = apiSharedKey;
  }
  return headers;
}

async function withServer(dbPool, appConfig, run) {
  const app = createServerApp({ dbPool, appConfig });
  const server = await new Promise((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();
  if (!address || typeof address !== "object") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Failed to start temporary API server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(baseUrl, path, payload, apiSharedKey) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildApiHeaders(apiSharedKey),
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Smoke request unauthorized (${response.status}): verify API_SHARED_KEY`);
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  return {
    status: response.status,
    data,
    text,
  };
}

function buildTrelloUrl(appConfig, path, query = {}) {
  const baseUrl = normalizeText(appConfig.trelloApiBaseUrl, 500) || "https://api.trello.com/1";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = normalizeText(path, 500).replace(/^\/+/, "");
  const url = new URL(`${normalizedBaseUrl}/${normalizedPath}`);
  url.searchParams.set("key", normalizeText(appConfig.trelloApiKey, 300));
  url.searchParams.set("token", normalizeText(appConfig.trelloToken, 500));

  for (const [queryKey, queryValue] of Object.entries(query)) {
    if (queryValue === null || queryValue === undefined || queryValue === "") continue;
    url.searchParams.set(queryKey, String(queryValue));
  }

  return url;
}

async function trelloApiRequest(appConfig, { method = "GET", path, query = {} }) {
  const url = buildTrelloUrl(appConfig, path, query);

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    const detail = safeTrelloErrorDetail(error instanceof Error ? error.message : String(error), "network error");
    throw new Error(`Trello request failed (network): ${detail}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Trello request failed (${response.status}): ${safeTrelloErrorDetail(text)}`);
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  return data;
}

function buildQaTitle(baseTitle) {
  const title = normalizeText(baseTitle, 220) || "QA Trello Smoke";
  return title.startsWith("[QA] ") ? title : `[QA] ${title}`;
}

async function fetchTrelloCardById(appConfig, cardId) {
  const data = await trelloApiRequest(appConfig, {
    method: "GET",
    path: `cards/${encodeURIComponent(cardId)}`,
    query: { fields: "id,name,idList,url,desc" },
  });

  return {
    id: normalizeText(data?.id, 120),
    name: normalizeText(data?.name, 260),
    idList: normalizeText(data?.idList, 120),
    url: normalizeText(data?.url, 1000),
    desc: normalizeText(data?.desc, 15000),
  };
}

async function applyQaLabelIfConfigured(appConfig, cardId) {
  const qaLabelId = normalizeText(process.env.TRELLO_QA_LABEL_ID, 120);
  if (!qaLabelId) return { applied: false };

  await trelloApiRequest(appConfig, {
    method: "POST",
    path: `cards/${encodeURIComponent(cardId)}/idLabels`,
    query: { value: qaLabelId },
  });

  return { applied: true };
}

async function archiveCardIfConfigured(appConfig, cardId) {
  if (process.env.TRELLO_SMOKE_CLEANUP !== "1") {
    console.log("Smoke cleanup skipped");
    return { archived: false };
  }

  await trelloApiRequest(appConfig, {
    method: "PUT",
    path: `cards/${encodeURIComponent(cardId)}`,
    query: { closed: "true" },
  });

  console.log("Smoke cleanup: card archived");
  return { archived: true };
}

async function fetchOperationalEvidenceByKey(dbPool, idempotencyKey) {
  const result = await dbPool.query(
    `
      select
        id,
        idempotency_key,
        tipo,
        titulo,
        status,
        trello_card_id,
        trello_list_id,
        updated_at
      from public.operational_items
      where idempotency_key = $1
      order by updated_at desc
      limit 1
    `,
    [idempotencyKey],
  );
  return result.rows[0] || null;
}

async function fetchOperationalEvidenceWindow(dbPool) {
  const result = await dbPool.query(
    `
      select id, idempotency_key, tipo, titulo, status, trello_card_id, trello_list_id, updated_at
      from public.operational_items
      where idempotency_key like 'qa-trello-smoke-%'
      order by updated_at desc
      limit 3
    `,
  );
  return result.rows;
}

async function runValidFlow({ dbPool, appConfig, suffix, apiSharedKey }) {
  return withServer(dbPool, appConfig, async (baseUrl) => {
    const idempotencyKey = `qa-trello-smoke-${suffix}`;
    const createPayload = {
      idempotency_key: idempotencyKey,
      tipo: "task",
      titulo: buildQaTitle(`Trello Smoke ${suffix}`),
      descricao: "Smoke test operacional para validar criacao de card Trello",
      prioridade: "medium",
      status: "open",
      detalhes: { origem: "qa_trello_smoke" },
      sync_trello: true,
    };

    const createResponse = await postJson(baseUrl, "/functions/operational-upsert", createPayload, apiSharedKey);
    assertCondition(createResponse.status === 200, `Expected 200 on create, got ${createResponse.status}`);
    assertCondition(createResponse.data?.ok === true, "Expected create response with ok=true");

    const itemId = normalizeText(createResponse.data?.item?.id, 120);
    const trelloCardId = normalizeText(createResponse.data?.trello?.cardId, 120);
    const trelloCardUrl = normalizeText(createResponse.data?.trello?.cardUrl, 1000);
    const trelloListId = normalizeText(createResponse.data?.trello?.listId, 120);

    assertCondition(Boolean(itemId), "Operational item id is missing");
    assertCondition(Boolean(trelloCardId), "Trello card id is missing");

    const dbAfterCreate = await fetchOperationalEvidenceByKey(dbPool, idempotencyKey);
    assertCondition(Boolean(dbAfterCreate), "DB row not found after create");
    assertCondition(dbAfterCreate.trello_card_id === trelloCardId, "DB trello_card_id does not match Trello response");

    const cardAfterCreate = await fetchTrelloCardById(appConfig, trelloCardId);
    assertCondition(cardAfterCreate.id === trelloCardId, "Trello API returned unexpected card id");
    assertCondition(Boolean(cardAfterCreate.name), "Trello card name is empty");
    assertCondition(Boolean(cardAfterCreate.idList), "Trello card list is empty");

    const updatePayload = {
      id: itemId,
      status: "done",
      sync_trello: true,
    };
    const updateResponse = await postJson(baseUrl, "/functions/operational-upsert", updatePayload, apiSharedKey);
    assertCondition(updateResponse.status === 200, `Expected 200 on update, got ${updateResponse.status}`);
    assertCondition(updateResponse.data?.ok === true, "Expected update response with ok=true");

    const cardAfterUpdate = await fetchTrelloCardById(appConfig, trelloCardId);
    assertCondition(cardAfterUpdate.id === trelloCardId, "Updated Trello card id mismatch");
    assertCondition(
      cardAfterUpdate.desc.includes("Status: Concluido"),
      "Updated Trello description does not reflect status=done",
    );

    const dbAfterUpdate = await fetchOperationalEvidenceByKey(dbPool, idempotencyKey);
    assertCondition(dbAfterUpdate?.status === "done", "DB status not updated to done");
    assertCondition(dbAfterUpdate?.trello_card_id === trelloCardId, "DB trello_card_id changed unexpectedly");

    return {
      idempotencyKey,
      itemId,
      trelloCardId,
      trelloCardUrl: trelloCardUrl || cardAfterCreate.url,
      trelloListId: trelloListId || cardAfterCreate.idList,
      trelloCardName: cardAfterCreate.name,
    };
  });
}

async function runInvalidTokenFlow({ dbPool, appConfig, suffix, apiSharedKey }) {
  const invalidConfig = {
    ...appConfig,
    trelloToken: "invalid-token-smoke-test",
  };

  return withServer(dbPool, invalidConfig, async (baseUrl) => {
    const payload = {
      idempotency_key: `qa-trello-smoke-invalid-${suffix}`,
      tipo: "task",
      titulo: buildQaTitle(`Trello Invalid Token ${suffix}`),
      descricao: "Smoke test para validar erro explicito de autenticacao Trello",
      prioridade: "low",
      status: "open",
      detalhes: { origem: "qa_trello_smoke_invalid_token" },
      sync_trello: true,
    };

    const response = await postJson(baseUrl, "/functions/operational-upsert", payload, apiSharedKey);
    const explicitAuthError = response.status === 502
      && response.data?.ok === false
      && /Trello authentication failed/i.test(normalizeText(response.data?.error, 500));
    assertCondition(explicitAuthError, `Expected explicit Trello auth error, got status=${response.status}`);

    return {
      status: response.status,
      error: normalizeText(response.data?.error, 500),
      idempotencyKey: payload.idempotency_key,
    };
  });
}

async function main() {
  const readiness = getTrelloEnvReadiness(config);
  console.log("Trello env readiness:");
  for (const item of readiness.statusByKey) {
    console.log(`- ${item.key}: ${item.status}`);
  }

  const requiredBaseEnv = normalizeText(config.databaseUrl, 500);
  if (!requiredBaseEnv) {
    console.error("FAIL: DATABASE_URL_PG is required.");
    process.exitCode = 1;
    return;
  }

  let apiAuthConfig;
  try {
    apiAuthConfig = resolveApiAuthConfig(config);
  } catch (error) {
    const message = redactSensitive(error instanceof Error ? error.message : String(error));
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`API auth mode: ${apiAuthConfig.apiProtected ? "protected" : "unprotected"}`);

  if (!readiness.ready) {
    console.error("FAIL: Trello env is not ready. Fill missing vars before real smoke.");
    process.exitCode = 1;
    return;
  }

  const dbPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    max: 4,
  });

  const suffix = Date.now().toString();

  try {
    const validResult = await runValidFlow({
      dbPool,
      appConfig: config,
      suffix,
      apiSharedKey: apiAuthConfig.apiSharedKey,
    });

    const labelResult = await applyQaLabelIfConfigured(config, validResult.trelloCardId);
    if (labelResult.applied) {
      console.log("Smoke QA label applied");
    }

    console.log("PASS: create/update flow");
    console.log(`- card.id: ${validResult.trelloCardId}`);
    console.log(`- card.url: ${validResult.trelloCardUrl}`);
    console.log(`- card.name: ${validResult.trelloCardName}`);
    console.log(`- card.idList: ${validResult.trelloListId}`);
    console.log(`- db.item_id: ${validResult.itemId}`);
    console.log(`- db.idempotency_key: ${validResult.idempotencyKey}`);

    if (process.env.TRELLO_TOKEN_INVALID_TEST === "1") {
      const invalidResult = await runInvalidTokenFlow({
        dbPool,
        appConfig: config,
        suffix,
        apiSharedKey: apiAuthConfig.apiSharedKey,
      });
      console.log("PASS: invalid token returns explicit auth error");
      console.log(`- status: ${invalidResult.status}`);
      console.log(`- error: ${redactSensitive(invalidResult.error)}`);
      console.log(`- idempotency_key: ${invalidResult.idempotencyKey}`);
    } else {
      console.log("SKIP: invalid token test (set TRELLO_TOKEN_INVALID_TEST=1 to enable)");
    }

    await archiveCardIfConfigured(config, validResult.trelloCardId);

    const evidenceRows = await fetchOperationalEvidenceWindow(dbPool);
    console.log("DB evidence rows (operational_items):");
    console.log(JSON.stringify(evidenceRows, null, 2));

    console.log("SQL evidence query:");
    console.log(
      "select id, idempotency_key, tipo, titulo, status, trello_card_id, trello_list_id, updated_at from public.operational_items where idempotency_key like 'qa-trello-smoke-%' order by updated_at desc limit 3;",
    );
  } catch (error) {
    const message = redactSensitive(error instanceof Error ? error.message : String(error));
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } finally {
    await dbPool.end();
  }
}

main().catch((error) => {
  const message = redactSensitive(error instanceof Error ? error.message : String(error));
  console.error(`FAIL: ${message}`);
  process.exit(1);
});
