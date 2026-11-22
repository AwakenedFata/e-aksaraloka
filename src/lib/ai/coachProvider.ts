import "server-only";
import { getServerEnv } from "@/lib/config/env";
import {
  type CoachRequest,
  type CoachSuccessResponse,
  type LogicCheckPayload,
  type SocraticReviewPayload,
  type ThemeLexiconPayload,
  logicCheckPayloadSchema,
  socraticReviewPayloadSchema,
  themeLexiconPayloadSchema,
} from "./coachSchemas";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_SECONDARY_MODEL = "gemini-2.0-flash";

const PROVIDER_TIMEOUT_MS = 8500;
const MODEL_DISCLAIMER =
  "Saran pemantik dari Asisten AI Sokratik (bukan otoritas resmi KBBI/EYD V). Lengkapi tanda [...] dengan kalimat karyamu sendiri!";
const OFFLINE_DISCLAIMER =
  "Saran pemantik dari Bank Kurasi Luring E-Aksaraloka. Lengkapi tanda [...] dengan kalimat karyamu sendiri!";

// ============================================================================
// IN-MEMORY SLIDING-WINDOW RATE LIMITER (CLASSROOM-FRIENDLY QUOTA GUARD)
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 menit
const RATE_LIMIT_MAX_REQUESTS = 24;
const rateBuckets = new Map<string, number[]>();

export function checkCoachRateLimit(
  clientKey: string,
  nowMs: number = Date.now()
): { readonly allowed: boolean; readonly remaining: number; readonly retryAfterSec: number } {
  const cutoff = nowMs - RATE_LIMIT_WINDOW_MS;

  // Periodic cleanup to keep memory bounded on long-lived processes
  if (rateBuckets.size > 500) {
    for (const [k, timestamps] of rateBuckets.entries()) {
      const kept = timestamps.filter((ts) => ts > cutoff);
      if (kept.length === 0) rateBuckets.delete(k);
      else rateBuckets.set(k, kept);
    }
  }

  const prev = rateBuckets.get(clientKey) ?? [];
  const active = prev.filter((ts) => ts > cutoff);

  if (active.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = active[0] ?? nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - nowMs) / 1000));
    rateBuckets.set(clientKey, active);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  active.push(nowMs);
  rateBuckets.set(clientKey, active);
  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - active.length),
    retryAfterSec: 0,
  };
}

export function resetCoachRateLimiterForTests(): void {
  rateBuckets.clear();
}

// ============================================================================
// ANTI-GHOSTWRITING SYSTEM PROMPT & PROMPT BUILDERS (SMP KELAS VII SAFE)
// ============================================================================

const SYSTEM_PROMPT = [
  "Kamu adalah Pelatih Menulis Sokratik E-Aksaraloka untuk siswa kelas VII SMP (usia 12-13 tahun) mata pelajaran Bahasa Indonesia (Cerita Fantasi).",
  "ATURAN PEDAGOGIS WAJIB:",
  "1. JANGAN PERNAH menuliskan paragraf cerita utuh, melanjutkan cerita siswa, atau menulis ulang seluruh karangan siswa.",
  "2. Tugasmu HANYA memantik imajinasi lewat kata-kata panca indera, kerangka rumpang bertanda [...], dan pertanyaan Sokratik yang singkat, ramah, dan membangun.",
  "3. JANGAN mengklaim hasilmu sebagai aturan resmi KBBI atau EYD V; fokus pada imajinasi, kelogisan aturan dunia cerita, watak tokoh, dan panca indera.",
  "4. Pastikan seluruh bahasa baku, santun, bebas kekerasan ekstrem, bebas konten dewasa, dan sesuai untuk anak kelas VII SMP.",
  "5. Balas HANYA dengan satu objek JSON valid tanpa markdown fence (tanpa ```json) yang persis mengikuti skema yang diminta.",
].join("\n");

