import type { NextRequest } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/mongo";
import { requireTeacherSession } from "@/lib/auth/teacherAuth";
import { getSheetsIntegrationStatus } from "@/lib/integrations/googleSheetsSync";
import {
  listClassrooms,
  listSubmissionsFromDb,
} from "@/lib/submissions/submissionRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  const dbConfigured = isDatabaseConfigured();
  const sheets = getSheetsIntegrationStatus();

  if (!dbConfigured) {
    return Response.json(
      {
        databaseConfigured: false,
        sheetsConfigured: sheets.configured,
        sheetsMode: sheets.mode,
        spreadsheetUrl: sheets.spreadsheetUrl,
        submissions: [],
        classrooms: [],
        stats: {
          totalStudents: 0,
          avgHolisticScore: 0,
          avgStudioScore: 0,
          originalCount: 0,
          presetWarningCount: 0,
          syncedCount: 0,
          unsyncedCount: 0,
          featuredCount: 0,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const sp = request.nextUrl.searchParams;
  const classCode = sp.get("classCode") ?? undefined;
  const search = sp.get("search") ?? undefined;
  const syncStatus = sp.get("syncStatus") ?? undefined;
  const featuredOnly = sp.get("featured") === "1";
  const includeHistory = sp.get("includeHistory") === "1";

  try {
    const [submissions, classrooms] = await Promise.all([
      listSubmissionsFromDb({
        classCode,
        search,
        syncStatus,
        featuredOnly,
        includeHistory,
      }),
      listClassrooms(),
    ]);

    const total = submissions.length;
    const sumHolistic = submissions.reduce(
      (acc, s) => acc + s.metrics.holisticTotalPercentage,
      0
    );
    const sumStudio = submissions.reduce((acc, s) => acc + s.metrics.babak4Score, 0);
    const originalCount = submissions.filter(
      (s) => s.analysis.authenticityStatus === "orisinal"
    ).length;
    const presetWarningCount = submissions.filter(
      (s) => s.analysis.authenticityStatus === "teks_contoh_preset"
    ).length;
    const syncedCount = submissions.filter(
      (s) => s.sheetSync.status === "synced"
    ).length;
    const unsyncedCount = total - syncedCount;
    const featuredCount = submissions.filter(
      (s) => s.teacherReview.isFeaturedInGallery
    ).length;

    return Response.json(
      {
        databaseConfigured: true,
        sheetsConfigured: sheets.configured,
        sheetsMode: sheets.mode,
        spreadsheetUrl: sheets.spreadsheetUrl,
        submissions,
        classrooms,
        stats: {
          totalStudents: total,
          avgHolisticScore: total > 0 ? Math.round(sumHolistic / total) : 0,
          avgStudioScore: total > 0 ? Math.round(sumStudio / total) : 0,
          originalCount,
          presetWarningCount,
          syncedCount,
          unsyncedCount,
          featuredCount,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error:
          "Belum dapat terhubung ke layanan penyimpanan karya. Silakan tunggu sebentar lalu tekan 'Segarkan Data'.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
