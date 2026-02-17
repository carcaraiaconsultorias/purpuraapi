import { config } from "../config.mjs";

function normalizeString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePhoneToProvider(phone) {
  const digits = normalizeString(phone, 40).replace(/\D/g, "");
  return digits;
}

function toGraphBaseUrl(appConfig) {
  const base = normalizeString(appConfig.whatsappGraphApiBaseUrl, 500) || "https://graph.facebook.com/v19.0";
  return base.replace(/\/+$/, "");
}

function redactErrorDetail(detail) {
  const text = normalizeString(detail, 600);
  if (!text) return "";
  return text
    .replace(/(bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:access[_-]?token|token|authorization)\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
}

function safeErrorDetail(detail, fallback = "request failed") {
  const redacted = redactErrorDetail(detail);
  return redacted || fallback;
}

function resolveTimeoutMs(appConfig) {
  const value = Number(appConfig?.outboundHttpTimeoutMs);
  if (!Number.isFinite(value) || value < 1_000) return 10_000;
  return Math.floor(value);
}

export async function sendWhatsAppText(
  { toPhoneE164, bodyText, metadata = null },
  { appConfig = config } = {},
) {
  const phoneNumberId = normalizeString(appConfig.whatsappPhoneNumberId, 120);
  const accessToken = normalizeString(appConfig.whatsappAccessToken, 2048);
  const to = normalizePhoneToProvider(toPhoneE164);
  const text = normalizeString(bodyText, 4000);

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp sender is not configured");
  }

  if (!to) {
    throw new Error("Invalid WhatsApp destination phone");
  }

  if (!text) {
    throw new Error("Message body is required");
  }

  const url = `${toGraphBaseUrl(appConfig)}/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
    metadata: metadata && typeof metadata === "object" ? metadata : undefined,
  };

  let response;
  const timeoutMs = resolveTimeoutMs(appConfig);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`WhatsApp request timeout (${timeoutMs}ms)`);
    }
    const detail = safeErrorDetail(error instanceof Error ? error.message : String(error), "network error");
    throw new Error(`WhatsApp request failed (network): ${detail}`);
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
    if (response.status === 401 || response.status === 403) {
      throw new Error(`WhatsApp auth failed (${response.status})`);
    }
    if (response.status === 429) {
      throw new Error("WhatsApp rate limited (429)");
    }
    if (response.status >= 500) {
      throw new Error(`WhatsApp provider error (${response.status})`);
    }
    const detail = safeErrorDetail(responseText, "request failed");
    throw new Error(`WhatsApp request failed (${response.status}): ${detail}`);
  }

  const providerMessageId = normalizeString(responseData?.messages?.[0]?.id, 220);
  return {
    providerMessageId: providerMessageId || null,
    responseData,
  };
}
