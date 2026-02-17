import { config } from "../config.mjs";

const TYPE_LABEL = {
  task: "Tarefa",
  briefing: "Briefing",
  follow_up: "Acompanhamento",
};

const STATUS_LABEL = {
  open: "Aberto",
  in_progress: "Em andamento",
  done: "Concluido",
  blocked: "Bloqueado",
};

const PRIORITY_LABEL = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const LIST_KEY_BY_TYPE = {
  task: "trelloTaskListId",
  briefing: "trelloBriefingListId",
  follow_up: "trelloFollowUpListId",
};

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function toDateIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function compactJson(value, maxLength = 5000) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const entries = Object.entries(value)
    .filter(([key, item]) => typeof key === "string" && key.trim().length > 0 && item !== undefined)
    .slice(0, 50);
  if (entries.length === 0) return "";
  const output = JSON.stringify(Object.fromEntries(entries), null, 2);
  return output.slice(0, maxLength);
}

export function resolveTrelloListId(type, appConfig = config) {
  const normalizedType = normalizeString(type, 40);
  const listKey = LIST_KEY_BY_TYPE[normalizedType];
  const specificListId = listKey ? normalizeString(appConfig[listKey], 120) : "";
  if (specificListId) return specificListId;
  const defaultListId = normalizeString(appConfig.trelloDefaultListId, 120);
  if (defaultListId) return defaultListId;
  throw new Error(`No Trello list configured for tipo=${normalizedType}`);
}

export function buildTrelloCardDescription(item) {
  const type = normalizeString(item?.tipo, 40);
  const status = normalizeString(item?.status, 40);
  const priority = normalizeString(item?.prioridade, 40);
  const clienteNome = normalizeString(item?.cliente_nome, 180);
  const responsavel = normalizeString(item?.responsavel, 180);
  const descricao = normalizeString(item?.descricao, 8000);
  const details = compactJson(item?.detalhes, 5000);
  const dueIso = toDateIso(item?.prazo_at);

  const lines = [
    `Tipo: ${TYPE_LABEL[type] || type || "-"}`,
    `Status: ${STATUS_LABEL[status] || status || "-"}`,
    `Prioridade: ${PRIORITY_LABEL[priority] || priority || "-"}`,
    `Responsavel: ${responsavel || "-"}`,
    `Cliente: ${clienteNome || "-"}`,
    `Item ID: ${normalizeString(item?.id, 80) || "-"}`,
    `Prazo: ${dueIso || "-"}`,
    `Atualizado: ${toDateIso(item?.updated_at) || "-"}`,
    "",
    descricao || "(Sem descricao)",
  ];

  if (details) {
    lines.push("", "Detalhes JSON:", "```json", details, "```");
  }

  return lines.join("\n").slice(0, 15000);
}

export function mapOperationalItemToTrelloCard(item, { appConfig = config } = {}) {
  const name = normalizeString(item?.titulo, 16384);
  if (name.length < 2) throw new Error("titulo is required");

  const idList = resolveTrelloListId(item?.tipo, appConfig);
  return {
    idList,
    name,
    desc: buildTrelloCardDescription(item),
    due: toDateIso(item?.prazo_at),
  };
}
