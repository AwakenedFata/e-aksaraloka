import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCoachRateLimit,
  resetCoachRateLimiterForTests,
  runSocraticCoach,
  type FetchLike,
} from "./coachProvider";
import type { CoachRequest } from "./coachSchemas";

const SAMPLE_THEME_REQ: CoachRequest = {
  mode: "theme_lexicon",
  theme: "Kerajaan Jamur Bercahaya di Dasar Gua",
  settingPlace: "Lembah Spora Perak",
  worldRule: "Jamur hanya berpendar jika disentuh oleh orang yang berkata jujur.",
  protagonistName: "Kira",
};

const VALID_THEME_JSON = {
  sensoryWords: [
    {
      word: "Pendar zamrud",
      sense: "Penglihatan",
      type: "Denotatif",
      meaning: "Cahaya hijau lembut dari tudung jamur ajaib.",
      usageHint: "Cocok dipakai saat Kira pertama kali memasuki gua.",
    },
    {
      word: "Kabut spora perak",
      sense: "Penglihatan",
      type: "Denotatif",
      meaning: "Butiran halus bercahaya yang melayang pelan di udara.",
      usageHint: "Gunakan saat menggambarkan latar di Orientasi.",
    },
    {
      word: "Gema tetes air",
      sense: "Pendengaran",
      type: "Denotatif",
      meaning: "Suara ritmis air jatuh di dinding batu gua.",
      usageHint: "Memperkuat suasana sunyi sebelum tokoh lawan muncul.",
    },
    {
      word: "Desis angin gua",
      sense: "Pendengaran",
      type: "Denotatif",
      meaning: "Bunyi lirih udara keluar dari celah karang sempit.",
      usageHint: "Tanda awal munculnya masalah di Komplikasi.",
    },
    {
      word: "Aroma tanah lembap",
      sense: "Aroma / Sentuhan",
      type: "Denotatif",
      meaning: "Bau alami tanah basah khas dasar gua.",
      usageHint: "Tambahkan agar pembaca ikut mencium suasana latar.",
    },
    {
      word: "Dingin menusuk",
      sense: "Aroma / Sentuhan",
      type: "Konotatif",
      meaning: "Rasa dingin tajam yang menempel pada kulit.",
      usageHint: "Tunjukkan reaksi tokoh saat menghadapi bahaya.",
    },
  ],
  majasFrames: [
    {
      connector: "bagaikan",
      // Deliberately omit [...] to verify anti-ghostwriting post-filter adds it automatically!
      frameWithBlank: "Tudung jamur raksasa berpendar terang bagaikan lentera langit malam.",
      whyItFits: "Memperindah suasana gua jamur bercahaya.",
    },
    {
      connector: "seperti",
      frameWithBlank: "Kira melompat menghindari batu jatuh seperti [tulis hal yang sangat gesit].",
      whyItFits: "Menambah ketegangan di puncak masalah.",
    },
  ],
  imaginationQuestions: [
    "Apa yang terjadi pada cahaya jamur jika ada tokoh yang berbohong di dalam gua?",
    "Suara aneh apa yang pertama kali memperingatkan Kira tentang bahaya?",
  ],
};

