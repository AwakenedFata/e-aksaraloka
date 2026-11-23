import type { Metadata } from "next";
import { isDatabaseConfigured } from "@/lib/db/mongo";
import { getTeacherSessionStatus } from "@/lib/auth/teacherAuth";
import { getSheetsIntegrationStatus } from "@/lib/integrations/googleSheetsSync";
import { TeacherDashboardClient } from "@/components/guru/TeacherDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ruang Guru",
  description:
    "Ruang Guru Aksaraloka untuk membaca cerita fantasi siswa, memeriksa Peta Rancang dan EYD V, memberi nilai akhir, serta membuka rekap Google Sheets.",
};

export default async function GuruPage({
  searchParams,
}: {
  searchParams: Promise<{ karya?: string }>;
}) {
  const [session, params] = await Promise.all([
    getTeacherSessionStatus(),
    searchParams,
  ]);
  const sheets = getSheetsIntegrationStatus();
  const initialSelectedSubmissionId =
    typeof params.karya === "string" && params.karya.trim()
      ? params.karya.trim()
      : null;

  return (
    <TeacherDashboardClient
      initialConfigured={session.configured}
      initialAuthenticated={session.authenticated}
      initialDatabaseConfigured={isDatabaseConfigured()}
      initialSheetsConfigured={sheets.configured}
      initialSheetsMode={sheets.mode}
      initialSpreadsheetUrl={session.authenticated ? sheets.spreadsheetUrl : null}
      initialSelectedSubmissionId={initialSelectedSubmissionId}
    />
  );
}
