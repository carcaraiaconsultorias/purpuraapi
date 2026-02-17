import { config } from "../config.mjs";
import { sendWhatsAppText } from "./whatsapp-send-service.mjs";

const VALID_MODES = new Set(["today", "tomorrow"]);

function normalizeString(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePhone(phone) {
  const digits = normalizeString(phone, 40).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+${digits}`;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  return fallback;
}

function toDateText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

function formatDatePtBr(dateText) {
  const parsed = new Date(`${dateText}T00:00:00-03:00`);
  if (Number.isNaN(parsed.getTime())) return dateText;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Belem",
  });
}

function buildReminderMessage({ relevoDate, tipo }) {
  const formattedDate = formatDatePtBr(relevoDate);
  const reminderType = normalizeString(tipo, 80) || "relevo";
  return `Lembrete da Agencia Purpura: hoje (${formattedDate}) e dia de ${reminderType}. Responda esta mensagem para continuidade do onboarding.`;
}

function normalizeErrorSummary(error) {
  if (!error) return "unknown_error";
  if (error instanceof Error) return normalizeString(error.message, 240) || "unknown_error";
  return normalizeString(String(error), 240) || "unknown_error";
}

export function normalizeReminderMode(mode) {
  const normalized = normalizeString(mode, 20).toLowerCase();
  return VALID_MODES.has(normalized) ? normalized : "today";
}

async function resolveTargetDate(dbPool, mode) {
  const dayOffset = mode === "tomorrow" ? 1 : 0;
  const result = await dbPool.query(
    `
      select ((now() at time zone 'America/Belem')::date + $1::int)::date as target_date
    `,
    [dayOffset],
  );
  return toDateText(result.rows[0]?.target_date);
}

async function listEligibleRelevoDates(dbPool, targetDate) {
  const result = await dbPool.query(
    `
      select
        id,
        cliente_id,
        phone_e164,
        relevo_date,
        tipo,
        timezone
      from public.relevo_dates
      where ativo = true
        and relevo_date = $1::date
      order by created_at asc
    `,
    [targetDate],
  );
  return result.rows.map((row) => ({
    id: row.id,
    clienteId: row.cliente_id || null,
    phoneE164: normalizePhone(row.phone_e164),
    relevoDate: toDateText(row.relevo_date),
    tipo: normalizeString(row.tipo, 80) || "relevo",
    timezone: normalizeString(row.timezone, 120) || "America/Belem",
  }));
}

async function insertDryRunLog(dbPool, item, mode) {
  const result = await dbPool.query(
    `
      insert into public.reminder_logs (
        cliente_id,
        phone_e164,
        relevo_date,
        tipo,
        status,
        payload
      )
      values (
        $1::uuid,
        $2::text,
        $3::date,
        $4::text,
        'dry_run',
        $5::jsonb
      )
      on conflict (phone_e164, relevo_date, tipo)
      where status in ('sent', 'dry_run')
      do nothing
      returning id
    `,
    [
      item.clienteId,
      item.phoneE164,
      item.relevoDate,
      item.tipo,
      {
        source: "run_reminders",
        mode,
        dry_run: true,
      },
    ],
  );
  return result.rows[0]?.id || null;
}

async function reserveSendLog(dbPool, item, mode) {
  const result = await dbPool.query(
    `
      insert into public.reminder_logs (
        cliente_id,
        phone_e164,
        relevo_date,
        tipo,
        status,
        sent_at,
        payload
      )
      values (
        $1::uuid,
        $2::text,
        $3::date,
        $4::text,
        'sent',
        now(),
        $5::jsonb
      )
      on conflict (phone_e164, relevo_date, tipo)
      where status in ('sent', 'dry_run')
      do nothing
      returning id
    `,
    [
      item.clienteId,
      item.phoneE164,
      item.relevoDate,
      item.tipo,
      {
        source: "run_reminders",
        mode,
        dry_run: false,
      },
    ],
  );
  return result.rows[0]?.id || null;
}

async function markFailed(dbPool, logId, errorSummary, payload = null) {
  await dbPool.query(
    `
      update public.reminder_logs
      set
        status = 'failed',
        provider_message_id = null,
        sent_at = null,
        error_summary = $2::text,
        payload = $3::jsonb
      where id = $1::uuid
    `,
    [logId, normalizeString(errorSummary, 240), payload],
  );
}

async function markSent(dbPool, logId, providerMessageId, payload = null) {
  await dbPool.query(
    `
      update public.reminder_logs
      set
        status = 'sent',
        provider_message_id = $2::text,
        sent_at = now(),
        error_summary = null,
        payload = $3::jsonb
      where id = $1::uuid
    `,
    [logId, normalizeString(providerMessageId, 220) || null, payload],
  );
}

export async function runReminders(
  dbPool,
  { dateMode = "today", dryRun = true } = {},
  { appConfig = config } = {},
) {
  const mode = normalizeReminderMode(dateMode);
  const dryRunEnabled = toBoolean(dryRun, true);
  const senderEnabled = Boolean(appConfig.whatsappSenderEnabled);

  const targetDate = await resolveTargetDate(dbPool, mode);
  const eligibleItems = await listEligibleRelevoDates(dbPool, targetDate);

  console.log("reminder_run_started", {
    mode,
    dryRun: dryRunEnabled,
    target_date: targetDate,
    countEligible: eligibleItems.length,
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of eligibleItems) {
    if (!item.phoneE164 || !item.relevoDate) {
      failed += 1;
      continue;
    }

    if (dryRunEnabled) {
      const logId = await insertDryRunLog(dbPool, item, mode);
      if (!logId) {
        skipped += 1;
        console.log("reminder_skipped_duplicate", {
          phone: item.phoneE164,
          relevo_date: item.relevoDate,
          tipo: item.tipo,
        });
        continue;
      }
      processed += 1;
      continue;
    }

    const reservedLogId = await reserveSendLog(dbPool, item, mode);
    if (!reservedLogId) {
      skipped += 1;
      console.log("reminder_skipped_duplicate", {
        phone: item.phoneE164,
        relevo_date: item.relevoDate,
        tipo: item.tipo,
      });
      continue;
    }

    processed += 1;

    if (!senderEnabled) {
      failed += 1;
      await markFailed(dbPool, reservedLogId, "sender disabled", {
        source: "run_reminders",
        mode,
        dry_run: false,
      });
      console.log("reminder_failed", {
        phone: item.phoneE164,
        relevo_date: item.relevoDate,
        tipo: item.tipo,
        error: "sender disabled",
      });
      continue;
    }

    try {
      const sendResult = await sendWhatsAppText(
        {
          toPhoneE164: item.phoneE164,
          bodyText: buildReminderMessage(item),
          metadata: {
            tipo: item.tipo,
            relevo_date: item.relevoDate,
            source: "run_reminders",
          },
        },
        { appConfig },
      );

      await markSent(dbPool, reservedLogId, sendResult.providerMessageId, {
        source: "run_reminders",
        provider_response: sendResult.responseData,
      });
      sent += 1;
      console.log("reminder_sent", {
        phone: item.phoneE164,
        relevo_date: item.relevoDate,
        tipo: item.tipo,
        provider_message_id: sendResult.providerMessageId || null,
      });
    } catch (error) {
      const errorSummary = normalizeErrorSummary(error);
      await markFailed(dbPool, reservedLogId, errorSummary, {
        source: "run_reminders",
        error_summary: errorSummary,
      });
      failed += 1;
      console.log("reminder_failed", {
        phone: item.phoneE164,
        relevo_date: item.relevoDate,
        tipo: item.tipo,
        error: errorSummary,
      });
    }
  }

  return {
    ok: true,
    mode,
    dryRun: dryRunEnabled,
    target_date: targetDate,
    processed,
    sent,
    skipped,
    failed,
  };
}
