"use client";

import { useState } from "react";
import {
  FANTASY_LEXICON_BANK,
  type GrimoireChapterId,
} from "@/lib/learning/narrativeCurriculumData";
import {
  STORY_SEED_PRESETS,
  type StudioDraftData,
} from "@/lib/learning/literaryDetector";
import {
  rollFantasyIdeaRecipe,
  type FantasyIdeaRecipe,
} from "@/lib/learning/creativeScaffolding";
import type { CoachSuccessResponse } from "@/lib/ai/coachSchemas";
import { playChime, playErrorTone } from "@/lib/learning/audioEngine";

type ToolkitTab = "ide_ramuan" | "kamus_kata" | "pemantik_ai" | "segel";
type MeaningFilter = "Semua" | "Denotatif" | "Konotatif" | "Kiasan / Majas";

interface SealBadgeItem {
  readonly id: GrimoireChapterId;
  readonly label: string;
}

export type TargetParagraphKey =
  | "orientasi"
  | "komplikasi"
  | "klimaks"
  | "resolusi";

interface StudioHybridToolkitDrawerProps {
  readonly draft: StudioDraftData;
  readonly defaultInsertTarget: TargetParagraphKey;
  readonly sealBadges: readonly SealBadgeItem[];
  readonly isSealUnlockedForId: (id: GrimoireChapterId) => boolean;
  readonly onClose: () => void;
  readonly onJumpToKitabChapter: (chapter: GrimoireChapterId) => void;
  readonly onApplySeedOutline: (seedId: string, title: string) => void;
  readonly onApplySeedFullModel: (seedId: string, title: string) => void;
  readonly onApplyIdeaRecipe: (recipe: FantasyIdeaRecipe) => void;
  readonly onInsertWord: (word: string, target: TargetParagraphKey) => void;
  readonly onInsertMajasFrame: (frameText: string) => void;
  readonly onUpdateThemeCategory: (theme: string) => void;
}

type ThemeLexiconResponse = Extract<CoachSuccessResponse, { mode: "theme_lexicon" }>;

function formatProviderBadge(res: ThemeLexiconResponse): {
  readonly label: string;
  readonly className: string;
} {
  if (res.provider === "groq") {
    return {
      label: "Pemantik AI Aktif · Saran Kreatif",
      className: "border-emerald-400/50 bg-emerald-950/60 text-emerald-200",
    };
  }
  if (res.provider === "gemini") {
    return {
      label: "Pemantik AI Aktif (Cadangan) · Saran Kreatif",
      className: "border-sky-400/50 bg-sky-950/60 text-sky-200",
    };
  }
  return {
    label: "Bank Kata Pustaka · Mode Luring",
    className: "border-amber-400/50 bg-amber-950/60 text-amber-200",
  };
}

