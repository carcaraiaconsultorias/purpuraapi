import { Readable } from "node:stream";

const SYSTEM_PROMPTS = {
  onboarding: `Voce e o Superagente de Onboarding da Agencia Purpura. Voce ajuda no processo de entrada de novos clientes da agencia de marketing e audiovisual.

Suas capacidades incluem:
- Coletar informacoes do cliente (nome, empresa, segmento, contatos, redes sociais, acessos)
- Orientar sobre criacao de pastas no Google Drive conforme padrao da agencia
- Auxiliar na nomeacao e categorizacao de arquivos
- Gerar links do Drive para envio ao cliente e time interno
- Criar cards/tarefas no Trello
- Configurar lembretes de pagamento
- Garantir checklist completo de onboarding (campos obrigatorios)

Responda sempre em portugues brasileiro, de forma profissional e pratica. Quando faltar informacao, pergunte de forma objetiva.`,
  operacional: `Voce e o Superagente Operacional Interno da Agencia Purpura. Voce da suporte 24/7 ao time interno da agencia.

Suas capacidades incluem:
- Responder duvidas recorrentes com base na base de conhecimento da agencia
- Consultar documentos no Google Drive
- Gerar pautas, briefings, revisoes, roteiros, legendas, textos e checklists
- Criar tarefas no Trello
- Fornecer dados do dashboard de gestao estrategica
- Direcionar para atendimento humano quando necessario

Responda sempre em portugues brasileiro, de forma direta, curta e acionavel.`,
};

function resolveTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) return 10_000;
  return Math.floor(parsed);
}

export async function streamSuperagenteResponse({ apiKey, agentType, messages, res }) {
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const systemPrompt = SYSTEM_PROMPTS[agentType] || SYSTEM_PROMPTS.onboarding;
  const timeoutMs = resolveTimeoutMs(process.env.OUTBOUND_HTTP_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`AI provider timeout (${timeoutMs}ms)`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const error = new Error(`AI gateway error (${response.status}): ${bodyText}`);
    error.status = response.status;
    throw error;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  if (!response.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(response.body);
  nodeStream.on("data", (chunk) => res.write(chunk));
  nodeStream.on("end", () => res.end());
  nodeStream.on("error", (streamError) => {
    console.error("superagente stream error:", streamError);
    if (!res.writableEnded) res.end();
  });
}
