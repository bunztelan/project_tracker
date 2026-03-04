// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeBurndown, computeVelocity, computeDistribution } from "../reports";

describe("computeBurndown", () => {
  it("returns empty data for sprint with no dates", () => {
    const result = computeBurndown({
      startDate: null,
      endDate: null,
      tasks: [],
    });
    expect(result.data).toEqual([]);
    expect(result.totalPoints).toBe(0);
  });

  it("computes ideal burndown as linear from total to 0", () => {
    const start = new Date("2026-03-01");
    const end = new Date("2026-03-03");
    const result = computeBurndown({
      startDate: start,
      endDate: end,
      tasks: [
        { status: "todo", storyPoints: 10, updatedAt: new Date("2026-03-01") },
      ],
    });
    expect(result.totalPoints).toBe(10);
    expect(result.data.length).toBe(3);
    expect(result.data[0].ideal).toBe(10);
    expect(result.data[result.data.length - 1].ideal).toBe(0);
  });
});

describe("computeVelocity", () => {
  it("returns empty array for no sprints", () => {
    expect(computeVelocity([])).toEqual([]);
  });

  it("computes committed and completed points", () => {
    const result = computeVelocity([
      {
        name: "Sprint 1",
        status: "COMPLETED",
        tasks: [
          { status: "done", storyPoints: 5 },
          { status: "todo", storyPoints: 3 },
        ],
      },
    ]);
    expect(result).toEqual([
      { sprint: "Sprint 1", committed: 8, completed: 5 },
    ]);
  });

  it("excludes PLANNING sprints", () => {
    const result = computeVelocity([
      {
        name: "Sprint 1",
        status: "PLANNING",
        tasks: [{ status: "done", storyPoints: 5 }],
      },
    ]);
    expect(result).toEqual([]);
  });
});

describe("computeDistribution", () => {
  it("counts tasks by status, priority, and type", () => {
    const tasks = [
      { status: "todo", priority: "HIGH", type: "BUG" },
      { status: "todo", priority: "HIGH", type: "STORY" },
      { status: "done", priority: "LOW", type: "BUG" },
    ];
    const result = computeDistribution(tasks);
    expect(result.byStatus.find((s) => s.name === "To Do")?.value).toBe(2);
    expect(result.byStatus.find((s) => s.name === "Done")?.value).toBe(1);
    expect(result.byPriority.find((p) => p.name === "High")?.value).toBe(2);
    expect(result.byType.find((t) => t.name === "Bug")?.value).toBe(2);
  });

  it("handles empty task array", () => {
    const result = computeDistribution([]);
    expect(result.byStatus).toEqual([]);
    expect(result.byPriority).toEqual([]);
    expect(result.byType).toEqual([]);
  });
});
