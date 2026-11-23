import { describe, expect, it } from "vitest";
import {
  TEACHER_SESSION_TTL_SEC,
  deriveTeacherSigningKey,
  signTeacherSessionToken,
  verifyTeacherAccessCode,
  verifyTeacherSessionToken,
} from "./teacherSessionCore";

describe("teacherSessionCore HMAC auth & constant-time checks", () => {
  it("verifies teacher access code accurately without false positives", () => {
    expect(verifyTeacherAccessCode("guru-aksara-2026", "guru-aksara-2026")).toBe(true);
    expect(verifyTeacherAccessCode(" guru-aksara-2026 ", "guru-aksara-2026")).toBe(true);
    expect(verifyTeacherAccessCode("salah", "guru-aksara-2026")).toBe(false);
    expect(verifyTeacherAccessCode("guru-aksara-2025", "guru-aksara-2026")).toBe(false);
  });

  it("signs, validates, rejects tampered tokens, rejects wrong keys, and enforces TTL expiry", () => {
    const key = deriveTeacherSigningKey("guru-aksara-2026", "dedicated-secret-0123456789");
    const otherKey = deriveTeacherSigningKey("guru-aksara-2026", "different-secret-9876543210");

    const nowMs = Date.UTC(2026, 10, 24, 2, 0, 0);
    const token = signTeacherSessionToken(key, nowMs);

    expect(verifyTeacherSessionToken(token, key, nowMs + 60_000)).toBe(true);
    expect(verifyTeacherSessionToken(token, otherKey, nowMs + 60_000)).toBe(false);

    // Tampered payload or signature must fail
    const [payload, sig] = token.split(".");
    expect(verifyTeacherSessionToken(`${payload}x.${sig}`, key, nowMs + 1000)).toBe(false);
    expect(verifyTeacherSessionToken(`${payload}.${sig}x`, key, nowMs + 1000)).toBe(false);
    expect(verifyTeacherSessionToken("malformed-token", key, nowMs + 1000)).toBe(false);

    // Expired token past TTL must fail
    const expiredMs = nowMs + (TEACHER_SESSION_TTL_SEC + 5) * 1000;
    expect(verifyTeacherSessionToken(token, key, expiredMs)).toBe(false);
  });
});
