import { requireTeacherSession } from "@/lib/auth/teacherAuth";
import {
  listClassrooms,
  upsertClassroom,
} from "@/lib/submissions/submissionRepository";
import { upsertClassroomSchema } from "@/lib/submissions/submissionSchemas";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  try {
    const classrooms = await listClassrooms();
    return Response.json(
      { classrooms },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Gagal mengambil daftar kode kelas." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireTeacherSession();
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Format JSON kode kelas tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = upsertClassroomSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Data kelas belum valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const classroom = await upsertClassroom(parsed.data);
    if (!classroom) {
      return Response.json(
        { error: "Penyimpanan karya daring belum diaktifkan oleh pengelola aplikasi." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return Response.json(
      { ok: true, classroom },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Belum berhasil menyimpan kode kelas. Silakan coba beberapa saat lagi." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
