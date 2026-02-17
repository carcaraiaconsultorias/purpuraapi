import fs from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.mjs";
import { pool } from "./db/pool.mjs";
import { executeTableQuery } from "./services/query-service.mjs";
import {
  handleOnboardingDashboard,
  handleOnboardingIntake,
  handleOnboardingStatus,
  handleOnboardingTransition,
  processOnboardingEvent,
} from "./services/onboarding-service.mjs";
import { handleOperationalDelete, handleOperationalList, handleOperationalUpsert } from "./services/operational-service.mjs";
import { verifyMetaSignature } from "./services/whatsapp-signature.mjs";
import { extractOnboardingEvents } from "./services/whatsapp-mapper.mjs";
import { fetchSocialStats } from "./services/social-stats-service.mjs";
import { streamSuperagenteResponse } from "./services/superagente-chat-service.mjs";
import { saveBase64Upload, toPublicUploadUrl } from "./services/storage-service.mjs";
import { runReminders } from "./services/reminders-service.mjs";

function normalizeText(value, maxLength = 3000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeOrigin(value) {
  const text = normalizeText(value, 2_000);
  if (!text) return "";
  return text.replace(/\/+$/, "").toLowerCase();
}

function pickApiKey(req) {
  const direct = req.header("x-api-key");
  if (direct) return direct;
  const authorization = req.header("authorization");
  if (authorization && /^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, "").trim();
  }
  return "";
}

function parseCookies(cookieHeader) {
  const cookies = {};
  const text = normalizeText(cookieHeader, 20_000);
  if (!text) return cookies;

  const parts = text.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.split("=");
    const key = normalizeText(rawKey, 200);
    if (!key) continue;
    const value = rest.join("=");
    cookies[key] = decodeURIComponent(value || "");
  }
  return cookies;
}

function resolveAllowedOrigins(appConfig) {
  const allowed = new Set(["http://localhost:5173", "http://localhost:3000"]);
  for (const origin of appConfig.corsOrigins || []) {
    const normalized = normalizeOrigin(origin);
    if (normalized) allowed.add(normalized);
  }
  return allowed;
}

function createSessionStore() {
  const sessions = new Map();

  function create(user, ttlMs) {
    const token = randomBytes(32).toString("hex");
    sessions.set(token, {
      user,
      expiresAt: Date.now() + ttlMs,
    });
    return token;
  }

  function read(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      sessions.delete(token);
      return null;
    }
    return session;
  }

  function remove(token) {
    if (!token) return;
    sessions.delete(token);
  }

  function cleanup() {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  }

  return {
    create,
    read,
    remove,
    cleanup,
  };
}

function buildSessionCookie(token, appConfig) {
  const sessionTtlMs = Number.isFinite(Number(appConfig?.sessionTtlMs))
    ? Math.max(60_000, Math.floor(Number(appConfig.sessionTtlMs)))
    : 8 * 60 * 60 * 1000;
  const cookieParts = [
    `session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(sessionTtlMs / 1000)}`,
  ];
  if (appConfig.isProduction) cookieParts.push("Secure");
  return cookieParts.join("; ");
}

