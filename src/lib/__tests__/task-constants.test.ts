// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  statusFromColumnName,
  TASK_STATUSES,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TYPE_CONFIG,
  MAX_COLUMNS,
  MIN_COLUMNS,
} from "../task-constants";

describe("statusFromColumnName", () => {
  it("maps 'To Do' to todo", () => {
    expect(statusFromColumnName("To Do")).toBe("todo");
  });

  it("maps 'In Progress' to in_progress", () => {
    expect(statusFromColumnName("In Progress")).toBe("in_progress");
  });

  it("maps 'In Review' to in_review", () => {
    expect(statusFromColumnName("In Review")).toBe("in_review");
  });

  it("maps 'Done' to done", () => {
    expect(statusFromColumnName("Done")).toBe("done");
  });

  it("maps unknown column names to todo", () => {
    expect(statusFromColumnName("Custom Column")).toBe("todo");
  });

  it("is case-insensitive", () => {
    expect(statusFromColumnName("DONE")).toBe("done");
    expect(statusFromColumnName("in progress")).toBe("in_progress");
  });
});

describe("constants integrity", () => {
  it("STATUS_CONFIG has entries for all TASK_STATUSES", () => {
    for (const status of Object.values(TASK_STATUSES)) {
      expect(STATUS_CONFIG[status]).toBeDefined();
      expect(STATUS_CONFIG[status].label).toBeTruthy();
    }
  });

  it("PRIORITY_CONFIG has all 4 priorities", () => {
    expect(Object.keys(PRIORITY_CONFIG)).toEqual(
      expect.arrayContaining(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    );
  });

  it("TYPE_CONFIG has all 4 types", () => {
    expect(Object.keys(TYPE_CONFIG)).toEqual(
      expect.arrayContaining(["STORY", "BUG", "TASK", "EPIC"])
    );
  });

  it("column limits are sane", () => {
    expect(MIN_COLUMNS).toBeLessThan(MAX_COLUMNS);
    expect(MIN_COLUMNS).toBeGreaterThan(0);
  });
});
