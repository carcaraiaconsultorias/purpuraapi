import path from "node:path";

function getNumberEnv(name, defaultValue) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getBooleanEnv(name, defaultValue = false) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function getListEnv(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const apiPort = getNumberEnv("API_PORT", 3001);
const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();

export const config = {
  apiPort,
  nodeEnv,
  isProduction: nodeEnv === "production",
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${apiPort}`,
  apiSharedKey: process.env.API_SHARED_KEY || "",
  allowDevNoAuth: getBooleanEnv("ALLOW_DEV_NO_AUTH", false),
  corsOrigins: getListEnv("CORS_ORIGINS"),
  adminUser: process.env.ADMIN_USER || "",
  adminPass: process.env.ADMIN_PASS || "",
  sessionTtlMs: Math.max(60_000, getNumberEnv("SESSION_TTL_MS", 8 * 60 * 60 * 1000)),
  outboundHttpTimeoutMs: Math.max(1_000, getNumberEnv("OUTBOUND_HTTP_TIMEOUT_MS", 10_000)),
  databaseUrl: process.env.DATABASE_URL_PG || "",
  databaseSsl: getBooleanEnv("DATABASE_SSL", false),
  whatsappVerifyToken: process.env.WHATSAPP_TOKEN || "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  whatsappGraphApiBaseUrl: process.env.WHATSAPP_GRAPH_API_BASE_URL || "https://graph.facebook.com/v19.0",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappTemplateName: process.env.WHATSAPP_TEMPLATE_NAME || "",
  whatsappSenderEnabled: getBooleanEnv("WHATSAPP_SENDER_ENABLED", false),
  googleDriveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  googleServiceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "",
  googleDriveShareWithEmail: process.env.GOOGLE_DRIVE_SHARE_WITH_EMAIL || "",
  googleDriveShareRole: process.env.GOOGLE_DRIVE_SHARE_ROLE || "reader",
  googleDriveAllowPublic: getBooleanEnv("GOOGLE_DRIVE_ALLOW_PUBLIC", false),
  trelloApiBaseUrl: process.env.TRELLO_API_BASE_URL || "https://api.trello.com/1",
  trelloApiKey: process.env.TRELLO_API_KEY || "",
  trelloToken: process.env.TRELLO_TOKEN || "",
  trelloBoardId: process.env.TRELLO_BOARD_ID || "",
  trelloDefaultListId: process.env.TRELLO_DEFAULT_LIST_ID || "",
  trelloTaskListId: process.env.TRELLO_TASK_LIST_ID || "",
  trelloBriefingListId: process.env.TRELLO_BRIEFING_LIST_ID || "",
  trelloFollowUpListId: process.env.TRELLO_FOLLOW_UP_LIST_ID || "",
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || "",
  lovableApiKey: process.env.LOVABLE_API_KEY || "",
  uploadsDir: process.env.UPLOADS_DIR || path.join(process.cwd(), "backend", "uploads"),
};
