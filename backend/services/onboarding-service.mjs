import { randomUUID } from "node:crypto";
import { ensureClientDriveFolder } from "./google-drive-service.mjs";

const VALID_STATUSES = new Set(["new", "started", "in_progress", "awaiting_client", "completed", "failed"]);

function normalizeString(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePhone(phone) {
  const digits = normalizeString(phone, 30).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+${digits}`;
}

function normalizeUuid(value) {
  const text = normalizeString(value, 80);
  if (!text) return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    return "";
  }
  return text.toLowerCase();
}

function normalizeNumber(value, fallback = 20, min = 1, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function validateIntakePayload(input) {
  if (!input || typeof input !== "object") return { valid: false, message: "Invalid payload" };

  const serviceName = normalizeString(input.service_name, 120);
  const nome = normalizeString(input.nome, 180);
  const whatsapp = normalizePhone(input.whatsapp);
  const aceiteTermos = input.aceiteTermos === true;

  if (serviceName.length < 2) return { valid: false, message: "service_name is required" };
  if (nome.length < 2) return { valid: false, message: "nome is required" };
  if (whatsapp.length < 10) return { valid: false, message: "whatsapp is required" };
  if (!aceiteTermos) return { valid: false, message: "aceiteTermos must be true" };

  return {
    valid: true,
    payload: {
      service_name: serviceName,
      nome,
      email: normalizeString(input.email, 180),
      whatsapp,
      empresa: normalizeString(input.empresa, 180),
      cargo: normalizeString(input.cargo, 160),
      site: normalizeString(input.site, 240),
      segmento: normalizeString(input.segmento, 120),
      porte: normalizeString(input.porte, 80),
      canais: Array.isArray(input.canais) ? input.canais.map((v) => normalizeString(String(v), 80)).filter(Boolean) : [],
      regiao: normalizeString(input.regiao, 120),
      objetivos: Array.isArray(input.objetivos) ? input.objetivos.map((v) => normalizeString(String(v), 180)).filter(Boolean) : [],
      observacoes: normalizeString(input.observacoes, 2_000),
      aceiteTermos,
    },
  };
}

export async function processOnboardingEvent(dbPool, input) {
  const phone = normalizePhone(input?.phone);
  const providerMessageId = normalizeString(input?.providerMessageId, 200);
  const direction = normalizeString(input?.direction, 20);
  const eventTimestamp = input?.eventTimestamp ? new Date(input.eventTimestamp).toISOString() : new Date().toISOString();
  const status = normalizeString(input?.status, 40);
  const payload = input?.payload && typeof input.payload === "object" ? input.payload : {};
  const clienteData = input?.clienteData && typeof input.clienteData === "object" ? input.clienteData : {};

  if (!phone) throw new Error("Invalid phone");
  if (!providerMessageId) throw new Error("providerMessageId is required");
  if (!["inbound", "outbound", "system"].includes(direction)) throw new Error("Invalid direction");
  if (status && !VALID_STATUSES.has(status)) throw new Error("Invalid status");

  const query = `
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
  `;

  const result = await dbPool.query(query, [
    phone,
    providerMessageId,
    direction,
    payload,
    eventTimestamp,
    status || null,
    clienteData,
  ]);

  return result.rows[0] ?? null;
}

export async function handleOnboardingIntake(dbPool, rawPayload) {
  const validation = validateIntakePayload(rawPayload);
  if (!validation.valid) {
    return { ok: false, statusCode: 400, error: validation.message };
  }

  const payload = validation.payload;
  const providerMessageId = `frontend-${randomUUID()}`;
  const eventTimestamp = new Date().toISOString();

  const row = await processOnboardingEvent(dbPool, {
    phone: payload.whatsapp,
    providerMessageId,
    direction: "outbound",
    payload: {
      source: "frontend_intake",
      service_name: payload.service_name,
      form: payload,
    },
    eventTimestamp,
    status: "started",
    clienteData: {
      nome: payload.nome,
      email: payload.email || null,
      telefone: payload.whatsapp,
    },
  });

  if (!row) {
    return { ok: false, statusCode: 500, error: "No data returned from process_whatsapp_onboarding_event" };
  }

  const driveFolder = await ensureClientDriveFolder({
    dbPool,
    clienteId: row.cliente_id,
    fallbackNome: payload.nome,
  });

  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      session_id: row.session_id,
      cliente_id: row.cliente_id,
      tracking_token: row.tracking_token,
      status: row.status,
      status_updated_at: row.status_updated_at,
      duplicate: row.duplicate,
      drive_folder_status: driveFolder.status,
      drive_folder_id: driveFolder.folderId || null,
      drive_folder_url: driveFolder.folderUrl || null,
    },
  };
}

export async function handleOnboardingStatus(dbPool, rawPayload) {
  const trackingToken = normalizeString(rawPayload?.tracking_token, 80);
  if (!trackingToken) {
    return { ok: false, statusCode: 400, error: "tracking_token is required" };
  }

  const result = await dbPool.query(
    `
      select id, current_status, status_updated_at, last_message_at, created_at
      from public.onboarding_sessions
      where tracking_token::text = $1
      limit 1
    `,
    [trackingToken],
  );

  if (result.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Session not found" };
  }

  const row = result.rows[0];
  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      session_id: row.id,
      status: row.current_status,
      status_updated_at: row.status_updated_at,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
    },
  };
}

export async function handleOnboardingDashboard(dbPool, rawPayload) {
  const limit = normalizeNumber(rawPayload?.limit, 20, 1, 100);

  const [statsResult, foldersResult, sessionsResult] = await Promise.all([
    dbPool.query(
      `
        select
          count(*)::int as total,
          count(*) filter (where current_status = 'completed')::int as completed,
          count(*) filter (where current_status in ('started', 'in_progress', 'awaiting_client'))::int as active,
          count(*) filter (where current_status = 'failed')::int as failed,
          coalesce(avg(extract(epoch from (status_updated_at - created_at))) filter (where current_status = 'completed'), 0)::float as avg_completed_seconds
        from public.onboarding_sessions
      `,
    ),
    dbPool.query(
      `
        select count(*)::int as total
        from public.clientes
        where drive_folder_id is not null
      `,
    ),
    dbPool.query(
      `
        select
          s.id,
          s.tracking_token,
          s.phone_e164,
          s.current_status,
          s.status_updated_at,
          s.created_at,
          s.last_message_at,
          s.last_provider_message_id,
          s.cliente_id,
          c.nome as cliente_nome,
          c.drive_folder_id,
          c.drive_folder_url,
          c.onboarding_status as cliente_onboarding_status,
          coalesce(msg.total_messages, 0)::int as total_messages
        from public.onboarding_sessions s
        left join public.clientes c on c.id = s.cliente_id
        left join lateral (
          select count(*)::int as total_messages
          from public.onboarding_messages m
          where m.session_id = s.id
        ) msg on true
        order by s.status_updated_at desc, s.updated_at desc
        limit $1
      `,
      [limit],
    ),
  ]);

  const stats = statsResult.rows[0] || {
    total: 0,
    completed: 0,
    active: 0,
    failed: 0,
    avg_completed_seconds: 0,
  };

  return {
    ok: true,
    statusCode: 200,
    data: {
      ok: true,
      stats: {
        total_sessions: stats.total ?? 0,
        completed_sessions: stats.completed ?? 0,
        active_sessions: stats.active ?? 0,
        failed_sessions: stats.failed ?? 0,
        completion_rate_pct: (stats.total ?? 0) > 0 ? Math.round(((stats.completed ?? 0) / stats.total) * 100) : 0,
        avg_completion_seconds: Number(stats.avg_completed_seconds ?? 0),
        avg_completion_days: Number((Number(stats.avg_completed_seconds ?? 0) / 86_400).toFixed(2)),
        drive_folders_created: foldersResult.rows[0]?.total ?? 0,
      },
      recent_sessions: sessionsResult.rows,
    },
  };
}

export async function handleOnboardingTransition(dbPool, rawPayload) {
  const sessionId = normalizeUuid(rawPayload?.session_id);
  const trackingToken = normalizeString(rawPayload?.tracking_token, 80);
  const nextStatus = normalizeString(rawPayload?.status, 40);
  const reason = normalizeString(rawPayload?.reason, 240) || "dashboard_manual_transition";

  if (!sessionId && !trackingToken) {
    return { ok: false, statusCode: 400, error: "session_id or tracking_token is required" };
  }

  if (!nextStatus || !VALID_STATUSES.has(nextStatus)) {
    return { ok: false, statusCode: 400, error: "status is invalid" };
  }

  const dbClient = await dbPool.connect();
  try {
    await dbClient.query("begin");

    const sessionResult = await dbClient.query(
      `
        select id, phone_e164, cliente_id, current_status, tracking_token
        from public.onboarding_sessions
        where ($1::uuid is not null and id = $1)
           or ($2::text <> '' and tracking_token::text = $2)
        limit 1
        for update
      `,
      [sessionId || null, trackingToken || ""],
    );

    if (sessionResult.rows.length === 0) {
      await dbClient.query("rollback");
      return { ok: false, statusCode: 404, error: "Session not found" };
    }

    const session = sessionResult.rows[0];
    const previousStatus = String(session.current_status || "");
    const now = new Date().toISOString();
    const providerMessageId = `dashboard-${randomUUID()}`;

    await dbClient.query(
      `
        update public.onboarding_sessions
        set
          current_status = $2,
          status_updated_at = $3::timestamptz,
          last_message_at = $3::timestamptz,
          last_provider_message_id = $4,
          updated_at = now()
        where id = $1
      `,
      [session.id, nextStatus, now, providerMessageId],
    );

    if (session.cliente_id) {
      await dbClient.query(
        `
          update public.clientes
          set
            onboarding_status = $2,
            onboarding_status_at = $3::timestamptz,
            updated_at = now()
          where id = $1
        `,
        [session.cliente_id, nextStatus, now],
      );
    }

    await dbClient.query(
      `
        insert into public.onboarding_messages (
          session_id,
          provider_message_id,
          direction,
          payload,
          event_timestamp
        )
        values (
          $1::uuid,
          $2,
          'system',
          $3::jsonb,
          $4::timestamptz
        )
      `,
      [
        session.id,
        providerMessageId,
        {
          source: "dashboard_transition",
          reason,
          from_status: previousStatus,
          to_status: nextStatus,
        },
        now,
      ],
    );

    if (previousStatus !== nextStatus) {
      await dbClient.query(
        `
          insert into public.onboarding_status_history (
            session_id,
            from_status,
            to_status,
            reason,
            provider_message_id,
            changed_at
          )
          values (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6::timestamptz
          )
        `,
        [session.id, previousStatus || null, nextStatus, reason, providerMessageId, now],
      );
    }

    const updatedResult = await dbClient.query(
      `
        select id, tracking_token, cliente_id, current_status, status_updated_at, last_message_at
        from public.onboarding_sessions
        where id = $1
        limit 1
      `,
      [session.id],
    );

    await dbClient.query("commit");
    const updated = updatedResult.rows[0];

    return {
      ok: true,
      statusCode: 200,
      data: {
        ok: true,
        session_id: updated.id,
        tracking_token: updated.tracking_token,
        cliente_id: updated.cliente_id,
        status: updated.current_status,
        status_updated_at: updated.status_updated_at,
        last_message_at: updated.last_message_at,
      },
    };
  } catch (error) {
    await dbClient.query("rollback");
    throw error;
  } finally {
    dbClient.release();
  }
}
