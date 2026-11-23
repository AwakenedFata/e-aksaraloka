import { getServerEnv } from "@/lib/config/env";
import { isDatabaseConfigured } from "@/lib/db/mongo";
import {
  getSheetsIntegrationStatus,
  syncSubmissionToGoogleSheets,
} from "@/lib/integrations/googleSheetsSync";
import {
  ClassroomClosedError,
  createStudentSubmissionInDb,
  updateSubmissionSheetSync,
} from "@/lib/submissions/submissionRepository";
import {
  buildVerifiedSubmissionRecord,
  formatAuthenticityLabel,
  normalizeClassCode,
  submitWorkRequestSchema,
} from "@/lib/submissions/submissionSchemas";

export const dynamic = "force-dynamic";

const SUBMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_SUBMITS_PER_WINDOW = 60; // Allows a full classroom sharing 1 school Wi-Fi NAT IP
const submitBuckets = new Map<string, { count: number; resetAt: number }>();

function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local-classroom";
}

function checkSubmitRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = submitBuckets.get(ip);
  if (!existing || now >= existing.resetAt) {
    submitBuckets.set(ip, { count: 1, resetAt: now + SUBMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= MAX_SUBMITS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function resolvePublicBaseUrl(request: Request): string | null {
  const env = getServerEnv();
  if (env.APP_PUBLIC_URL) return env.APP_PUBLIC_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/**
 * Capability probe (tanpa kredensial) untuk UI siswa & diagnostik.
 */
export function GET(): Response {
  const sheets = getSheetsIntegrationStatus();
  return Response.json(
    {
      status: "ok",
      databaseConfigured: isDatabaseConfigured(),
      sheetsConfigured: sheets.configured,
      sheetsMode: sheets.mode,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Endpoint pengumpulan resmi karya & progres belajar siswa:
 * 1. Validasi payload ketat dengan Zod.
 * 2. Hitung ulang skor Babak I–IV & audit EYD V di server (anti-manipulasi).
 * 3. Simpan permanen ke MongoDB terlebih dahulu (Single Source of Truth).
 * 4. Teruskan otomatis ke 3 tab Google Spreadsheet (Rekap_Nilai, Naskah_Cerita, Peta_Rancang_LKS).
 */
export async function POST(request: Request): Promise<Response> {
  const limit = checkSubmitRateLimit(extractClientIp(request));
  if (!limit.allowed) {
    return Response.json(
      {
        error: `Terlalu banyak pengiriman dari jaringan ini. Coba lagi dalam ${limit.retryAfterSec} detik.`,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Format permintaan tidak valid (JSON diperlukan)." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = submitWorkRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue =
      parsed.error.issues[0]?.message ?? "Data pengumpulan belum lengkap.";
    return Response.json(
      { error: firstIssue },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const dbConfigured = isDatabaseConfigured();
  const sheetsInfo = getSheetsIntegrationStatus();
  const baseUrl = resolvePublicBaseUrl(request);

  if (!dbConfigured && !sheetsInfo.configured) {
    return Response.json(
      {
        error:
          "Server penyimpanan (MongoDB & Google Spreadsheet) belum dikonfigurasi oleh admin. Karyamu tetap tersimpan aman di Galeri browser ini.",
        code: "STORAGE_NOT_CONFIGURED",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Jalur utama (Hybrid): simpan ke MongoDB dulu, lalu sinkronkan ke Google Sheets
  if (dbConfigured) {
    try {
      const created = await createStudentSubmissionInDb(parsed.data);
      if (!created) {
        return Response.json(
          { error: "Koneksi database sedang tidak tersedia." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }

      const { record, classroom } = created;
      const sheetSync = await syncSubmissionToGoogleSheets(record, {
        spreadsheetId: classroom?.spreadsheetId ?? null,
        baseUrl,
        writeTeacherColumns: false,
      });

      await updateSubmissionSheetSync(record.submissionId, sheetSync);

      return Response.json(
        {
          ok: true,
          submissionId: record.submissionId,
          version: record.version,
          classCode: record.classCode,
          submittedAtIso: record.submittedAtIso,
          storedInDatabase: true,
          sheetSync,
          metrics: record.metrics,
          analysisSummary: {
            totalWords: record.analysis.totalWords,
            passedIndicatorsCount: record.analysis.passedIndicatorsCount,
            eydIssuesCount: record.analysis.eydIssuesCount,
            authenticityStatus: record.analysis.authenticityStatus,
            authenticityLabel: formatAuthenticityLabel(
              record.analysis.authenticityStatus
            ),
          },
        },
        { status: 201, headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (error instanceof ClassroomClosedError) {
        return Response.json(
          { error: error.message, code: "CLASSROOM_CLOSED" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      return Response.json(
        {
          error:
            "Gagal menyimpan ke database server. Karyamu tetap tersimpan di browser — silakan coba kirim ulang beberapa saat lagi.",
          code: "DATABASE_WRITE_FAILED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  // Fallback jika hanya Google Sheets yang dikonfigurasi (tanpa MongoDB)
  const resolvedClassCode = normalizeClassCode(
    parsed.data.classCode,
    parsed.data.authorClass
  );
  const record = buildVerifiedSubmissionRecord({
    payload: parsed.data,
    resolvedClassCode,
    version: 1,
    spreadsheetId: sheetsInfo.defaultSpreadsheetId,
  });

  const sheetSync = await syncSubmissionToGoogleSheets(record, {
    spreadsheetId: sheetsInfo.defaultSpreadsheetId,
    baseUrl,
    writeTeacherColumns: false,
  });

  if (sheetSync.status !== "synced") {
    return Response.json(
      {
        error:
          "Gagal mengirim ke Google Spreadsheet dan database cadangan belum aktif. Karyamu tetap aman di Galeri browser ini.",
        details: sheetSync.lastError,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    {
      ok: true,
      submissionId: record.submissionId,
      version: record.version,
      classCode: record.classCode,
      submittedAtIso: record.submittedAtIso,
      storedInDatabase: false,
      sheetSync,
      metrics: record.metrics,
      analysisSummary: {
        totalWords: record.analysis.totalWords,
        passedIndicatorsCount: record.analysis.passedIndicatorsCount,
        eydIssuesCount: record.analysis.eydIssuesCount,
        authenticityStatus: record.analysis.authenticityStatus,
        authenticityLabel: formatAuthenticityLabel(
          record.analysis.authenticityStatus
        ),
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
