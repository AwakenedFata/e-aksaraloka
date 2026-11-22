import { getServerEnv } from "@/lib/config/env";
import {
  buildOfflineCoachFallback,
  checkCoachRateLimit,
  runSocraticCoach,
} from "@/lib/ai/coachProvider";
import { coachRequestSchema } from "@/lib/ai/coachSchemas";

export const dynamic = "force-dynamic";

function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local-classroom";
}

/**
 * Capability probe (tanpa membocorkan kunci rahasia):
 * Menginformasikan provider mana yang siap serta bahwa mode luring selalu aktif.
 */
export function GET(): Response {
  const env = getServerEnv();
  return Response.json(
    {
      status: "ok",
      providersConfigured: {
        groq: Boolean(env.GROQ_API_KEY),
        gemini: Boolean(env.GEMINI_API_KEY),
      },
      offlineFallbackReady: true,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Socratic AI Coach endpoint:
 * Primary Groq -> Fallback Gemini -> Fallback Kurasi Luring (Layer 1).
 */
export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Format permintaan tidak valid (JSON diperlukan)." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = coachRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Data isian belum lengkap.";
    return Response.json(
      { error: firstIssue },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const clientIp = extractClientIp(request);
  const limit = checkCoachRateLimit(clientIp);
  if (!limit.allowed) {
    // Graceful degradation: tetap memberi saran Lapisan 1 luring meski batas permintaan AI tercapai
    const offline = buildOfflineCoachFallback(
      parsed.data,
      `Batas permintaan AI sementara tercapai (coba lagi dalam ${limit.retryAfterSec} detik); memakai Bank Kurasi Luring.`
    );
    return Response.json(offline, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Aksaraloka-Rate-Limited": "1",
      },
    });
  }

  const result = await runSocraticCoach(parsed.data);
  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
