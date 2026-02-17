import { describe, it, expect } from "vitest";
import { extractOnboardingEvents } from "../../backend/services/whatsapp-mapper.mjs";

describe("whatsapp mapper", () => {
  it("maps inbound message payload", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                contacts: [{ wa_id: "5511999998888", profile: { name: "Joao" } }],
                messages: [
                  {
                    id: "wamid.test.1",
                    from: "5511999998888",
                    timestamp: "1739550000",
                    text: { body: "Oi" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = extractOnboardingEvents(payload);
    expect(events).toHaveLength(1);
    expect(events[0].providerMessageId).toBe("wamid.test.1");
    expect(events[0].direction).toBe("inbound");
    expect(events[0].status).toBe("in_progress");
    expect(events[0].phone).toBe("+5511999998888");
  });

  it("maps status payload", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  {
                    id: "wamid.status.1",
                    recipient_id: "5511988887777",
                    status: "read",
                    timestamp: "1739550010",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = extractOnboardingEvents(payload);
    expect(events).toHaveLength(1);
    expect(events[0].providerMessageId).toBe("wamid.status.1");
    expect(events[0].direction).toBe("system");
    expect(events[0].status).toBe("awaiting_client");
  });
});