export function StudioHybridToolkitDrawer({
  draft,
  defaultInsertTarget,
  sealBadges,
  isSealUnlockedForId,
  onClose,
  onJumpToKitabChapter,
  onApplySeedOutline,
  onApplySeedFullModel,
  onApplyIdeaRecipe,
  onInsertWord,
  onInsertMajasFrame,
  onUpdateThemeCategory,
}: StudioHybridToolkitDrawerProps) {
  const [activeTab, setActiveTab] = useState<ToolkitTab>("ide_ramuan");
  const [insertTarget, setInsertTarget] =
    useState<TargetParagraphKey>(defaultInsertTarget);
  const [recipeSeedCounter, setRecipeSeedCounter] = useState<number>(1);
  const [ideaRecipe, setIdeaRecipe] = useState<FantasyIdeaRecipe>(() =>
    rollFantasyIdeaRecipe(1)
  );
  const [selectedLexiconCatId, setSelectedLexiconCatId] = useState<string>(
    FANTASY_LEXICON_BANK[0]?.id ?? "lex-cahaya"
  );
  const [meaningFilter, setMeaningFilter] = useState<MeaningFilter>("Semua");
  const [aiResult, setAiResult] = useState<ThemeLexiconResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const selectedCategory =
    FANTASY_LEXICON_BANK.find((c) => c.id === selectedLexiconCatId) ??
    FANTASY_LEXICON_BANK[0]!;

  const filteredLexiconEntries = selectedCategory.entries.filter(
    (entry) => meaningFilter === "Semua" || entry.type === meaningFilter
  );

  const handleRollNewIdea = () => {
    playChime();
    const nextSeed = recipeSeedCounter + 1;
    setRecipeSeedCounter(nextSeed);
    setIdeaRecipe(rollFantasyIdeaRecipe(nextSeed + Math.floor(Math.random() * 97)));
  };

  const handleFetchThemeBoost = async () => {
    const cleanTheme = draft.themeCategory.trim();
    if (cleanTheme.length < 2) {
      playErrorTone();
      setAiError("Tulis dulu tema fantasimu (minimal 2 huruf) sebelum meminta pemantik!");
      return;
    }

    playChime();
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "theme_lexicon",
          theme: cleanTheme,
          settingPlace: draft.settingPlace.trim(),
          worldRule: draft.worldRule.trim(),
          protagonistName: draft.protagonistName.trim(),
        }),
      });

      const payload = (await response.json()) as
        | ThemeLexiconResponse
        | { readonly error?: string };

      if (!response.ok || !("mode" in payload) || payload.mode !== "theme_lexicon") {
        const msg =
          "error" in payload && payload.error
            ? payload.error
            : "Gagal memuat pemantik tema. Silakan gunakan tab Kamus 48 Kata (luring).";
        setAiError(msg);
        playErrorTone();
        return;
      }

      setAiResult(payload);
    } catch {
      playErrorTone();
      setAiError(
        "Koneksi terputus (mode luring). Kamu tetap bisa memakai 48 kata terkurasi di tab '2. Kamus 48 Kata' dan '1. Ide & Ramuan'!"
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      data-lenis-prevent
      className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[76dvh] overflow-y-auto overscroll-contain rounded-2xl border border-[#cda250]/55 bg-[#070d1d]/98 p-3 pb-5 shadow-2xl space-y-2.5 text-stone-200"
    >
      {/* Top Bar: Responsive 2x2 Tab Grid on Mobile, Inline Tabs + Close on Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#cda250]/25 pb-2">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
          {(
            [
              { id: "ide_ramuan", label: "1. Ide & Ramuan" },
              { id: "kamus_kata", label: "2. Kamus 48 Kata" },
              { id: "pemantik_ai", label: "3. Bantu Tema AI" },
              { id: "segel", label: "4. 3 Segel Materi" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playChime();
                setActiveTab(tab.id);
              }}
              className={`min-h-[32px] sm:min-h-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer text-center ${
                activeTab === tab.id
                  ? "bg-[#f4d993] text-slate-950"
                  : "border border-[#cda250]/35 bg-white/5 text-amber-100 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="hidden sm:inline-block shrink-0 text-[10.5px] font-bold uppercase text-[#f4d993] hover:text-white cursor-pointer"
        >
          [ X ] Tutup
        </button>
      </div>

      {/* TAB 1: MESIN ACAK RAMUAN IDE + 3 CONTOH CERITA */}
      {activeTab === "ide_ramuan" && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/35 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-brand text-[10px] font-bold tracking-wider uppercase text-emerald-300">
                  MESIN ACAK RAMUAN IDE ORISINAL (100% LURING)
                </span>
                <p className="text-[11px] text-stone-300">
                  Acak gabungan Tokoh + Benda Ajaib + Dunia + Pantangan untuk memantik tema orisinalmu!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRollNewIdea}
                  className="rounded-lg border border-[#f4d993]/60 bg-[#cda250]/20 hover:bg-[#cda250]/35 px-2.5 py-1 text-[10.5px] font-bold text-[#f4d993] cursor-pointer"
                >
                  Acak Ramuan Baru
                </button>
                <button
                  type="button"
                  onClick={() => onApplyIdeaRecipe(ideaRecipe)}
                  className="rounded-lg border border-emerald-400/65 bg-emerald-500/25 hover:bg-emerald-500/35 px-2.5 py-1 text-[10.5px] font-bold text-emerald-100 cursor-pointer"
                >
                  Pakai ke Lembar 1 -&gt;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1.5 text-[10.5px]">
              <div className="rounded-lg border border-white/10 bg-black/45 p-2">
                <span className="block text-[9.5px] font-bold uppercase text-[#f4d993]">
                  Tema &amp; Dunia
                </span>
                <p className="mt-0.5 font-semibold text-white">{ideaRecipe.themeLabel}</p>
                <p className="text-[10px] text-stone-400">{ideaRecipe.settingPlace}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 p-2">
                <span className="block text-[9.5px] font-bold uppercase text-emerald-300">
                  Tokoh Utama
                </span>
                <p className="mt-0.5 font-semibold text-white">
                  {ideaRecipe.protagonistName} ({ideaRecipe.protagonistRole})
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 p-2">
                <span className="block text-[9.5px] font-bold uppercase text-sky-300">
                  Benda Ajaib
                </span>
                <p className="mt-0.5 text-stone-200">{ideaRecipe.magicArtifact}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 p-2">
                <span className="block text-[9.5px] font-bold uppercase text-amber-300">
                  Aturan / Pantangan
                </span>
                <p className="mt-0.5 text-stone-200">{ideaRecipe.worldRule}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 p-2">
                <span className="block text-[9.5px] font-bold uppercase text-rose-300">
                  Tokoh Lawan
                </span>
                <p className="mt-0.5 font-semibold text-white">{ideaRecipe.antagonistName}</p>
                <p className="text-[10px] text-stone-300">{ideaRecipe.antagonistConflictTrigger}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {STORY_SEED_PRESETS.map((seed, idx) => (
              <div
                key={seed.id}
                className="flex flex-col justify-between rounded-xl border border-[#cda250]/35 bg-black/60 p-2.5 space-y-2"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#f4d993]">
                    Contoh Kurikulum {idx + 1}: {seed.title}
                  </span>
                  <p className="mt-0.5 text-[11px] text-stone-300 leading-snug">
                    {seed.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onApplySeedOutline(seed.id, seed.title)}
                    className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-1 text-[10px] font-bold text-emerald-200 cursor-pointer"
                  >
                    Pakai Rencana Ide Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplySeedFullModel(seed.id, seed.title)}
                    className="rounded-lg border border-[#cda250]/40 bg-white/5 hover:bg-white/10 px-2 py-1 text-[10px] font-semibold text-[#f4d993] cursor-pointer"
                  >
                    Lihat Contoh Ceritanya
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: KAMUS 48 KATA FANTASI (OFFLINE CURATED + TARGET PARAGRAPH SELECTOR) */}
      {activeTab === "kamus_kata" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-amber-200">
              Masukkan kata ke bagian:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: "orientasi", label: "1. Awal" },
                  { id: "komplikasi", label: "2. Masalah" },
                  { id: "klimaks", label: "3. Puncak" },
                  { id: "resolusi", label: "4. Akhir" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    playChime();
                    setInsertTarget(t.id);
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                    insertTarget === t.id
                      ? "bg-[#f4d993] text-slate-950"
                      : "border border-white/15 bg-white/5 text-stone-300 hover:border-[#f4d993]/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {FANTASY_LEXICON_BANK.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    playChime();
                    setSelectedLexiconCatId(cat.id);
                  }}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
                    selectedCategory.id === cat.id
                      ? "bg-[#f4d993] text-slate-950"
                      : "border border-white/15 bg-white/5 text-stone-200 hover:border-[#f4d993]/50"
                  }`}
                >
                  {cat.category}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(["Semua", "Denotatif", "Konotatif", "Kiasan / Majas"] as const).map((mf) => (
                <button
                  key={mf}
                  type="button"
                  onClick={() => {
                    playChime();
                    setMeaningFilter(mf);
                  }}
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold cursor-pointer ${
                    meaningFilter === mf
                      ? "bg-emerald-400 text-slate-950"
                      : "border border-white/15 bg-white/5 text-stone-300"
                  }`}
                >
                  {mf}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {filteredLexiconEntries.map((entry) => (
              <div
                key={entry.word}
                className="flex flex-col justify-between rounded-xl border border-white/12 bg-black/55 p-2 space-y-1.5 text-[10.5px]"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <strong className="text-white">{entry.word}</strong>
                    <span className="rounded bg-[#cda250]/20 px-1.5 py-0.5 text-[9px] text-[#f4d993] shrink-0">
                      {entry.type}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-snug">{entry.meaning}</p>
                  <p className="text-[10px] text-amber-200/80 italic leading-snug">
                    &ldquo;{entry.example}&rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onInsertWord(entry.word, insertTarget)}
                  className="w-full rounded-lg border border-emerald-400/45 bg-emerald-950/60 hover:bg-emerald-900/70 py-1 text-[10px] font-bold text-emerald-200 cursor-pointer"
                >
                  + Sisipkan Kata
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BANTU TEMA AI (RAMAH SISWA KELAS 7 SMP, TANPA JARGON TEKNIS) */}
      {activeTab === "pemantik_ai" && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-[#cda250]/40 bg-black/55 p-2.5 space-y-2">
            <div className="space-y-0.5">
              <span className="block font-brand text-[11px] font-bold tracking-wide text-[#f4d993]">
                Cari Kata &amp; Perumpamaan untuk Temamu!
              </span>
              <p className="text-[11px] text-stone-300 leading-snug">
                Tulis tema fantasimu sendiri (misalnya: <em>Kerajaan Awan</em> atau <em>Kota Bawah Laut</em>). Asisten AI akan memberi 6 kata panca indera dan 3 kerangka kalimat rumpang [...] untuk kamu lengkapi sendiri!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                aria-label="Tema fantasi orisinal untuk pemantik AI"
                value={draft.themeCategory}
                onChange={(e) => onUpdateThemeCategory(e.target.value)}
                placeholder="Tulis tema ceritamu, mis. Kerajaan Kucing atau Kota Awan..."
                className="flex-1 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
              />
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleFetchThemeBoost}
                className="min-h-[36px] rounded-lg bg-[#cda250] hover:bg-[#f4d993] disabled:opacity-50 px-3.5 py-1.5 text-[11px] font-brand font-bold uppercase tracking-wider text-slate-950 cursor-pointer shrink-0"
              >
                {aiLoading ? "Mencari Kata..." : "Cari Kata & Perumpamaan ->"}
              </button>
            </div>

            {aiError && (
              <p className="rounded-lg border border-rose-400/45 bg-rose-950/60 px-2.5 py-1.5 text-[11px] text-rose-200">
                {aiError}
              </p>
            )}
          </div>

          {aiResult && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span
                  title={`Sumber: ${aiResult.provider} (${aiResult.model})`}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                    formatProviderBadge(aiResult).className
                  }`}
                >
                  {formatProviderBadge(aiResult).label}
                </span>
                <span className="text-[10px] text-stone-400">{aiResult.disclaimer}</span>
              </div>

              {aiResult.fallbackNotice && (
                <p className="rounded-lg border border-amber-400/40 bg-amber-950/45 px-2.5 py-1.5 text-[10.5px] text-amber-200 leading-snug">
                  {aiResult.fallbackNotice}
                </p>
              )}

              {/* Target Paragraph Selector for AI Sensory Words */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-amber-200">
                  Masukkan kata ke bagian:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: "orientasi", label: "1. Awal" },
                      { id: "komplikasi", label: "2. Masalah" },
                      { id: "klimaks", label: "3. Puncak" },
                      { id: "resolusi", label: "4. Akhir" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        playChime();
                        setInsertTarget(t.id);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                        insertTarget === t.id
                          ? "bg-[#f4d993] text-slate-950"
                          : "border border-white/15 bg-white/5 text-stone-300 hover:border-[#f4d993]/50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6 Sensory Words */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {aiResult.data.sensoryWords.map((sw) => (
                  <div
                    key={`${sw.sense}-${sw.word}`}
                    className="flex flex-col justify-between rounded-xl border border-white/12 bg-black/55 p-2 space-y-1 text-[10.5px]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-white">{sw.word}</strong>
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-200 shrink-0">
                          {sw.sense} · {sw.type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-stone-300 leading-snug">{sw.meaning}</p>
                      <p className="mt-0.5 text-[10px] text-amber-200/80 italic leading-snug">
                        {sw.usageHint}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInsertWord(sw.word, insertTarget)}
                      className="w-full rounded-lg border border-emerald-400/45 bg-emerald-950/55 hover:bg-emerald-900/65 py-1 text-[10px] font-bold text-emerald-200 cursor-pointer"
                    >
                      + Sisipkan Kata
                    </button>
                  </div>
                ))}
              </div>

              {/* 3 Anti-Ghostwriting Majas Frames */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {aiResult.data.majasFrames.map((mf, idx) => (
                  <div
                    key={`${mf.connector}-${idx}`}
                    className="flex flex-col justify-between rounded-xl border border-[#cda250]/35 bg-amber-950/20 p-2 space-y-1.5 text-[10.5px]"
                  >
                    <div>
                      <span className="text-[9.5px] font-bold uppercase text-[#f4d993]">
                        Kerangka Majas ({mf.connector})
                      </span>
                      <p className="mt-0.5 text-white font-serif italic leading-snug">
                        {mf.frameWithBlank}
                      </p>
                      <p className="mt-0.5 text-[10px] text-stone-300">{mf.whyItFits}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInsertMajasFrame(mf.frameWithBlank)}
                      className="w-full rounded-lg border border-[#f4d993]/55 bg-[#cda250]/20 hover:bg-[#cda250]/35 py-1 text-[10px] font-bold text-[#f4d993] cursor-pointer"
                    >
                      + Sisipkan Kerangka ke Puncak
                    </button>
                  </div>
                ))}
              </div>

              {/* Imagination Trigger Questions */}
              <div className="rounded-xl border border-sky-400/35 bg-sky-950/25 p-2.5 text-[11px] space-y-1">
                <span className="block text-[9.5px] font-bold uppercase text-sky-300">
                  Pertanyaan Pemantik Imajinasi Temamu:
                </span>
                {aiResult.data.imaginationQuestions.map((q, idx) => (
                  <p key={idx} className="text-stone-200 leading-snug">
                    {idx + 1}. {q}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: 3 SEGEL MATERI */}
      {activeTab === "segel" && (
        <div className="flex flex-wrap items-center gap-2 py-1">
          <span className="font-brand text-[10px] tracking-[0.14em] uppercase text-[#f4d993]">
            Lompat Kembali ke Pustaka Materi:
          </span>
          {sealBadges.map((sb) => {
            const unlocked = isSealUnlockedForId(sb.id);
            return (
              <button
                key={sb.id}
                type="button"
                onClick={() => {
                  playChime();
                  onJumpToKitabChapter(sb.id);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  unlocked
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/45"
                    : "bg-amber-500/15 text-amber-200 border border-amber-400/40 hover:bg-amber-500/25"
                }`}
              >
                {sb.label}: {unlocked ? "Selesai ✓" : "Buka di Pustaka ->"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
