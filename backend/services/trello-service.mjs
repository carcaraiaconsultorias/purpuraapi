import { config } from "../config.mjs";
import { mapOperationalItemToTrelloCard } from "./trello-mapper.mjs";

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function toBaseUrl(appConfig) {
  const base = normalizeString(appConfig.trelloApiBaseUrl, 500) || "https://api.trello.com/1";
  return base.endsWith("/") ? base : `${base}/`;
}

function normalizeDateOrEmpty(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function normalizeNodeEnv(value) {
  const normalized = normalizeString(value, 40).toLowerCase();
  return normalized || "development";
}

function redactTrelloErrorDetail(detail) {
  const text = normalizeString(detail, 500);
  if (!text) return "";

  return text
    .replace(/([?&](?:key|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
}

function safeTrelloErrorDetail(detail, fallback = "request failed") {
  const redacted = redactTrelloErrorDetail(detail);
  return redacted || fallback;
}

function resolveTimeoutMs(appConfig) {
  const value = Number(appConfig?.outboundHttpTimeoutMs);
  if (!Number.isFinite(value) || value < 1_000) return 10_000;
  return Math.floor(value);
}

export function getTrelloEnvReadiness(appConfig = config, nodeEnv = process.env.NODE_ENV) {
  const required = [
    { key: "TRELLO_API_KEY", value: normalizeString(appConfig.trelloApiKey, 300) },
    { key: "TRELLO_TOKEN", value: normalizeString(appConfig.trelloToken, 500) },
  ];

  const listCandidates = [
    { key: "TRELLO_DEFAULT_LIST_ID", value: normalizeString(appConfig.trelloDefaultListId, 120) },
    { key: "TRELLO_TASK_LIST_ID", value: normalizeString(appConfig.trelloTaskListId, 120) },
    { key: "TRELLO_BRIEFING_LIST_ID", value: normalizeString(appConfig.trelloBriefingListId, 120) },
    { key: "TRELLO_FOLLOW_UP_LIST_ID", value: normalizeString(appConfig.trelloFollowUpListId, 120) },
  ];

  const missing = [];
  for (const item of required) {
    if (!item.value) missing.push(item.key);
  }

  const hasAnyList = listCandidates.some((item) => item.value);
  if (!hasAnyList) {
    missing.push("TRELLO_DEFAULT_LIST_ID|TRELLO_TASK_LIST_ID|TRELLO_BRIEFING_LIST_ID|TRELLO_FOLLOW_UP_LIST_ID");
  }

  const currentNodeEnv = normalizeNodeEnv(nodeEnv);
  return {
    ready: missing.length === 0,
    missing,
    nodeEnv: currentNodeEnv,
    allowSkipNotConfigured: currentNodeEnv !== "production",
    statusByKey: [
      ...required.map((item) => ({ key: item.key, status: item.value ? "PRESENT" : "EMPTY" })),
      ...listCandidates.map((item) => ({ key: item.key, status: item.value ? "PRESENT" : "EMPTY" })),
    ],
  };
}

export function hasTrelloConfig(appConfig = config) {
  return getTrelloEnvReadiness(appConfig, appConfig.nodeEnv).ready;
}

async function trelloRequest({
  appConfig = config,
  method = "GET",
  path,
  query = {},
}) {
  const key = normalizeString(appConfig.trelloApiKey, 300);
  const token = normalizeString(appConfig.trelloToken, 500);
  if (!key || !token) throw new Error("Trello API credentials are not configured");

  const relativePath = normalizeString(path, 500).replace(/^\/+/, "");
  const url = new URL(relativePath, toBaseUrl(appConfig));
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);

  for (const [queryKey, queryValue] of Object.entries(query)) {
    if (queryValue === null || queryValue === undefined || queryValue === "") continue;
    url.searchParams.set(queryKey, String(queryValue));
  }

  let response;
  const timeoutMs = resolveTimeoutMs(appConfig);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(url.toString(), {
      method,
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Trello request timeout (${timeoutMs}ms)`);
    }
    const detail = safeTrelloErrorDetail(error instanceof Error ? error.message : String(error), "network error");
    throw new Error(`Trello request failed (network): ${detail}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await response.text();
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    const detail = safeTrelloErrorDetail(responseText.slice(0, 500));
    throw new Error(`Trello request failed (${response.status}): ${detail}`);
  }

  return responseData;
}

export async function createTrelloCardFromOperationalItem(item, { appConfig = config } = {}) {
  const mapped = mapOperationalItemToTrelloCard(item, { appConfig });
  const created = await trelloRequest({
    appConfig,
    method: "POST",
    path: "cards",
    query: {
      idList: mapped.idList,
      name: mapped.name,
      desc: mapped.desc,
      due: normalizeDateOrEmpty(mapped.due),
      pos: "bottom",
    },
  });

  return {
    id: normalizeString(created?.id, 120),
    url: normalizeString(created?.url, 1000),
    idList: normalizeString(created?.idList, 120) || mapped.idList,
  };
}

export async function updateTrelloCardFromOperationalItem(item, { appConfig = config } = {}) {
  const cardId = normalizeString(item?.trello_card_id, 120);
  if (!cardId) throw new Error("trello_card_id is required to update card");

  const mapped = mapOperationalItemToTrelloCard(item, { appConfig });
  const updated = await trelloRequest({
    appConfig,
    method: "PUT",
    path: `cards/${cardId}`,
    query: {
      idList: mapped.idList,
      name: mapped.name,
      desc: mapped.desc,
      due: normalizeDateOrEmpty(mapped.due),
    },
  });

  return {
    id: normalizeString(updated?.id, 120) || cardId,
    url: normalizeString(updated?.url, 1000) || normalizeString(item?.trello_card_url, 1000),
    idList: normalizeString(updated?.idList, 120) || mapped.idList,
  };
}

export async function syncOperationalItemToTrello(item, { appConfig = config } = {}) {
  const readiness = getTrelloEnvReadiness(appConfig, appConfig.nodeEnv);
  if (!readiness.ready) {
    if (!readiness.allowSkipNotConfigured) {
      const error = new Error("Trello not configured");
      error.code = "TRELLO_NOT_CONFIGURED";
      error.httpStatus = 503;
      throw error;
    }

    return {
      enabled: false,
      status: "skipped_not_configured",
      cardId: normalizeString(item?.trello_card_id, 120) || null,
      cardUrl: normalizeString(item?.trello_card_url, 1000) || null,
      listId: null,
    };
  }

  const hasCard = normalizeString(item?.trello_card_id, 120).length > 0;
  const card = hasCard
    ? await updateTrelloCardFromOperationalItem(item, { appConfig })
    : await createTrelloCardFromOperationalItem(item, { appConfig });

  return {
    enabled: true,
    status: hasCard ? "updated" : "created",
    cardId: card.id || null,
    cardUrl: card.url || null,
    listId: card.idList || null,
  };
}
