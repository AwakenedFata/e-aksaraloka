import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/db/mongo";
import { getSheetsIntegrationStatus } from "@/lib/integrations/googleSheetsSync";
import {
  checkTeacherLoginRateLimit,
  clearFailedTeacherLogin,
  clearTeacherSessionCookie,
  getTeacherSessionStatus,
  recordFailedTeacherLogin,
  setTeacherSessionCookie,
  validateTeacherCredentials,
} from "@/lib/auth/teacherAuth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  accessCode: z.string().trim().min(1, "Masukkan sandi akses guru.").max(128),
});

function extractIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

export async function GET(): Promise<Response> {
  const session = await getTeacherSessionStatus();
  const sheets = getSheetsIntegrationStatus();

  return Response.json(
    {
      configured: session.configured,
      authenticated: session.authenticated,
      databaseConfigured: isDatabaseConfigured(),
      sheetsConfigured: sheets.configured,
      sheetsMode: sheets.mode,
      spreadsheetUrl: session.authenticated ? sheets.spreadsheetUrl : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = await getTeacherSessionStatus();
  if (!session.configured) {
    return Response.json(
      {
        error:
          "Kata sandi Ruang Guru belum diaktifkan oleh pengelola aplikasi.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ip = extractIp(request);
  const limit = checkTeacherLoginRateLimit(ip);
  if (!limit.allowed) {
    return Response.json(
      {
        error: `Terlalu banyak percobaan sandi salah. Coba lagi dalam ${limit.retryAfterSec} detik.`,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Format permintaan tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Sandi akses wajib diisi." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!validateTeacherCredentials(parsed.data.accessCode)) {
    recordFailedTeacherLogin(ip);
    return Response.json(
      { error: "Sandi akses guru tidak sesuai." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  clearFailedTeacherLogin(ip);
  await setTeacherSessionCookie();
  const sheets = getSheetsIntegrationStatus();

  return Response.json(
    {
      ok: true,
      authenticated: true,
      databaseConfigured: isDatabaseConfigured(),
      sheetsConfigured: sheets.configured,
      sheetsMode: sheets.mode,
      spreadsheetUrl: sheets.spreadsheetUrl,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(): Promise<Response> {
  await clearTeacherSessionCookie();
  return Response.json(
    { ok: true, authenticated: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
