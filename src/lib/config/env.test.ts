import { describe, expect, it } from "vitest";
import { EnvValidationError, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = parseServerEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.MONGODB_DB_NAME).toBe("aksaraloka");
    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
  });

  it("treats empty and whitespace-only strings as not set", () => {
    const env = parseServerEnv({ MONGODB_URI: "", GEMINI_API_KEY: "   ", LOG_LEVEL: "" });
    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("accepts mongodb:// and mongodb+srv:// URIs", () => {
    expect(parseServerEnv({ MONGODB_URI: "mongodb://127.0.0.1:27017" }).MONGODB_URI).toBe(
      "mongodb://127.0.0.1:27017",
    );
    expect(
      parseServerEnv({ MONGODB_URI: "mongodb+srv://cluster.example.net" }).MONGODB_URI,
    ).toBe("mongodb+srv://cluster.example.net");
  });

  it("rejects malformed values and reports variable names", () => {
    expect(() => parseServerEnv({ MONGODB_URI: "postgres://x" })).toThrow(EnvValidationError);
    try {
      parseServerEnv({ MONGODB_URI: "postgres://x", LOG_LEVEL: "verbose" });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const variables = (error as EnvValidationError).issues.map((issue) => issue.variable);
      expect(variables).toEqual(expect.arrayContaining(["MONGODB_URI", "LOG_LEVEL"]));
    }
  });

  it("never echoes secret values in error messages", () => {
    const secret = "sk-super-secret-value-123";
    try {
      parseServerEnv({ MONGODB_URI: secret });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(secret);
      expect(JSON.stringify((error as EnvValidationError).issues)).not.toContain(secret);
    }
  });

  it("rejects unsafe database names", () => {
    expect(() => parseServerEnv({ MONGODB_DB_NAME: "bad name/with$chars" })).toThrow(
      EnvValidationError,
    );
  });

  it("validates optional Google Sheets and Panel Guru env variables cleanly", () => {
    const valid = parseServerEnv({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@aksaraloka.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nKEY\\n-----END PRIVATE KEY-----",
      GOOGLE_SPREADSHEET_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      GOOGLE_APPS_SCRIPT_WEBHOOK_URL: "https://script.google.com/macros/s/abc/exec",
      TEACHER_ACCESS_CODE: "guru2026",
      TEACHER_SESSION_SECRET: "super-secret-session-key-2026",
      APP_PUBLIC_URL: "https://e-aksaraloka.vercel.app",
    });

    expect(valid.GOOGLE_SERVICE_ACCOUNT_EMAIL).toBe(
      "sync@aksaraloka.iam.gserviceaccount.com"
    );
    expect(valid.GOOGLE_SPREADSHEET_ID).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz123456");
    expect(valid.TEACHER_ACCESS_CODE).toBe("guru2026");
    expect(valid.APP_PUBLIC_URL).toBe("https://e-aksaraloka.vercel.app");

    expect(() =>
      parseServerEnv({ GOOGLE_APPS_SCRIPT_WEBHOOK_URL: "http://insecure.example/exec" })
    ).toThrow(EnvValidationError);
    expect(() =>
      parseServerEnv({ GOOGLE_SPREADSHEET_ID: "short" })
    ).toThrow(EnvValidationError);
    expect(() =>
      parseServerEnv({ TEACHER_ACCESS_CODE: "123" })
    ).toThrow(EnvValidationError);
  });
});
