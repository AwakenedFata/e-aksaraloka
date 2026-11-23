import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import { requireTeacherSession } from "@/lib/auth/teacherAuth";
import {
  getSheetsIntegrationStatus,
  syncSubmissionToGoogleSheets,
} from "@/lib/integrations/googleSheetsSync";
import {
  listPendingOrFailedSyncSubmissionsFromDb,
  updateSubmissionSheetSync,
} from "@/lib/submissions/submissionRepository";

export const dynamic = "force-dynamic";

const syncRequestSchema = z
  .object({
    submissionId: z.string().trim().min(1).max(80).optional(),
  })
  .optional();

function resolveBaseUrl(request: Request): string | null {
  const env = getServerEnv();
  if (env.APP_PUBLIC_URL) return env.APP_PUBLIC_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/**
 * Menyinkronkan ulang satu atau semua pengumpulan siswa yang berstatus
 * `pending` / `failed` / `not_configured` ke Google Spreadsheet.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  const sheets = getSheetsIntegrationStatus();
  if (!sheets.configured) {
    return Response.json(
      {
        error:
          "Integrasi Google Spreadsheet belum dikonfigurasi pada environment server.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return Response.json(
      { error: "Format permintaan sinkronisasi tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Parameter submissionId tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const baseUrl = resolveBaseUrl(request);

  try {
    const targets = await listPendingOrFailedSyncSubmissionsFromDb(
      parsed.data?.submissionId
    );
    let synced = 0;
    let failed = 0;
    const results: Array<{
      submissionId: string;
      status: string;
      error: string | null;
    }> = [];

    for (const record of targets) {
      const hasTeacherReview =
        record.teacherReview.teacherScore !== null ||
        record.teacherReview.teacherFeedback.trim().length > 0;
      const sheetSync = await syncSubmissionToGoogleSheets(record, {
        spreadsheetId: record.sheetSync.spreadsheetId,
        baseUrl,
        writeTeacherColumns: hasTeacherReview,
      });
      await updateSubmissionSheetSync(record.submissionId, sheetSync);

      if (sheetSync.status === "synced") {
        synced++;
      } else {
        failed++;
      }
      results.push({
        submissionId: record.submissionId,
        status: sheetSync.status,
        error: sheetSync.lastError,
      });
    }

    return Response.json(
      {
        ok: true,
        attempted: targets.length,
        synced,
        failed,
        results,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Belum berhasil mengirim ulang data ke Google Sheets. Silakan coba lagi." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
