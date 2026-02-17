import { describe, expect, it } from "vitest";
import { buildTrelloCardDescription, mapOperationalItemToTrelloCard, resolveTrelloListId } from "../../backend/services/trello-mapper.mjs";

const appConfig = {
  trelloDefaultListId: "",
  trelloTaskListId: "list_task",
  trelloBriefingListId: "list_briefing",
  trelloFollowUpListId: "list_follow_up",
};

describe("trello-mapper", () => {
  it("resolves list by operational type", () => {
    expect(resolveTrelloListId("task", appConfig)).toBe("list_task");
    expect(resolveTrelloListId("briefing", appConfig)).toBe("list_briefing");
    expect(resolveTrelloListId("follow_up", appConfig)).toBe("list_follow_up");
  });

  it("maps operational row to trello payload", () => {
    const mapped = mapOperationalItemToTrelloCard(
      {
        tipo: "task",
        titulo: "Revisar briefing cliente",
        descricao: "Priorizar pauta da semana",
        prioridade: "high",
        status: "in_progress",
        responsavel: "Time Conteudo",
        prazo_at: "2026-02-20T10:00:00.000Z",
        detalhes: { campanha: "launch_q1" },
      },
      { appConfig },
    );

    expect(mapped.idList).toBe("list_task");
    expect(mapped.name).toBe("Revisar briefing cliente");
    expect(mapped.desc).toContain("Prioridade");
    expect(mapped.due).toBe("2026-02-20T10:00:00.000Z");
  });

  it("builds deterministic markdown description", () => {
    const description = buildTrelloCardDescription({
      id: "0f7d2ebf-f3be-4daa-bad7-b92536c76d64",
      tipo: "briefing",
      status: "open",
      prioridade: "medium",
      descricao: "Detalhes do briefing inicial",
      detalhes: { canal: "instagram", formato: "reel" },
    });

    expect(description).toContain("Tipo:");
    expect(description).toContain("Detalhes JSON:");
    expect(description).toContain("instagram");
  });

  it("throws when no list is configured", () => {
    expect(() =>
      mapOperationalItemToTrelloCard(
        {
          tipo: "task",
          titulo: "Task sem lista",
        },
        {
          appConfig: {
            trelloDefaultListId: "",
            trelloTaskListId: "",
            trelloBriefingListId: "",
            trelloFollowUpListId: "",
          },
        },
      ),
    ).toThrowError();
  });
});
