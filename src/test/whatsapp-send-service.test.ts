import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWhatsAppText } from "../../backend/services/whatsapp-send-service.mjs";

const appConfig = {
  whatsappGraphApiBaseUrl: "https://graph.facebook.com/v19.0",
  whatsappPhoneNumberId: "123456789",
  whatsappAccessToken: "test_access_token",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("whatsapp-send-service", () => {
  it("returns provider_message_id on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ messages: [{ id: "wamid.success.1" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await sendWhatsAppText(
      {
        toPhoneE164: "+5511999999999",
        bodyText: "Lembrete teste",
      },
      { appConfig },
    );

    expect(result.providerMessageId).toBe("wamid.success.1");
  });

  it("throws explicit error for 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      sendWhatsAppText(
        {
          toPhoneE164: "+5511999999999",
          bodyText: "Teste auth",
        },
        { appConfig },
      ),
    ).rejects.toThrow("WhatsApp auth failed (401)");
  });

  it("throws explicit error for 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      sendWhatsAppText(
        {
          toPhoneE164: "+5511999999999",
          bodyText: "Teste forbidden",
        },
        { appConfig },
      ),
    ).rejects.toThrow("WhatsApp auth failed (403)");
  });

  it("throws explicit error for 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Rate limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      sendWhatsAppText(
        {
          toPhoneE164: "+5511999999999",
          bodyText: "Teste rate limit",
        },
        { appConfig },
      ),
    ).rejects.toThrow("WhatsApp rate limited (429)");
  });
});
