import crypto from "node:crypto";

export const TEACHER_COOKIE_NAME = "aksaraloka_teacher_session";
export const TEACHER_SESSION_TTL_SEC = 12 * 60 * 60; // 12 jam

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Menurunkan kunci HMAC-SHA256 32-byte secara deterministik dari secret eksplisit
 * (atau fallback dari TEACHER_ACCESS_CODE + domain separator bila secret terpisah kosong).
 */
export function deriveTeacherSigningKey(
  accessCode: string,
  explicitSecret?: string
): Buffer {
  const source = explicitSecret?.trim()
    ? `aksaraloka-teacher-session-v1::${explicitSecret.trim()}`
    : `aksaraloka-teacher-derived-v1::${accessCode.trim()}`;
  return crypto.createHash("sha256").update(source, "utf8").digest();
}

/**
 * Perbandingan sandi guru dalam waktu konstan (SHA-256 digest + timingSafeEqual)
 * sehingga tidak membocorkan panjang maupun kecocokan karakter lewat timing side-channel.
 */
export function verifyTeacherAccessCode(
  inputCode: string,
  expectedCode: string
): boolean {
  const a = crypto.createHash("sha256").update(inputCode.trim(), "utf8").digest();
  const b = crypto.createHash("sha256").update(expectedCode.trim(), "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

export function signTeacherSessionToken(
  signingKey: Buffer,
  nowMs: number = Date.now()
): string {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + TEACHER_SESSION_TTL_SEC;
  const payload = base64UrlEncode(
    JSON.stringify({ role: "teacher", iat, exp })
  );
  const sig = crypto
    .createHmac("sha256", signingKey)
    .update(payload)
    .digest();
  return `${payload}.${base64UrlEncode(sig)}`;
}

export function verifyTeacherSessionToken(
  token: string,
  signingKey: Buffer,
  nowMs: number = Date.now()
): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadPart, sigPart] = parts;
  if (!payloadPart || !sigPart) return false;

  const expectedSig = base64UrlEncode(
    crypto.createHmac("sha256", signingKey).update(payloadPart).digest()
  );

  const a = Buffer.from(sigPart, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadPart)) as {
      role?: string;
      exp?: number;
    };
    if (parsed.role !== "teacher") return false;
    if (typeof parsed.exp !== "number") return false;
    return Math.floor(nowMs / 1000) < parsed.exp;
  } catch {
    return false;
  }
}