function buildUserPrompt(req: CoachRequest): string {
  if (req.mode === "theme_lexicon") {
    return [
      `Mode: Pemantik Diksi & Kerangka Majas untuk Tema Orisinal Siswa.`,
      `Tema Fantasi Siswa: "${req.theme}"`,
      req.settingPlace ? `Latar Tempat: "${req.settingPlace}"` : "",
      req.worldRule ? `Aturan Keajaiban: "${req.worldRule}"` : "",
      req.protagonistName ? `Nama Tokoh Utama: "${req.protagonistName}"` : "",
      "",
      "Hasilkan JSON persis dengan kunci berikut:",
      "{",
      '  "sensoryWords": [',
      '    { "word": "kata/frasa singkat", "sense": "Penglihatan" | "Pendengaran" | "Aroma / Sentuhan", "type": "Denotatif" | "Konotatif" | "Kiasan / Majas", "meaning": "arti singkat ramah SMP VII", "usageHint": "petunjuk pemakaian singkat bukan paragraf" }',
      "  ] (tepat 6 item: 2 Penglihatan, 2 Pendengaran, 2 Aroma / Sentuhan, spesifik ke tema siswa!),",
      '  "majasFrames": [',
      '    { "connector": "seperti" | "bagaikan" | "bagai" | "laksana" | "bak" | "seumpama", "frameWithBlank": "kerangka kalimat rumpang WAJIB mengandung [...] agar siswa mengisi sendiri", "whyItFits": "alasan singkat kecocokan dengan tema" }',
      "  ] (tepat 3 item, WAJIB ada [...] di setiap frameWithBlank!),",
      '  "imaginationQuestions": ["2 pertanyaan pemantik imajinasi singkat khusus tema ini"]',
      "}",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (req.mode === "logic_check") {
    return [
      `Mode: Penguji Konsistensi Logika Aturan Dunia Fantasi (TP 2 & TP 5).`,
      `Tema: "${req.theme || "Cerita Fantasi"}"`,
      `Aturan Keajaiban yang Dibuat Siswa: "${req.worldRule}"`,
      `Paragraf Awal (Orientasi): "${req.paragraphOrientasi || "(kosong)"}"`,
      `Paragraf Masalah (Komplikasi): "${req.paragraphKomplikasi || "(kosong)"}"`,
      `Paragraf Puncak (Klimaks): "${req.paragraphKlimaks || "(kosong)"}"`,
      `Paragraf Akhir (Resolusi): "${req.paragraphResolusi || "(kosong)"}"`,
      "",
      "Periksa apakah kejadian dan penyelesaian di Komplikasi/Klimaks/Resolusi sudah mematuhi atau malah melanggar Aturan Keajaiban di atas. JANGAN menuliskan paragraf perbaikan.",
      "Hasilkan JSON persis dengan kunci berikut:",
      "{",
      '  "consistencyStatus": "konsisten" | "perlu_diperkuat" | "terindikasi_melanggar",',
      '  "summary": "ringkasan 1-2 kalimat ramah anak mengenai kaitan cerita dengan aturan keajaibannya",',
      '  "strengths": ["1-2 hal yang sudah bagus dari ide atau logika siswa"],',
      '  "guidingQuestions": ["2 pertanyaan Sokratik penuntun agar siswa sendiri yang memperjelas atau memperbaiki logika ceritanya"]',
      "}",
    ].join("\n");
  }

  return [
    `Mode: Pelatih Revisi Sokratik Menulis Cerita Fantasi (TP 3, TP 4, TP 5).`,
    `Judul: "${req.storyTitle || "(belum ada)"}"`,
    `Tema: "${req.theme || "Cerita Fantasi"}"`,
    `Aturan Keajaiban: "${req.worldRule || "(belum diisi)"}"`,
    `Paragraf 1 (Orientasi): "${req.paragraphOrientasi || "(kosong)"}"`,
    `Paragraf 2 (Komplikasi): "${req.paragraphKomplikasi || "(kosong)"}"`,
    `Paragraf 3 (Klimaks): "${req.paragraphKlimaks || "(kosong)"}"`,
    `Paragraf 4 (Resolusi): "${req.paragraphResolusi || "(kosong)"}"`,
    `Amanat: "${req.amanat || "(belum diisi)"}"`,
    "",
    "Berikan apresiasi spesifik lalu pertanyaan penuntun revisi yang ramah siswa kelas VII SMP. DILARANG menulis ulang paragraf siswa.",
    "Hasilkan JSON persis dengan kunci berikut:",
    "{",
    '  "appreciations": ["2 pujian konkret menyebut tokoh/ide/suasana yang sudah ditulis siswa"],',
    '  "guidingQuestions": ["2-3 pertanyaan penuntun revisi agar siswa memperkaya watak, indera, atau penyelesaian ceritanya sendiri"],',
    '  "nextMiniChallenge": "1 tantangan mini seru (maks 1 kalimat) untuk revisi berikutnya"',
    "}",
  ].join("\n");
}

// ============================================================================
// JSON EXTRACTION & ANTI-GHOSTWRITING POST-FILTER
// ============================================================================

function extractJsonObject(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function enforceFrameHasBlank(frame: string, connector: string): string {
  const cleaned = frame.replace(/\s+/g, " ").trim();
  if (/\[[^\]\n]{3,90}\]/.test(cleaned)) {
    return cleaned.slice(0, 195);
  }
  // If model forgot [...] placeholder, enforce anti-ghostwriting blank after connector
  const lower = cleaned.toLowerCase();
  const idx = lower.indexOf(connector.toLowerCase());
  if (idx !== -1) {
    const prefix = cleaned.slice(0, idx + connector.length).trim();
    return `${prefix} [lengkapi perumpamaan orisinalmu di sini].`.slice(0, 195);
  }
  return `[Tulis aksi tokoh] ${connector} [lengkapi perumpamaan orisinalmu di sini].`;
}

function validateAndSanitizePayload(
  mode: CoachRequest["mode"],
  parsedJson: unknown
): ThemeLexiconPayload | LogicCheckPayload | SocraticReviewPayload {
  if (mode === "theme_lexicon") {
    const validated = themeLexiconPayloadSchema.parse(parsedJson);
    return {
      ...validated,
      majasFrames: validated.majasFrames.map((item) => ({
        ...item,
        frameWithBlank: enforceFrameHasBlank(item.frameWithBlank, item.connector),
      })),
    };
  }
  if (mode === "logic_check") {
    return logicCheckPayloadSchema.parse(parsedJson);
  }
  return socraticReviewPayloadSchema.parse(parsedJson);
}

// ============================================================================
// PROVIDER CLIENTS (GROQ PRIMARY -> GEMINI FALLBACK)
// ============================================================================

export type FetchLike = typeof fetch;

async function callGroqJson(
  apiKey: string,
  model: string,
  userPrompt: string,
  fetchFn: FetchLike
): Promise<unknown> {
  const res = await fetchFn(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Groq HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    readonly choices?: readonly {
      readonly message?: { readonly content?: string };
    }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty completion content.");
  }
  return extractJsonObject(content);
}

async function callGeminiJson(
  apiKey: string,
  model: string,
  userPrompt: string,
  fetchFn: FetchLike
): Promise<{ readonly json: unknown; readonly usedModel: string }> {
  const tryModel = async (targetModel: string): Promise<unknown> => {
    const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(targetModel)}:generateContent`;
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 950,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      readonly candidates?: readonly {
        readonly content?: {
          readonly parts?: readonly { readonly text?: string }[];
        };
      }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned empty candidate text.");
    }
    return extractJsonObject(text);
  };

  try {
    const json = await tryModel(model);
    return { json, usedModel: model };
  } catch (primaryErr) {
    if (model !== GEMINI_SECONDARY_MODEL) {
      const json = await tryModel(GEMINI_SECONDARY_MODEL);
      return { json, usedModel: GEMINI_SECONDARY_MODEL };
    }
    throw primaryErr;
  }
}

// ============================================================================
// TERTIARY FALLBACK: DETERMINISTIC OFFLINE LAYER 1 CURATED GENERATOR
// ============================================================================

export function buildOfflineCoachFallback(
  req: CoachRequest,
  fallbackNotice?: string
): CoachSuccessResponse {
  const base = {
    provider: "offline_fallback" as const,
    model: "aksaraloka-curated-v1",
    fallbackUsed: true,
    fallbackNotice:
      fallbackNotice ??
      "Mode Luring Aktif: saran diambil dari Bank Kurasi E-Aksaraloka tanpa koneksi AI.",
    verificationStatus: "curated_offline" as const,
    disclaimer: OFFLINE_DISCLAIMER,
  };

  if (req.mode === "theme_lexicon") {
    const lowerTheme = `${req.theme} ${req.settingPlace}`.toLowerCase();
    const isOcean = /laut|air|samudra|karang|pantai|sungai|kapal|paus/.test(lowerTheme);
    const isSky = /awan|langit|bintang|angin|terbang|menara|bulan/.test(lowerTheme);
    const isTech = /mesin|robot|jam|kereta|kota|besi|gear|waktu/.test(lowerTheme);

    const sensoryWords: ThemeLexiconPayload["sensoryWords"] = isOcean
      ? [
          {
            word: "Berpendar biru safir",
            sense: "Penglihatan",
            type: "Denotatif",
            meaning: "Memancarkan cahaya biru lembut di kedalaman air.",
            usageHint: "Cocok menggambarkan kubah kaca, karang, atau makhluk laut ajaib.",
          },
          {
            word: "Kilau sisik perak",
            sense: "Penglihatan",
            type: "Denotatif",
            meaning: "Pantulan cahaya terang dari permukaan air atau biota laut.",
            usageHint: "Pakai saat tokohmu melihat sesuatu melintas cepat di air.",
          },
          {
            word: "Gema arus dalam",
            sense: "Pendengaran",
            type: "Denotatif",
            meaning: "Suara rendah yang memantul dari pergerakan air besar.",
            usageHint: "Bangun ketegangan saat bahaya mendekat di bawah laut.",
          },
          {
            word: "Denting lonceng kerang",
            sense: "Pendengaran",
            type: "Denotatif",
            meaning: "Bunyi nyaring lembut seperti lonceng kecil dari kulit kerang.",
            usageHint: "Bisa menjadi tanda gerbang kota bawah laut terbuka.",
          },
          {
            word: "Bau garam laut",
            sense: "Aroma / Sentuhan",
            type: "Denotatif",
            meaning: "Aroma khas air laut yang tajam dan segar di udara.",
            usageHint: "Tambahkan pada paragraf awal untuk menghidupkan latar.",
          },
          {
            word: "Dingin lembap",
            sense: "Aroma / Sentuhan",
            type: "Denotatif",
            meaning: "Rasa sejuk basah yang menempel di kulit atau dinding batu.",
            usageHint: "Gambarkan saat tokoh menyentuh pintu atau pusaka basah.",
          },
        ]
      : isSky
        ? [
            {
              word: "Kabut keperakan",
              sense: "Penglihatan",
              type: "Denotatif",
              meaning: "Gumpalan awan tipis yang berkilau putih seperti perak.",
              usageHint: "Gunakan saat tokoh memandang batas negeri di ketinggian.",
            },
            {
              word: "Gemerlap bintang",
              sense: "Penglihatan",
              type: "Denotatif",
              meaning: "Banyak titik cahaya terang yang berkedip di angkasa.",
              usageHint: "Cocok untuk adegan pembuka atau saat keajaiban aktif.",
            },
            {
              word: "Desir angin ketinggian",
              sense: "Pendengaran",
              type: "Denotatif",
              meaning: "Bunyi angin kencang yang menyapu jubah atau menara.",
              usageHint: "Hidupkan suasana saat tokoh meniti jembatan tinggi.",
            },
            {
              word: "Peluit angin melengking",
              sense: "Pendengaran",
              type: "Denotatif",
              meaning: "Suara tinggi tajam yang menandakan badai mulai datang.",
              usageHint: "Pas dipakai di awal paragraf Komplikasi.",
            },
            {
              word: "Hawa menusuk",
              sense: "Aroma / Sentuhan",
              type: "Konotatif",
              meaning: "Udara amat dingin yang terasa tajam menyentuh kulit.",
              usageHint: "Perlihatkan reaksi tokoh yang menggigil saat menghadapi ujian.",
            },
            {
              word: "Embun sejuk",
              sense: "Aroma / Sentuhan",
              type: "Denotatif",
              meaning: "Butiran air halus dari awan yang membasahi ujung jari.",
              usageHint: "Cocok untuk ketenangan di paragraf Resolusi.",
            },
          ]
        : isTech
          ? [
              {
                word: "Kilau kuningan temaram",
                sense: "Penglihatan",
                type: "Denotatif",
                meaning: "Pantulan redup logam keemasan di dalam ruangan remang.",
                usageHint: "Gambarkan roda gigi, jam, atau mesin ajaib milik tokoh.",
              },
              {
                word: "Percikan cahaya biru",
                sense: "Penglihatan",
                type: "Denotatif",
                meaning: "Kilatan listrik atau energi kecil yang menyala sesaat.",
                usageHint: "Munculkan ketika aturan keajaiban mulai bereaksi.",
              },
              {
                word: "Detak roda gigi menggema",
                sense: "Pendengaran",
                type: "Denotatif",
                meaning: "Bunyi berirama logam berputar yang memantul di dinding.",
                usageHint: "Pakai untuk membangun rasa dikejar waktu di Klimaks.",
              },
              {
                word: "Derit besi tua",
                sense: "Pendengaran",
                type: "Denotatif",
                meaning: "Bunyi tajam dari engsel pintu atau mesin yang lama tak bergerak.",
                usageHint: "Tanda munculnya ruangan rahasia atau tokoh lawan.",
              },
              {
                word: "Aroma logam hangat",
                sense: "Aroma / Sentuhan",
                type: "Denotatif",
                meaning: "Bau khas mesin atau besi yang baru bekerja keras.",
                usageHint: "Sentuhan nyata saat benda ajaib sedang aktif.",
              },
              {
                word: "Getaran lantai batu",
                sense: "Aroma / Sentuhan",
                type: "Denotatif",
                meaning: "Guncangan halus yang terasa langsung di telapak kaki.",
                usageHint: "Tunjukkan bahaya yang mendekat sebelum lawan terlihat.",
              },
            ]
          : [
              {
                word: "Berpendar keemasan",
                sense: "Penglihatan",
                type: "Denotatif",
                meaning: "Memancarkan sinar emas lembut di tengah ruang gelap.",
                usageHint: "Cocok untuk menandai munculnya benda atau pintu ajaib.",
              },
              {
                word: "Kabut pekat",
                sense: "Penglihatan",
                type: "Konotatif",
                meaning: "Asap atau kabut tebal yang menutup pandangan tokoh.",
                usageHint: "Gunakan untuk membangun rasa penasaran di Komplikasi.",
              },
              {
                word: "Gemerisik misterius",
                sense: "Pendengaran",
                type: "Denotatif",
                meaning: "Bunyi gesekan pelan yang membuat tokoh waspada.",
                usageHint: "Tanda awal kehadiran tokoh lawan atau makhluk ajaib.",
              },
              {
                word: "Dentuman berat",
                sense: "Pendengaran",
                type: "Denotatif",
                meaning: "Suara keras bergetar yang mengagetkan di puncak masalah.",
                usageHint: "Bangun ketegangan tepat sebelum dialog puncak.",
              },
              {
                word: "Harum semerbak",
                sense: "Aroma / Sentuhan",
                type: "Denotatif",
                meaning: "Wangi kuat yang langsung memenuhi ruangan sekitar.",
                usageHint: "Bisa menandakan keajaiban positif atau suasana damai.",
              },
              {
                word: "Dingin membeku",
                sense: "Aroma / Sentuhan",
                type: "Konotatif",
                meaning: "Rasa amat dingin atau kaget hingga tubuh sulit bergerak.",
                usageHint: "Perlihatkan ketegangan tokoh tanpa cuma menulis 'ia takut'.",
              },
            ];

    const protag = req.protagonistName || "[Nama Tokohmu]";
    return {
      ...base,
      mode: "theme_lexicon",
      data: {
        sensoryWords,
        majasFrames: [
          {
            connector: "bagaikan",
            frameWithBlank: `${protag} melangkah menembus suasana ${req.theme} bagaikan [tulis pembanding visual versimu].`,
            whyItFits: "Menghidupkan gambaran tempat dan gerak tokoh secara konkret.",
          },
          {
            connector: "laksana",
            frameWithBlank: `Benda ajaib di ceritamu memancarkan sinar laksana [tulis benda bercahaya khas temamu].`,
            whyItFits: "Memperkuat momen munculnya keajaiban pada Awal atau Klimaks.",
          },
          {
            connector: "seperti",
            frameWithBlank: `Saat masalah memuncak, ${protag} bertindak cepat seperti [tulis hal yang gesit/berani].`,
            whyItFits: "Membuat adegan Klimaks terasa lebih seru dan berirama.",
          },
        ],
        imaginationQuestions: [
          `Di dunia "${req.theme}", bunyi atau bau unik apa yang pertama kali membuat tokohmu sadar ia tidak lagi berada di tempat biasa?`,
          `Jika tokohmu melanggar aturan keajaiban di dunia "${req.theme}", akibat menegangkan apa yang langsung terjadi di hadapannya?`,
        ],
      },
    };
  }

  if (req.mode === "logic_check") {
    const bodyText = `${req.paragraphKomplikasi} ${req.paragraphKlimaks} ${req.paragraphResolusi}`.trim();
    const hasEndingContent =
      req.paragraphKlimaks.trim().length >= 30 && req.paragraphResolusi.trim().length >= 30;
    const ruleKeywords = req.worldRule
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .slice(0, 6);
    const matchedRuleConcepts = ruleKeywords.filter((w) =>
      bodyText.toLowerCase().includes(w)
    );

    const status: LogicCheckPayload["consistencyStatus"] = !hasEndingContent
      ? "perlu_diperkuat"
      : matchedRuleConcepts.length >= 1
        ? "konsisten"
        : "perlu_diperkuat";

    return {
      ...base,
      mode: "logic_check",
      data: {
        consistencyStatus: status,
        summary: !hasEndingContent
          ? "Paragraf Puncak (Klimaks) dan Akhir (Resolusi) masih terlalu singkat untuk menguji apakah penyelesaianmu mematuhi Aturan Keajaiban."
          : matchedRuleConcepts.length >= 1
            ? "Kata kunci dari Aturan Keajaibanmu sudah mulai tampak di bagian Puncak/Akhir. Pastikan cara tokohmu menang benar-benar mengikuti syarat aturan itu."
            : "Aturan Keajaiban yang kamu buat di Lembar 1 belum terlihat jelas pengaruhnya di bagian Puncak atau Akhir cerita.",
        strengths: [
          `Kamu sudah merumuskan Aturan Keajaiban secara jelas: "${req.worldRule.slice(0, 95)}".`,
        ],
        guidingQuestions: [
          "Di bagian Puncak Masalah (Paragraf 3), syarat atau risiko apa dari Aturan Keajaibanmu yang sempat membuat tokoh utama kesulitan?",
          "Bagaimana tokohmu akhirnya menyelesaikan masalah TANPA melanggar aturan yang sudah kamu buat sendiri di Lembar 1?",
        ],
      },
    };
  }

  const hasAllParts =
    req.paragraphOrientasi.trim().length >= 35 &&
    req.paragraphKomplikasi.trim().length >= 25 &&
    req.paragraphKlimaks.trim().length >= 30 &&
    req.paragraphResolusi.trim().length >= 35;

  return {
    ...base,
    mode: "socratic_review",
    data: {
      appreciations: [
        req.storyTitle
          ? `Judul "${req.storyTitle}" sudah memberi gambaran awal yang menarik bagi pembaca.`
          : "Kamu sudah mulai menuangkan ide cerita fantasimu ke halaman Studio Tulis.",
        hasAllParts
          ? "Keempat bagian utama cerita (Awal, Masalah, Puncak, Akhir) sudah mulai terbentuk berurutan."
          : "Fondasi ceritamu sudah mulai tampak dan siap dikembangkan menjadi kisah yang utuh.",
      ],
      guidingQuestions: [
        "Coba baca lagi bagian Awal dan Puncak: apakah pembaca sudah bisa membayangkan warna cahaya, bunyi, atau suhu tempat ceritamu?",
        "Apakah sifat baik tokoh utamamu sudah ditunjukkan lewat perbuatan dan ucapannya, bukan sekadar disebut 'ia anak baik'?",
        "Apakah pesan kebaikan (amanat) di akhir cerita terasa nyambung dengan perubahan sikap tokohmu setelah melewati puncak masalah?",
      ],
      nextMiniChallenge:
        "Tantangan mini: pilih satu kalimat yang masih terasa datar di Paragraf 2 atau 3, lalu tambahkan satu detail suara atau perumpamaan (seperti/bagaikan)!",
    },
  };
}

// ============================================================================
// MAIN ORCHESTRATOR: GROQ PRIMARY -> GEMINI FALLBACK -> OFFLINE LAYER 1
// ============================================================================

export interface CoachRuntimeOptions {
  readonly fetchFn?: FetchLike;
  readonly envOverride?: {
    readonly GROQ_API_KEY?: string;
    readonly GROQ_MODEL?: string;
    readonly GEMINI_API_KEY?: string;
    readonly GEMINI_MODEL?: string;
  };
}

export async function runSocraticCoach(
  req: CoachRequest,
  options?: CoachRuntimeOptions
): Promise<CoachSuccessResponse> {
  const fetchFn = options?.fetchFn ?? fetch;
  const env = options?.envOverride ?? getServerEnv();
  const groqKey = env.GROQ_API_KEY?.trim();
  const groqModel = env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const geminiModel = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  const userPrompt = buildUserPrompt(req);
  let groqFailed = false;

  // 1. Primary Provider: Groq
  if (groqKey) {
    try {
      const rawJson = await callGroqJson(groqKey, groqModel, userPrompt, fetchFn);
      const data = validateAndSanitizePayload(req.mode, rawJson);
      return buildSuccessResponse(req.mode, data, {
        provider: "groq",
        model: groqModel,
        fallbackUsed: false,
        verificationStatus: "model_suggestion",
        disclaimer: MODEL_DISCLAIMER,
      });
    } catch {
      groqFailed = true;
    }
  }

  // 2. Secondary Provider Fallback: Google Gemini
  if (geminiKey) {
    try {
      const { json: rawJson, usedModel } = await callGeminiJson(
        geminiKey,
        geminiModel,
        userPrompt,
        fetchFn
      );
      const data = validateAndSanitizePayload(req.mode, rawJson);
      return buildSuccessResponse(req.mode, data, {
        provider: "gemini",
        model: usedModel,
        fallbackUsed: groqFailed,
        fallbackNotice: groqFailed
          ? "Kuota/koneksi Groq sedang sibuk; otomatis beralih ke cadangan Gemini."
          : undefined,
        verificationStatus: "model_suggestion",
        disclaimer: MODEL_DISCLAIMER,
      });
    } catch {
      // Fall through cleanly to Offline Layer 1
    }
  }

  // 3. Tertiary Fallback: Guaranteed Offline Curated Engine (Never Fails Student UX)
  const notice =
    groqKey || geminiKey
      ? "Layanan AI (Groq & Gemini) sedang sibuk atau luring; otomatis memakai Bank Kurasi Luring E-Aksaraloka."
      : "Kunci API AI belum aktif; otomatis memakai Bank Kurasi Luring E-Aksaraloka.";
  return buildOfflineCoachFallback(req, notice);
}

function buildSuccessResponse(
  mode: CoachRequest["mode"],
  data: ThemeLexiconPayload | LogicCheckPayload | SocraticReviewPayload,
  meta: Omit<CoachSuccessResponse, "mode" | "data">
): CoachSuccessResponse {
  if (mode === "theme_lexicon") {
    return { ...meta, mode, data: data as ThemeLexiconPayload };
  }
  if (mode === "logic_check") {
    return { ...meta, mode, data: data as LogicCheckPayload };
  }
  return { ...meta, mode, data: data as SocraticReviewPayload };
}
