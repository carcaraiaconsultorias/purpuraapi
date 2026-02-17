import { config } from "../config.mjs";
import { syncOperationalItemToTrello } from "./trello-service.mjs";

const VALID_TYPES = new Set(["task", "briefing", "follow_up"]);
const VALID_STATUSES = new Set(["open", "in_progress", "done", "blocked"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

const UPSERT_KEYS = new Set([
  "id",
  "idempotency_key",
  "tipo",
  "titulo",
  "descricao",
  "cliente_id",
  "responsavel",
  "prioridade",
  "status",
  "prazo_at",
  "detalhes",
  "sync_trello",
]);

const LIST_KEYS = new Set(["tipo", "status", "cliente_id", "limit", "search"]);
const DELETE_KEYS = new Set(["id"]);

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeUuid(value) {
  const text = normalizeString(value, 80);
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return "";
  }
  return text.toLowerCase();
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value)
    .filter(([key]) => normalizeString(key, 120).length > 0)
    .slice(0, 80);
  const output = {};
  for (const [key, item] of entries) {
    const normalizedKey = normalizeString(key, 120);
    if (!normalizedKey) continue;
    output[normalizedKey] = item;
  }
  return output;
}

function extractUnknownKeys(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowedKeys.has(key));
}

function normalizeType(value) {
  const type = normalizeString(value, 30).toLowerCase();
  return VALID_TYPES.has(type) ? type : "";
}

function normalizeStatus(value) {
  const status = normalizeString(value, 30).toLowerCase();
  return VALID_STATUSES.has(status) ? status : "";
}

function normalizePriority(value) {
  const priority = normalizeString(value, 30).toLowerCase();
  return VALID_PRIORITIES.has(priority) ? priority : "";
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function sanitizeTrelloErrorMessage(message, fallback = "Trello sync failed") {
  const text = normalizeString(message, 500) || fallback;
  return text
    .replace(/([?&](?:key|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
}

function toPublicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    idempotency_key: row.idempotency_key,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    cliente_id: row.cliente_id,
    cliente_nome: row.cliente_nome || null,
    responsavel: row.responsavel,
    prioridade: row.prioridade,
    status: row.status,
    prazo_at: row.prazo_at,
    detalhes: row.detalhes || {},
    trello_card_id: row.trello_card_id,
    trello_card_url: row.trello_card_url,
    trello_list_id: row.trello_list_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getOperationalItemById(dbClient, id, { forUpdate = false } = {}) {
  const result = await dbClient.query(
    `
      select
        oi.*,
        c.nome as cliente_nome
      from public.operational_items oi
      left join public.clientes c on c.id = oi.cliente_id
      where oi.id = $1
      limit 1
      ${forUpdate ? "for update of oi" : ""}
    `,
    [id],
  );
  return result.rows[0] ?? null;
}

async function updateOperationalTrelloFields(dbPool, itemId, syncResult) {
  if (!syncResult?.cardId) return;
  await dbPool.query(
    `
      update public.operational_items
      set
        trello_card_id = $2,
        trello_card_url = $3,
        trello_list_id = $4,
        updated_at = now()
      where id = $1
    `,
    [itemId, syncResult.cardId, syncResult.cardUrl || null, syncResult.listId || null],
  );
}

function buildUpsertPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { valid: false, message: "Invalid payload" };
  }

  const unknownKeys = extractUnknownKeys(rawPayload, UPSERT_KEYS);
  if (unknownKeys.length > 0) {
    return { valid: false, message: `Unknown fields: ${unknownKeys.join(", ")}` };
  }

  const id = normalizeUuid(rawPayload.id);
  const isUpdate = Boolean(id);
  const tipo = normalizeType(rawPayload.tipo);
  const titulo = normalizeString(rawPayload.titulo, 220);
  const descricao = normalizeString(rawPayload.descricao, 8000);
  const clienteIdRaw = rawPayload.cliente_id === null ? null : normalizeUuid(rawPayload.cliente_id);
  const responsavel = normalizeString(rawPayload.responsavel, 180);
  const prioridade = normalizePriority(rawPayload.prioridade) || "medium";
  const status = normalizeStatus(rawPayload.status) || "open";
  const prazoAt = rawPayload.prazo_at === null ? null : normalizeDate(rawPayload.prazo_at);
  const idempotencyKey = normalizeString(rawPayload.idempotency_key, 120);
  const detalhes = sanitizeDetails(rawPayload.detalhes);
  const syncTrello = normalizeBoolean(rawPayload.sync_trello, true);

  if (rawPayload.cliente_id !== undefined && rawPayload.cliente_id !== null && !clienteIdRaw) {
    return { valid: false, message: "cliente_id must be a valid uuid or null" };
  }

  if (rawPayload.prazo_at !== undefined && rawPayload.prazo_at !== null && !prazoAt) {
    return { valid: false, message: "prazo_at must be a valid datetime or null" };
  }

  if (rawPayload.status !== undefined && !normalizeStatus(rawPayload.status)) {
    return { valid: false, message: "status is invalid" };
  }

  if (rawPayload.prioridade !== undefined && !normalizePriority(rawPayload.prioridade)) {
    return { valid: false, message: "prioridade is invalid" };
  }

  if (!isUpdate) {
    if (!tipo) return { valid: false, message: "tipo is required" };
    if (!titulo || titulo.length < 2) return { valid: false, message: "titulo is required" };
  }

  if (isUpdate) {
    if (!id) return { valid: false, message: "id is invalid" };
    if (rawPayload.tipo !== undefined && !tipo) return { valid: false, message: "tipo is invalid" };
  }

  return {
    valid: true,
    payload: {
      id,
      isUpdate,
      tipo: tipo || undefined,
      titulo: titulo || undefined,
      descricao: rawPayload.descricao !== undefined ? descricao : undefined,
      cliente_id: rawPayload.cliente_id !== undefined ? clienteIdRaw : undefined,
      responsavel: rawPayload.responsavel !== undefined ? responsavel : undefined,
      prioridade: rawPayload.prioridade !== undefined ? prioridade : undefined,
      status: rawPayload.status !== undefined ? status : undefined,
      prazo_at: rawPayload.prazo_at !== undefined ? prazoAt : undefined,
      idempotency_key: idempotencyKey || undefined,
      detalhes: rawPayload.detalhes !== undefined ? detalhes : undefined,
      sync_trello: syncTrello,
    },
  };
}

function buildListPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { valid: true, payload: { limit: 30 } };
  }
  const unknownKeys = extractUnknownKeys(rawPayload, LIST_KEYS);
  if (unknownKeys.length > 0) {
    return { valid: false, message: `Unknown fields: ${unknownKeys.join(", ")}` };
  }

  const tipo = rawPayload.tipo !== undefined ? normalizeType(rawPayload.tipo) : "";
  if (rawPayload.tipo !== undefined && !tipo) return { valid: false, message: "tipo is invalid" };

  const status = rawPayload.status !== undefined ? normalizeStatus(rawPayload.status) : "";
  if (rawPayload.status !== undefined && !status) return { valid: false, message: "status is invalid" };

  const clienteId = rawPayload.cliente_id !== undefined ? normalizeUuid(rawPayload.cliente_id) : "";
  if (rawPayload.cliente_id !== undefined && !clienteId) {
    return { valid: false, message: "cliente_id is invalid" };
  }

  const limitRaw = Number(rawPayload.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 30;
  const search = normalizeString(rawPayload.search, 180);

  return {
    valid: true,
    payload: {
      tipo: tipo || null,
      status: status || null,
      cliente_id: clienteId || null,
      limit,
      search: search || null,
    },
  };
}

function buildDeletePayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { valid: false, message: "Invalid payload" };
  }
  const unknownKeys = extractUnknownKeys(rawPayload, DELETE_KEYS);
  if (unknownKeys.length > 0) {
    return { valid: false, message: `Unknown fields: ${unknownKeys.join(", ")}` };
  }
  const id = normalizeUuid(rawPayload.id);
  if (!id) return { valid: false, message: "id is required" };
  return { valid: true, payload: { id } };
}

