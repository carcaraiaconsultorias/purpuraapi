import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrelloEnvReadiness, syncOperationalItemToTrello } from "../../backend/services/trello-service.mjs";

const validConfig = {
  trelloApiBaseUrl: "https://api.trello.com/1",
  trelloApiKey: "test_api_key_123",
  trelloToken: "test_token_123",
  trelloBoardId: "",
  trelloDefaultListId: "list_default_123",
  trelloTaskListId: "",
  trelloBriefingListId: "",
  trelloFollowUpListId: "",
};

const notConfigured = {
  trelloApiBaseUrl: "https://api.trello.com/1",
  trelloApiKey: "",
  trelloToken: "",
  trelloBoardId: "",
  trelloDefaultListId: "",
  trelloTaskListId: "",
  trelloBriefingListId: "",
  trelloFollowUpListId: "",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trello-service readiness and auth errors", () => {
  it("reports readiness state without exposing values", () => {
    const readiness = getTrelloEnvReadiness(notConfigured, "production");
    expect(readiness.ready).toBe(false);
    expect(readiness.allowSkipNotConfigured).toBe(false);
    expect(readiness.statusByKey.find((item) => item.key === "TRELLO_API_KEY")?.status).toBe("EMPTY");
    expect(readiness.statusByKey.find((item) => item.key === "TRELLO_TOKEN")?.status).toBe("EMPTY");
  });

  it("returns skipped_not_configured only outside production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      const result = await syncOperationalItemToTrello(
        { tipo: "task", titulo: "Smoke Trello", status: "open" },
        { appConfig: notConfigured },
      );
      expect(result.status).toBe("skipped_not_configured");
      expect(result.enabled).toBe(false);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("throws explicit not configured error in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(
        syncOperationalItemToTrello(
          { tipo: "task", titulo: "Smoke Trello", status: "open" },
          { appConfig: notConfigured },
        ),
      ).rejects.toMatchObject({
        code: "TRELLO_NOT_CONFIGURED",
        httpStatus: 503,
        message: "Trello not configured",
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("returns explicit 401 error and redacts secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('{"error":"invalid token=super_secret_token&key=super_secret_key"}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      syncOperationalItemToTrello(
        { tipo: "task", titulo: "Criar card 401", status: "open" },
        { appConfig: validConfig },
      ),
    ).rejects.toThrow("Trello request failed (401)");

    try {
      await syncOperationalItemToTrello(
        { tipo: "task", titulo: "Criar card 401", status: "open" },
        { appConfig: validConfig },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("super_secret_token");
      expect(message).not.toContain("super_secret_key");
      expect(message).toContain("[REDACTED]");
    }
  });

  it("returns explicit 403 error and redacts secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("token=forbidden_secret_token", {
          status: 403,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    await expect(
      syncOperationalItemToTrello(
        { tipo: "task", titulo: "Criar card 403", status: "open" },
        { appConfig: validConfig },
      ),
    ).rejects.toThrow("Trello request failed (403)");

    try {
      await syncOperationalItemToTrello(
        { tipo: "task", titulo: "Criar card 403", status: "open" },
        { appConfig: validConfig },
      );
      throw new Error("Expected syncOperationalItemToTrello to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Trello request failed (403)");
      expect(message).not.toContain("forbidden_secret_token");
      expect(message).toContain("[REDACTED]");
    }
  });
});