function buildExpiredSessionCookie(appConfig) {
  const cookieParts = [
    "session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (appConfig.isProduction) cookieParts.push("Secure");
  return cookieParts.join("; ");
}

function createAuthGuard(appConfig, sessionStore) {
  return function authGuard(req, res, next) {
    if (!appConfig.isProduction && appConfig.allowDevNoAuth) return next();

    const cookies = parseCookies(req.header("cookie"));
    const session = sessionStore.read(cookies.session || "");
    if (session) return next();

    if (!appConfig.isProduction && appConfig.apiSharedKey) {
      const provided = pickApiKey(req);
      if (provided && provided === appConfig.apiSharedKey) return next();
    }

    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

function withRequestId(req, res, next) {
  req.requestId = req.header("x-request-id") || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  return next();
}

function addCors(req, res, next, appConfig) {
  const allowedOrigins = resolveAllowedOrigins(appConfig);
  const requestOrigin = normalizeOrigin(req.header("origin"));

  if (requestOrigin) {
    if (!allowedOrigins.has(requestOrigin)) {
      return res.status(403).json({ ok: false, error: "CORS origin not allowed" });
    }
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-api-key, x-request-id, x-hub-signature-256");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }
  return next();
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ ok: false, error: message });
}

async function handleWhatsappWebhookPost(req, res, dbPool, appConfig) {
  if (!appConfig.whatsappAppSecret) {
    return sendError(res, 500, "WHATSAPP_APP_SECRET is not configured");
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!rawBody) return sendError(res, 400, "Empty body");

  const signature = req.header("x-hub-signature-256");
  const isValid = verifyMetaSignature(rawBody, signature, appConfig.whatsappAppSecret);
  if (!isValid) return sendError(res, 401, "Unauthorized");

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return sendError(res, 400, "Invalid JSON");
  }

  const events = extractOnboardingEvents(payload);
  if (events.length === 0) {
    return res.status(200).json({
      ok: true,
      processed: 0,
      duplicates: 0,
      request_id: req.requestId,
    });
  }

  const maxEvents = 50;
  const toProcess = events.slice(0, maxEvents);
  let duplicates = 0;

  for (const event of toProcess) {
    const row = await processOnboardingEvent(dbPool, {
      phone: event.phone,
      providerMessageId: event.providerMessageId,
      direction: event.direction,
      payload: event.payload,
      eventTimestamp: event.eventTimestamp,
      status: event.status,
      clienteData: event.clienteData,
    });
    if (row?.duplicate) duplicates += 1;
  }

  return res.status(200).json({
    ok: true,
    processed: toProcess.length,
    duplicates,
    request_id: req.requestId,
  });
}

export function createServerApp({ dbPool = pool, appConfig = config } = {}) {
  const app = express();
  const sessionStore = createSessionStore();
  const guard = createAuthGuard(appConfig, sessionStore);

  app.disable("x-powered-by");
  app.use(withRequestId);
  app.use((req, res, next) => addCors(req, res, next, appConfig));
  app.use((_req, _res, next) => {
    sessionStore.cleanup();
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get(["/whatsapp-webhook", "/webhooks/whatsapp"], (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === appConfig.whatsappVerifyToken && typeof challenge === "string") {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("forbidden");
  });

  app.post(["/whatsapp-webhook", "/webhooks/whatsapp"], express.raw({ type: "*/*", limit: "3mb" }), async (req, res) => {
    try {
      await handleWhatsappWebhookPost(req, res, dbPool, appConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      console.error("whatsapp_webhook_error", { requestId: req.requestId, message });
      sendError(res, 500, "Internal error");
    }
  });

  app.use(express.json({ limit: "3mb" }));

  app.post("/auth/login", (req, res) => {
    const username = normalizeText(req.body?.username, 200).toLowerCase();
    const password = normalizeText(req.body?.password, 400);
    const adminUser = normalizeText(appConfig.adminUser, 200).toLowerCase();
    const adminPass = String(appConfig.adminPass || "");

    if (!adminUser || !adminPass) {
      return sendError(res, 503, "Auth is not configured");
    }

    if (!username || !password || username !== adminUser || password !== adminPass) {
      return sendError(res, 401, "Invalid credentials");
    }

    const sessionTtlMs = Number.isFinite(Number(appConfig?.sessionTtlMs))
      ? Math.max(60_000, Math.floor(Number(appConfig.sessionTtlMs)))
      : 8 * 60 * 60 * 1000;
    const token = sessionStore.create(
      {
        email: adminUser,
        name: "Administradora Purpura",
        company: "Agencia Purpura",
      },
      sessionTtlMs,
    );

    res.setHeader("Set-Cookie", buildSessionCookie(token, appConfig));
    return res.status(200).json({
      ok: true,
      user: {
        email: adminUser,
        name: "Administradora Purpura",
        company: "Agencia Purpura",
      },
    });
  });

  app.post("/auth/logout", (req, res) => {
    const cookies = parseCookies(req.header("cookie"));
    const token = normalizeText(cookies.session, 1_000);
    sessionStore.remove(token);
    res.setHeader("Set-Cookie", buildExpiredSessionCookie(appConfig));
    return res.status(200).json({ ok: true });
  });

  app.get("/auth/me", (req, res) => {
    if (!appConfig.isProduction && appConfig.allowDevNoAuth) {
      return res.status(200).json({
        ok: true,
        user: {
          email: "dev@local",
          name: "Modo Desenvolvimento",
          company: "Agencia Purpura",
        },
      });
    }

    const cookies = parseCookies(req.header("cookie"));
    const session = sessionStore.read(cookies.session || "");
    if (!session) return sendError(res, 401, "Unauthorized");
    return res.status(200).json({ ok: true, user: session.user });
  });

  app.post("/db/query", guard, async (req, res) => {
    try {
      const data = await executeTableQuery(dbPool, req.body || {});
      return res.status(200).json({ ok: true, data, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";
      return res.status(400).json({ ok: false, data: null, error: { message } });
    }
  });

  app.post("/storage/upload", guard, async (req, res) => {
    try {
      const bucket = normalizeText(req.body?.bucket, 80);
      const relativePath = normalizeText(req.body?.path, 260);
      const dataBase64 = normalizeText(req.body?.dataBase64, 30_000_000);

      if (bucket !== "uploads") return sendError(res, 400, "Only uploads bucket is supported");
      if (!relativePath) return sendError(res, 400, "path is required");
      if (!dataBase64) return sendError(res, 400, "dataBase64 is required");

      const savedPath = await saveBase64Upload({
        uploadsDir: appConfig.uploadsDir,
        relativePath,
        base64Data: dataBase64,
      });

      return res.status(200).json({
        ok: true,
        data: {
          path: savedPath,
          publicUrl: toPublicUploadUrl(appConfig.apiPublicUrl, savedPath),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return sendError(res, 400, message);
    }
  });

  app.use("/uploads", express.static(appConfig.uploadsDir));

  const onboardingIntakeHandler = async (req, res) => {
    try {
      const result = await handleOnboardingIntake(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  const onboardingStatusHandler = async (req, res) => {
    try {
      const result = await handleOnboardingStatus(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  app.post("/onboarding-intake", guard, onboardingIntakeHandler);
  app.post("/functions/onboarding-intake", guard, onboardingIntakeHandler);
  app.post("/onboarding-status", guard, onboardingStatusHandler);
  app.post("/functions/onboarding-status", guard, onboardingStatusHandler);

  const onboardingDashboardHandler = async (req, res) => {
    try {
      const result = await handleOnboardingDashboard(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  const onboardingTransitionHandler = async (req, res) => {
    try {
      const result = await handleOnboardingTransition(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  app.post("/onboarding-dashboard", guard, onboardingDashboardHandler);
  app.post("/functions/onboarding-dashboard", guard, onboardingDashboardHandler);
  app.post("/onboarding-transition", guard, onboardingTransitionHandler);
  app.post("/functions/onboarding-transition", guard, onboardingTransitionHandler);

  const operationalUpsertHandler = async (req, res) => {
    try {
      const result = await handleOperationalUpsert(dbPool, req.body || {}, { appConfig });
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  const operationalListHandler = async (req, res) => {
    try {
      const result = await handleOperationalList(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  const operationalDeleteHandler = async (req, res) => {
    try {
      const result = await handleOperationalDelete(dbPool, req.body || {});
      if (!result.ok) return sendError(res, result.statusCode, result.error);
      return res.status(200).json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  app.post("/operational-upsert", guard, operationalUpsertHandler);
  app.post("/functions/operational-upsert", guard, operationalUpsertHandler);
  app.post("/operational-list", guard, operationalListHandler);
  app.post("/functions/operational-list", guard, operationalListHandler);
  app.post("/operational-delete", guard, operationalDeleteHandler);
  app.post("/functions/operational-delete", guard, operationalDeleteHandler);

  app.post("/functions/fetch-social-stats", guard, async (req, res) => {
    try {
      const platform = normalizeText(req.body?.platform, 120);
      const username = normalizeText(req.body?.username, 160);
      if (!platform || !username) return sendError(res, 400, "Platform and username are required");

      const result = await fetchSocialStats({
        firecrawlApiKey: appConfig.firecrawlApiKey,
        platform,
        username,
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        results_count: result.resultsCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  });

  app.post("/functions/superagente-chat", guard, async (req, res) => {
    try {
      const agentType = normalizeText(req.body?.agentType, 30) || "onboarding";
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      await streamSuperagenteResponse({
        apiKey: appConfig.lovableApiKey,
        agentType,
        messages,
        res,
      });
    } catch (error) {
      const statusCode = Number(error?.status) || 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      if (!res.headersSent) {
        res.status(statusCode).json({ error: message });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  const runRemindersHandler = async (req, res) => {
    try {
      const mode = normalizeText(req.body?.mode, 20) || "today";
      const result = await runReminders(
        dbPool,
        {
          dateMode: mode,
          dryRun: req.body?.dry_run,
        },
        { appConfig },
      );
      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return sendError(res, 500, message);
    }
  };

  app.post("/run-reminders", guard, runRemindersHandler);
  app.post("/functions/run-reminders", guard, runRemindersHandler);

  return app;
}

export async function startServer({ dbPool = pool, appConfig = config } = {}) {
  await fs.mkdir(appConfig.uploadsDir, { recursive: true });
  const app = createServerApp({ dbPool, appConfig });
  return new Promise((resolve) => {
    const server = app.listen(appConfig.apiPort, () => {
      console.log(`PG server running on ${appConfig.apiPort}`);
      resolve(server);
    });
  });
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
