export type OnboardingStatus =
  | "new"
  | "started"
  | "in_progress"
  | "awaiting_client"
  | "completed"
  | "failed";

export interface OnboardingEvent {
  phone: string;
  providerMessageId: string;
  direction: "inbound" | "outbound" | "system";
  status: OnboardingStatus;
  eventTimestamp: string;
  payload: Record<string, unknown>;
  clienteData: Record<string, unknown>;
}

function normalizePhoneE164(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+${digits}`;
}

function unixToIso(value?: string): string {
  if (!value) return new Date().toISOString();
  const ms = Number(value) * 1000;
  if (Number.isNaN(ms)) return new Date().toISOString();
  return new Date(ms).toISOString();
}

function mapDeliveryStatus(status?: string): OnboardingStatus {
  switch (status) {
    case "failed":
    case "undelivered":
      return "failed";
    case "read":
    case "delivered":
    case "sent":
      return "awaiting_client";
    default:
      return "in_progress";
  }
}

export function extractOnboardingEvents(payload: any): OnboardingEvent[] {
  const events: OnboardingEvent[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      if (change?.field !== "messages") continue;

      const value = change?.value ?? {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const fallbackPhone = normalizePhoneE164(contacts[0]?.wa_id);

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const phone = normalizePhoneE164(message?.from) ?? fallbackPhone;
        if (!phone || !message?.id) continue;

        events.push({
          phone,
          providerMessageId: message.id,
          direction: "inbound",
          status: "in_progress",
          eventTimestamp: unixToIso(message.timestamp),
          payload: {
            source: "meta_webhook",
            type: "message",
            message,
          },
          clienteData: {
            nome: contacts[0]?.profile?.name ?? "",
            telefone: phone,
          },
        });
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const statusItem of statuses) {
        const phone = normalizePhoneE164(statusItem?.recipient_id) ?? fallbackPhone;
        if (!phone || !statusItem?.id) continue;

        events.push({
          phone,
          providerMessageId: statusItem.id,
          direction: "system",
          status: mapDeliveryStatus(statusItem.status),
          eventTimestamp: unixToIso(statusItem.timestamp),
          payload: {
            source: "meta_webhook",
            type: "status",
            status: statusItem,
          },
          clienteData: {
            telefone: phone,
          },
        });
      }
    }
  }

  return events;
}
