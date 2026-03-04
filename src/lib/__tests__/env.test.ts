// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(() => import("../env")).rejects.toThrow();
  });

  it("throws when NEXTAUTH_SECRET is missing", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    delete process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(() => import("../env")).rejects.toThrow();
  });

  it("passes with valid env in development", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "change-me-in-production";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";

    await expect(import("../env")).resolves.not.toThrow();
  });

  it("rejects default secret in production", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NEXTAUTH_SECRET = "change-me-in-production";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";

    await expect(() => import("../env")).rejects.toThrow();
  });
});