function pickUpdateEntries(payload) {
  const updateEntries = [];
  if (payload.tipo !== undefined) updateEntries.push(["tipo", payload.tipo]);
  if (payload.titulo !== undefined) updateEntries.push(["titulo", payload.titulo]);
  if (payload.descricao !== undefined) updateEntries.push(["descricao", payload.descricao]);
  if (payload.cliente_id !== undefined) updateEntries.push(["cliente_id", payload.cliente_id]);
  if (payload.responsavel !== undefined) updateEntries.push(["responsavel", payload.responsavel]);
  if (payload.prioridade !== undefined) updateEntries.push(["prioridade", payload.prioridade]);
  if (payload.status !== undefined) updateEntries.push(["status", payload.status]);
  if (payload.prazo_at !== undefined) updateEntries.push(["prazo_at", payload.prazo_at]);
  if (payload.detalhes !== undefined) updateEntries.push(["detalhes", payload.detalhes]);
  if (payload.idempotency_key !== undefined) updateEntries.push(["idempotency_key", payload.idempotency_key]);
  return updateEntries;
}

export async function handleOperationalUpsert(
  dbPool,
  rawPayload,
  { appConfig = config, syncFn = syncOperationalItemToTrello } = {},
) {
  const validation = buildUpsertPayload(rawPayload);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: validation.message };
  }

  const payload = validation.payload;
  const dbClient = await dbPool.connect();

  let row = null;
  let duplicate = false;

  try {
    await dbClient.query("begin");

    if (payload.isUpdate) {
      const existing = await getOperationalItemById(dbClient, payload.id, { forUpdate: true });
      if (!existing) {
        await dbClient.query("rollback");
        return { ok: false, statusCode: 404, error: "Operational item not found" };
      }

      const updates = pickUpdateEntries(payload);
      if (updates.length > 0) {
        const setSql = updates.map(([column], index) => `${column} = $${index + 2}`).join(", ");
        const values = updates.map(([, value]) => value);
        await dbClient.query(
          `
            update public.operational_items
            set ${setSql}, updated_at = now()
            where id = $1
          `,
          [payload.id, ...values],
        );
      }

      row = await getOperationalItemById(dbClient, payload.id, { forUpdate: false });
    } else {
      if (payload.idempotency_key) {
        const existingByKey = await dbClient.query(
          `
            select id
            from public.operational_items
            where idempotency_key = $1
            limit 1
            for update
          `,
          [payload.idempotency_key],
        );

        if (existingByKey.rows[0]?.id) {
          duplicate = true;
          row = await getOperationalItemById(dbClient, existingByKey.rows[0].id, { forUpdate: false });
        }
      }

      if (!row) {
        const insertResult = await dbClient.query(
          `
            insert into public.operational_items (
              idempotency_key,
              tipo,
              titulo,
              descricao,
              cliente_id,
              responsavel,
              prioridade,
              status,
              prazo_at,
              detalhes
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
            returning id
          `,
          [
            payload.idempotency_key || null,
            payload.tipo,
            payload.titulo,
            payload.descricao || "",
            payload.cliente_id ?? null,
            payload.responsavel || "",
            payload.prioridade || "medium",
            payload.status || "open",
            payload.prazo_at ?? null,
            payload.detalhes || {},
          ],
        );
        row = await getOperationalItemById(dbClient, insertResult.rows[0].id, { forUpdate: false });
      }
    }

    await dbClient.query("commit");
  } catch (error) {
    await dbClient.query("rollback");
    throw error;
  } finally {
    dbClient.release();
  }

  let trello = {
    enabled: false,
    status: "not_requested",
    cardId: row?.trello_card_id || null,
    cardUrl: row?.trello_card_url || null,
    listId: row?.trello_list_id || null,
  };

  if (payload.sync_trello) {
    try {
      trello = await syncFn(row, { appConfig });
      if (trello.cardId) {
        await updateOperationalTrelloFields(dbPool, row.id, trello);
        const refreshed = await dbPool.query(
          `
            select
              oi.*,
              c.nome as cliente_nome
            from public.operational_items oi
            left join public.clientes c on c.id = oi.cliente_id
            where oi.id = $1
            limit 1
          `,
          [row.id],
        );
        row = refreshed.rows[0] || row;
      }
    } catch (error) {
      const trelloErrorMessage = sanitizeTrelloErrorMessage(
        error instanceof Error ? error.message : String(error),
      );
      const isTrelloNotConfigured = Boolean(error && typeof error === "object" && error.code === "TRELLO_NOT_CONFIGURED");
      if (isTrelloNotConfigured) {
        return {
          ok: false,
          statusCode: 503,
          error: "Trello not configured",
        };
      }

      const isTrelloAuthError = /\((401|403)\)/.test(trelloErrorMessage);
      if (isTrelloAuthError) {
        console.error("trello_sync_auth_error", {
          operationalItemId: row?.id || null,
          message: trelloErrorMessage,
        });
        return {
          ok: false,
          statusCode: 502,
          error: `Trello authentication failed: ${trelloErrorMessage}`,
        };
      }

      trello = {
        enabled: true,
        status: "failed",
        cardId: row?.trello_card_id || null,
        cardUrl: row?.trello_card_url || null,
        listId: row?.trello_list_id || null,
        error: trelloErrorMessage,
      };
    }
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      duplicate,
      item: toPublicRow(row),
      trello,
    },
  };
}

