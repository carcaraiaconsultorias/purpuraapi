import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, agentType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompts: Record<string, string> = {
      onboarding: `Você é o Superagente de Onboarding da Agência Púrpura. Você ajuda no processo de entrada de novos clientes da agência de marketing e audiovisual.

Suas capacidades incluem:
- Coletar informações do cliente (nome, empresa, segmento, contatos, redes sociais, acessos)
- Orientar sobre criação de pastas no Google Drive conforme padrão da agência
- Auxiliar na nomeação e categorização de arquivos
- Gerar links do Drive para envio ao cliente e time interno
- Criar cards/tarefas no Trello
- Configurar lembretes de pagamento
- Garantir checklist completo de onboarding (campos obrigatórios)

Responda sempre em português brasileiro, de forma profissional mas amigável. Quando o usuário perguntar sobre qualquer etapa do onboarding, guie-o passo a passo. Se faltarem informações, pergunte de forma organizada.`,

      operacional: `Você é o Superagente Operacional Interno da Agência Púrpura. Você dá suporte 24/7 ao time interno da agência de marketing e audiovisual.

Suas capacidades incluem:
- Responder dúvidas recorrentes com base na base de conhecimento da agência
- Consultar documentos no Google Drive
- Gerar pautas, briefings, revisões, roteiros, legendas, textos e checklists
- Criar tarefas no Trello
- Fornecer dados do dashboard de gestão estratégica (KPIs de onboarding, volume de demandas, eficiência)
- Filtrar e direcionar ao atendimento humano quando necessário

Responda sempre em português brasileiro, de forma direta e prática. Priorize respostas acionáveis. Para solicitações complexas, divida em etapas claras.`,
    };

    const systemPrompt = systemPrompts[agentType] || systemPrompts.onboarding;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
