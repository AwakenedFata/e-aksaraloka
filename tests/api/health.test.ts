import { afterEach, describe, expect, it, vi } from "vitest";
import { resetServerEnvCacheForTests } from "@/lib/config/env";

afterEach(() => {
  resetServerEnvCacheForTests();
});

describe("GET /api/health", () => {
  it("returns ok with build info and no-store caching", async () => {
    vi.stubEnv("APP_COMMIT_SHA", "abc123");
    const { GET } = await import("@/app/api/health/route");

    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as {
      status: string;
      service: { name: string; version: string; commit: string | null };
      timestamp: string;
    };
    expect(body.status).toBe("ok");
    expect(body.service.name).toBe("aksaraloka");
    expect(body.service.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.service.commit).toBe("abc123");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});

describe("GET /api/health/ready", () => {
  it("is ready and reports database not_configured when MONGODB_URI is unset", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { GET } = await import("@/app/api/health/ready/route");

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string } };
    };
    expect(body.status).toBe("ready");
    expect(body.checks.database.status).toBe("not_configured");
  });

  it("is not ready (503) and leaks no connection string when the database is unreachable", async () => {
    // Port 1 on loopback is reserved and refuses connections quickly.
    const uri = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500&directConnection=true";
    vi.stubEnv("MONGODB_URI", uri);
    const { GET } = await import("@/app/api/health/ready/route");

    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("127.0.0.1:1");
    const body = JSON.parse(text) as { status: string; checks: { database: { status: string } } };
    expect(body.status).toBe("not_ready");
    expect(body.checks.database.status).toBe("error");
  }, 15_000);
});
