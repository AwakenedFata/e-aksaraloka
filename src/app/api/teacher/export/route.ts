import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/config/env";
import { requireTeacherSession } from "@/lib/auth/teacherAuth";
import { buildTeacherExportCsv } from "@/lib/integrations/googleSheetsFormatters";
import { listSubmissionsFromDb } from "@/lib/submissions/submissionRepository";

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

export async function GET(request: NextRequest): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const classCode = sp.get("classCode") ?? undefined;
  const includeHistory = sp.get("includeHistory") === "1";

  try {
    const submissions = await listSubmissionsFromDb({
      classCode,
      includeHistory,
      limit: 500,
    });
    const csv = buildTeacherExportCsv(submissions, resolveBaseUrl(request));
    const dateTag = new Date().toISOString().slice(0, 10);
    const classTag =
      classCode && classCode !== "ALL"
        ? `-${classCode.replace(/[^A-Za-z0-9_-]/g, "")}`
        : "";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aksaraloka-rekap${classTag}-${dateTag}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Gagal membuat berkas ekspor CSV dari database." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
