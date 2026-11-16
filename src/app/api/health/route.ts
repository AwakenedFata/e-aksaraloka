import { getBuildInfo } from "@/lib/config/build-info";

/**
 * Liveness probe: answers "is the process up and is configuration valid?".
 * Does not touch external dependencies, so it stays cheap and never cascades failures.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok", service: getBuildInfo(), timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
