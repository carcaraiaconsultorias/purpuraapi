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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const trackingToken = typeof body?.tracking_token === "string" ? body.tracking_token : "";
    if (!trackingToken) return jsonResponse({ ok: false, error: "tracking_token is required" }, 400);

    const { data, error } = await supabaseAdmin
      .from("onboarding_sessions")
      .select("id, current_status, status_updated_at, last_message_at, created_at")
      .eq("tracking_token", trackingToken)
      .maybeSingle();

    if (error) return jsonResponse({ ok: false, error: error.message }, 500);
    if (!data) return jsonResponse({ ok: false, error: "Session not found" }, 404);

    return jsonResponse({
      ok: true,
      session_id: data.id,
      status: data.current_status,
      status_updated_at: data.status_updated_at,
      last_message_at: data.last_message_at,
      created_at: data.created_at,
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
