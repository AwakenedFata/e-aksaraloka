import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/config/env";
import { requireTeacherSession } from "@/lib/auth/teacherAuth";
import { syncSubmissionToGoogleSheets } from "@/lib/integrations/googleSheetsSync";
import {
  getStudentRevisionHistoryFromDb,
  getSubmissionByIdFromDb,
  updateSubmissionSheetSync,
  updateSubmissionTeacherReviewInDb,
} from "@/lib/submissions/submissionRepository";
import { teacherReviewUpdateSchema } from "@/lib/submissions/submissionSchemas";

export const dynamic = "force-dynamic";

function resolveBaseUrl(request: Request): string | null {
  const env = getServerEnv();
  if (env.APP_PUBLIC_URL) return env.APP_PUBLIC_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  const { id } = await context.params;
  try {
    const submission = await getSubmissionByIdFromDb(id);
    if (!submission) {
      return Response.json(
        { error: "Data pengumpulan siswa tidak ditemukan." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const revisions = await getStudentRevisionHistoryFromDb(submission.studentKey);
    return Response.json(
      { submission, revisions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Belum dapat memuat detail naskah siswa. Silakan coba lagi beberapa saat." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Format JSON penilaian tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = teacherReviewUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Isian penilaian guru tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const updated = await updateSubmissionTeacherReviewInDb(id, parsed.data);
    if (!updated) {
      return Response.json(
        { error: "Data pengumpulan siswa tidak ditemukan." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sheetSync = await syncSubmissionToGoogleSheets(updated, {
      spreadsheetId: updated.sheetSync.spreadsheetId,
      baseUrl: resolveBaseUrl(request),
      writeTeacherColumns: true,
    });
    await updateSubmissionSheetSync(updated.submissionId, sheetSync);

    return Response.json(
      {
        ok: true,
        submission: {
          ...updated,
          sheetSync,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Belum berhasil menyimpan nilai guru. Silakan coba beberapa saat lagi." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
