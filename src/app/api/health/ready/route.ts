import { pingDatabase } from "@/lib/db/mongo";

/**
 * Readiness probe: checks configured dependencies.
 *
 * Stage 0 semantics: a dependency that is not configured is reported as `not_configured` and does
 * not fail readiness, because no feature depends on it yet. Once documents/analyses are persisted
 * (Stage 1+/8), the database becomes required and `not_configured` must fail readiness.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const database = await pingDatabase();
  const ready = database.status !== "error";

  return Response.json(
    { status: ready ? "ready" : "not_ready", checks: { database } },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
