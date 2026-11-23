import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/config/env";
import {
  TEACHER_COOKIE_NAME,
  TEACHER_SESSION_TTL_SEC,
  deriveTeacherSigningKey,
  signTeacherSessionToken,
  verifyTeacherAccessCode,
  verifyTeacherSessionToken,
} from "./teacherSessionCore";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const failedLoginBuckets = new Map<string, { count: number; resetAt: number }>();

export function isTeacherAuthConfigured(): boolean {
  return Boolean(getServerEnv().TEACHER_ACCESS_CODE);
}

function getSigningKeyOrNull(): Buffer | null {
  const env = getServerEnv();
  if (!env.TEACHER_ACCESS_CODE) return null;
  return deriveTeacherSigningKey(
    env.TEACHER_ACCESS_CODE,
    env.TEACHER_SESSION_SECRET
  );
}

export function checkTeacherLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const bucket = failedLoginBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (bucket.count >= MAX_FAILED_LOGINS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedTeacherLogin(ip: string): void {
  const now = Date.now();
  const existing = failedLoginBuckets.get(ip);
  if (!existing || now >= existing.resetAt) {
    failedLoginBuckets.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

export function clearFailedTeacherLogin(ip: string): void {
  failedLoginBuckets.delete(ip);
}

export function validateTeacherCredentials(inputCode: string): boolean {
  const expected = getServerEnv().TEACHER_ACCESS_CODE;
  if (!expected) return false;
  return verifyTeacherAccessCode(inputCode, expected);
}

export async function setTeacherSessionCookie(): Promise<void> {
  const key = getSigningKeyOrNull();
  if (!key) {
    throw new Error("TEACHER_ACCESS_CODE belum diatur di environment server.");
  }
  const token = signTeacherSessionToken(key);
  const cookieStore = await cookies();
  cookieStore.set(TEACHER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    maxAge: TEACHER_SESSION_TTL_SEC,
  });
}

export async function clearTeacherSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_COOKIE_NAME);
}

export async function getTeacherSessionStatus(): Promise<{
  readonly configured: boolean;
  readonly authenticated: boolean;
}> {
  const key = getSigningKeyOrNull();
  if (!key) {
    return { configured: false, authenticated: false };
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(TEACHER_COOKIE_NAME)?.value;
  if (!raw) {
    return { configured: true, authenticated: false };
  }
  return {
    configured: true,
    authenticated: verifyTeacherSessionToken(raw, key),
  };
}

/**
 * Mengembalikan `null` bila sesi guru sah; jika tidak, mengembalikan `Response` 401/503 siap pakai.
 */
export async function requireTeacherSession(): Promise<Response | null> {
  const status = await getTeacherSessionStatus();
  if (!status.configured) {
    return Response.json(
      {
        error:
          "Akses Ruang Guru belum diaktifkan oleh pengelola aplikasi.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!status.authenticated) {
    return Response.json(
      { error: "Sesi masuk guru telah berakhir. Silakan masukkan kata sandi guru kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