export async function handleOperationalList(dbPool, rawPayload) {
  const validation = buildListPayload(rawPayload);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: validation.message };
  }

  const payload = validation.payload;
  const values = [];
  const where = [];

  if (payload.tipo) {
    values.push(payload.tipo);
    where.push(`oi.tipo = $${values.length}`);
  }

  if (payload.status) {
    values.push(payload.status);
    where.push(`oi.status = $${values.length}`);
  }

  if (payload.cliente_id) {
    values.push(payload.cliente_id);
    where.push(`oi.cliente_id = $${values.length}`);
  }

  if (payload.search) {
    values.push(`%${payload.search}%`);
    where.push(`(oi.titulo ilike $${values.length} or oi.descricao ilike $${values.length})`);
  }

  values.push(payload.limit);
  const result = await dbPool.query(
    `
      select
        oi.*,
        c.nome as cliente_nome
      from public.operational_items oi
      left join public.clientes c on c.id = oi.cliente_id
      ${where.length > 0 ? `where ${where.join(" and ")}` : ""}
      order by oi.updated_at desc
      limit $${values.length}
    `,
    values,
  );

  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      items: result.rows.map(toPublicRow),
      count: result.rows.length,
    },
  };
}

export async function handleOperationalDelete(dbPool, rawPayload) {
  const validation = buildDeletePayload(rawPayload);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: validation.message };
  }

  const result = await dbPool.query(
    `
      delete from public.operational_items
      where id = $1
      returning id
    `,
    [validation.payload.id],
  );

  if (result.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Operational item not found" };
  }

  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      deleted_id: result.rows[0].id,
    },
  };
}
