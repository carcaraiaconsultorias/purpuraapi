import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractOnboardingEvents } from "./_shared/mapper.ts";
import { verifyMetaSignature } from "./_shared/signature.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !WHATSAPP_VERIFY_TOKEN || !WHATSAPP_APP_SECRET) {
  throw new Error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET",
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-hub-signature-256, x-request-id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN && challenge) {
        console.info(JSON.stringify({ requestId, event: "webhook_verified" }));
        return new Response(challenge, { status: 200 });
      }

      return new Response("forbidden", { status: 403 });
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed", request_id: requestId }, 405);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const validSignature = await verifyMetaSignature(rawBody, signature, WHATSAPP_APP_SECRET);

    if (!validSignature) {
      console.warn(JSON.stringify({ requestId, event: "invalid_signature" }));
      return jsonResponse({ ok: false, error: "Unauthorized", request_id: requestId }, 401);
    }

    const payload = JSON.parse(rawBody);
    const events = extractOnboardingEvents(payload);

    if (events.length === 0) {
      return jsonResponse({
        ok: true,
        processed: 0,
        duplicates: 0,
        request_id: requestId,
      });
    }

    const maxEventsPerRequest = 50;
    const toProcess = events.slice(0, maxEventsPerRequest);
    let duplicates = 0;

    for (const event of toProcess) {
      const { data, error } = await supabaseAdmin.rpc("process_whatsapp_onboarding_event", {
        p_phone_e164: event.phone,
        p_provider_message_id: event.providerMessageId,
        p_direction: event.direction,
        p_payload: event.payload,
        p_event_timestamp: event.eventTimestamp,
        p_status: event.status,
        p_cliente_data: event.clienteData,
      });

      if (error) {
        console.error(JSON.stringify({ requestId, event: "rpc_error", message: error.message }));
        throw new Error(error.message);
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (row?.duplicate) duplicates += 1;
    }

    console.info(
      JSON.stringify({
        requestId,
        event: "webhook_processed",
        processed: toProcess.length,
        duplicates,
      }),
    );

    return jsonResponse(
      {
        ok: true,
        processed: toProcess.length,
        duplicates,
        request_id: requestId,
      },
      200,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        requestId,
        event: "webhook_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    return jsonResponse(
      {
        ok: false,
        error: "Internal error",
        request_id: requestId,
      },
      500,
    );
  }
});