describe("Hybrid Socratic AI Coach Provider (Groq -> Gemini -> Offline Fallback)", () => {
  beforeEach(() => {
    resetCoachRateLimiterForTests();
  });

  it("uses Groq as primary provider when GROQ_API_KEY is configured and enforces anti-ghostwriting [...] blanks", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const url = String(input);
      expect(url).toContain("api.groq.com");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(VALID_THEME_JSON) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await runSocraticCoach(SAMPLE_THEME_REQ, {
      fetchFn: fetchMock,
      envOverride: {
        GROQ_API_KEY: "gsk_test_secret_123",
        GROQ_MODEL: "openai/gpt-oss-120b",
        GEMINI_API_KEY: "AIza_test_secret_456",
        GEMINI_MODEL: "gemini-2.5-flash",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(result.fallbackUsed).toBe(false);
    expect(result.verificationStatus).toBe("model_suggestion");
    expect(result.mode).toBe("theme_lexicon");
    if (result.mode === "theme_lexicon") {
      // Anti-ghostwriting post-filter must guarantee [...] even when model omitted it
      for (const frame of result.data.majasFrames) {
        expect(frame.frameWithBlank).toMatch(/\[[^\]\n]{3,90}\]/);
      }
    }
  });

  it("recovers cleanly when primary Groq model returns 404 by falling back to next active Groq model and normalizing imperfect LLM casing", async () => {
    const fetchMock = vi.fn<FetchLike>(async (_input, init) => {
      const parsedBody = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      if (parsedBody.model === "deprecated-model-id") {
        return new Response(JSON.stringify({ error: { code: "model_not_found" } }), {
          status: 404,
        });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sensoryWords: VALID_THEME_JSON.sensoryWords.map((w) => ({
                    ...w,
                    sense: w.sense === "Aroma / Sentuhan" ? "Penciuman/Peraba" : w.sense,
                    type: w.type === "Kiasan / Majas" ? "Kiasan" : w.type.toLowerCase(),
                  })),
                  majasFrames: VALID_THEME_JSON.majasFrames.map((f) => ({
                    ...f,
                    connector: "Bagaikan",
                  })),
                  imaginationQuestions: VALID_THEME_JSON.imaginationQuestions,
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    });

    const result = await runSocraticCoach(SAMPLE_THEME_REQ, {
      fetchFn: fetchMock,
      envOverride: {
        GROQ_API_KEY: "gsk_test_resilience",
        GROQ_MODEL: "deprecated-model-id",
      },
    });

    expect(result.provider).toBe("groq");
    expect(result.model).toBe("qwen/qwen3.8-27b");
    expect(result.mode).toBe("theme_lexicon");
  });

  it("automatically falls back from Groq (HTTP 429 token/rate limit) to Gemini using x-goog-api-key header (never in URL)", async () => {
    const geminiSecret = "AIza_never_in_url_secret_789";
    const calls: string[] = [];

    const fetchMock = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("api.groq.com")) {
        return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
          status: 429,
        });
      }
      // Verify Gemini key is passed in header, NEVER leaked in query string
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(url).not.toContain(geminiSecret);
      const headers = new Headers(init?.headers);
      expect(headers.get("x-goog-api-key")).toBe(geminiSecret);

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(VALID_THEME_JSON) }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await runSocraticCoach(SAMPLE_THEME_REQ, {
      fetchFn: fetchMock,
      envOverride: {
        GROQ_API_KEY: "gsk_exhausted_key",
        GROQ_MODEL: "llama-3.3-70b-versatile",
        GEMINI_API_KEY: geminiSecret,
        GEMINI_MODEL: "gemini-2.5-flash",
      },
    });

    expect(calls).toHaveLength(2);
    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackNotice).toContain("Gemini");
    expect(JSON.stringify(result)).not.toContain(geminiSecret);
  });

  it("falls back to Gemini secondary model (gemini-2.0-flash) if primary Gemini model fails", async () => {
    const fetchMock = vi.fn<FetchLike>(async (input) => {
      const url = String(input);
      if (url.includes("gemini-2.5-flash")) {
        return new Response("quota exceeded", { status: 429 });
      }
      if (url.includes("gemini-2.0-flash")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        consistencyStatus: "perlu_diperkuat",
                        summary: "Penyelesaian di akhir cerita belum menjelaskan syarat kejujuran.",
                        strengths: ["Aturan keajaiban di Lembar 1 sudah jelas."],
                        guidingQuestions: [
                          "Kejujuran apa yang diucapkan Kira sebelum jamur kembali berpendar?",
                          "Risiko apa yang muncul jika ia sempat ragu?",
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("error", { status: 500 });
    });

    const result = await runSocraticCoach(
      {
        mode: "logic_check",
        theme: "Gua Jamur",
        worldRule: "Jamur hanya berpendar jika disentuh oleh orang yang berkata jujur.",
        paragraphOrientasi: "Kira masuk ke gua jamur yang temaram.",
        paragraphKomplikasi: "Kabut gelap datang menutup jalan keluar.",
        paragraphKlimaks: "Kira menyentuh jamur lalu langsung menyala terang.",
        paragraphResolusi: "Kira akhirnya pulang dengan selamat.",
      },
      {
        fetchFn: fetchMock,
        envOverride: {
          GEMINI_API_KEY: "AIza_secondary_test",
          GEMINI_MODEL: "gemini-2.5-flash",
        },
      }
    );

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-2.0-flash");
    expect(result.mode).toBe("logic_check");
  });

  it("falls back cleanly to Offline Layer 1 Curated Engine when both Groq and Gemini fail or are unconfigured", async () => {
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw new Error("Network offline");
    });

    const result = await runSocraticCoach(SAMPLE_THEME_REQ, {
      fetchFn: fetchMock,
      envOverride: {
        GROQ_API_KEY: "gsk_offline",
        GEMINI_API_KEY: "AIza_offline",
      },
    });

    expect(result.provider).toBe("offline_fallback");
    expect(result.verificationStatus).toBe("curated_offline");
    expect(result.fallbackUsed).toBe(true);
    expect(result.mode).toBe("theme_lexicon");
    if (result.mode === "theme_lexicon") {
      expect(result.data.sensoryWords.length).toBeGreaterThanOrEqual(6);
      expect(result.data.majasFrames.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("enforces per-client sliding-window rate limits", () => {
    const ip = "203.0.113.10";
    const start = 1_700_000_000_000;
    for (let i = 0; i < 24; i++) {
      expect(checkCoachRateLimit(ip, start + i * 1000).allowed).toBe(true);
    }
    const blocked = checkCoachRateLimit(ip, start + 30_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
