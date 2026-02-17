import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type IntakePayload = {
  service_name: string;
  nome: string;
  email?: string;
  whatsapp: string;
  empresa?: string;
  cargo?: string;
  site?: string;
  segmento?: string;
  porte?: string;
  canais?: string[];
  regiao?: string;
  objetivos?: string[];
  observacoes?: string;
  aceiteTermos: boolean;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ ok: false, error: message }, 400);
}

function validatePayload(input: any): IntakePayload | null {
  if (!input || typeof input !== "object") return null;
  if (typeof input.service_name !== "string" || input.service_name.trim().length < 2) return null;
  if (typeof input.nome !== "string" || input.nome.trim().length < 2) return null;
  if (typeof input.whatsapp !== "string" || input.whatsapp.trim().length < 8) return null;
  if (input.aceiteTermos !== true) return null;
  return input as IntakePayload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const payload = validatePayload(body);
    if (!payload) return badRequest("Invalid payload");

    const providerMessageId = `frontend-${crypto.randomUUID()}`;
    const eventTimestamp = new Date().toISOString();

    const { data, error } = await supabaseAdmin.rpc("process_whatsapp_onboarding_event", {
      p_phone_e164: payload.whatsapp,
      p_provider_message_id: providerMessageId,
      p_direction: "outbound",
      p_payload: {
        source: "frontend_intake",
        service_name: payload.service_name,
        form: payload,
      },
      p_event_timestamp: eventTimestamp,
      p_status: "started",
      p_cliente_data: {
        nome: payload.nome,
        email: payload.email ?? null,
        telefone: payload.whatsapp,
      },
    });

    if (error) return jsonResponse({ ok: false, error: error.message }, 500);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return jsonResponse({ ok: false, error: "No data returned from RPC" }, 500);

    return jsonResponse({
      ok: true,
      session_id: row.session_id,
      cliente_id: row.cliente_id,
      tracking_token: row.tracking_token,
      status: row.status,
      status_updated_at: row.status_updated_at,
      duplicate: row.duplicate,
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
