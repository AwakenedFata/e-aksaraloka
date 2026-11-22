"use client";

import { useState } from "react";
import type { StudioDraftData } from "@/lib/learning/literaryDetector";
import type { CoachSuccessResponse } from "@/lib/ai/coachSchemas";
import { playChime, playErrorTone } from "@/lib/learning/audioEngine";

type LogicCheckResponse = Extract<CoachSuccessResponse, { mode: "logic_check" }>;
type SocraticReviewResponse = Extract<CoachSuccessResponse, { mode: "socratic_review" }>;

interface StudioAiSocraticPanelProps {
  readonly draft: StudioDraftData;
  readonly totalWords: number;
}

function providerTag(provider: CoachSuccessResponse["provider"], model: string): string {
  if (provider === "groq") return `Groq AI (${model}) · model_suggestion`;
  if (provider === "gemini") return `Gemini Cadangan (${model}) · model_suggestion`;
  return "Bank Kurasi Luring · curated_offline";
}

export function StudioAiSocraticPanel({
  draft,
  totalWords,
}: StudioAiSocraticPanelProps) {
  const [logicResult, setLogicResult] = useState<LogicCheckResponse | null>(null);
  const [reviewResult, setReviewResult] = useState<SocraticReviewResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<"logic_check" | "socratic_review" | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunLogicCheck = async () => {
    if (draft.worldRule.trim().length < 8) {
      playErrorTone();
      setErrorMsg(
        "Isi dulu Aturan Benda/Kekuatan Ajaib di Lembar 1 (min. 8 huruf) sebelum menguji kelogisan cerita."
      );
      return;
    }
    if (totalWords < 12) {
      playErrorTone();
      setErrorMsg("Tulis dulu minimal beberapa kalimat cerita di Lembar 2 & 3 sebelum diuji!");
      return;
    }

    playChime();
    setLoadingMode("logic_check");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "logic_check",
          theme: draft.themeCategory.trim(),
          worldRule: draft.worldRule.trim(),
          paragraphOrientasi: draft.paragraphOrientasi,
          paragraphKomplikasi: draft.paragraphKomplikasi ?? "",
          paragraphKlimaks: draft.paragraphKlimaks,
          paragraphResolusi: draft.paragraphResolusi,
        }),
      });

      const payload = (await res.json()) as
        | LogicCheckResponse
        | { readonly error?: string };
      if (!res.ok || !("mode" in payload) || payload.mode !== "logic_check") {
        setErrorMsg(
          "error" in payload && payload.error
            ? payload.error
            : "Gagal memeriksa logika aturan dunia."
        );
        playErrorTone();
        return;
      }
      setLogicResult(payload);
    } catch {
      playErrorTone();
      setErrorMsg(
        "Perangkat sedang luring. Periksa manual lewat Ceklis #2: apakah penyelesaian tokoh mematuhi Aturan Keajaiban di Lembar 1?"
      );
    } finally {
      setLoadingMode(null);
    }
  };

  const handleRunSocraticReview = async () => {
    if (totalWords < 15) {
      playErrorTone();
      setErrorMsg("Tulis dulu minimal 15 kata cerita agar Pelatih Revisi dapat memberi pertanyaan yang tepat!");
      return;
    }

    playChime();
    setLoadingMode("socratic_review");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "socratic_review",
          theme: draft.themeCategory.trim(),
          worldRule: draft.worldRule.trim(),
          storyTitle: draft.storyTitle.trim(),
          paragraphOrientasi: draft.paragraphOrientasi,
          paragraphKomplikasi: draft.paragraphKomplikasi ?? "",
          paragraphKlimaks: draft.paragraphKlimaks,
          paragraphResolusi: draft.paragraphResolusi,
          amanat: draft.amanat.trim(),
        }),
      });

      const payload = (await res.json()) as
        | SocraticReviewResponse
        | { readonly error?: string };
      if (!res.ok || !("mode" in payload) || payload.mode !== "socratic_review") {
        setErrorMsg(
          "error" in payload && payload.error
            ? payload.error
            : "Gagal memuat pertanyaan revisi."
        );
        playErrorTone();
        return;
      }
      setReviewResult(payload);
    } catch {
      playErrorTone();
      setErrorMsg(
        "Perangkat sedang luring. Gunakan 5 indikator di atas dan 5 ceklis di halaman kanan untuk merevisi naskahmu!"
      );
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="mt-2.5 border-t border-[#5c3d1e]/45 pt-2 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-brand text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#3d250b]">
          Pelatih Sokratik AI (Groq · Cadangan Gemini)
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={loadingMode !== null}
            onClick={handleRunLogicCheck}
            className="rounded-full border border-[#5c3d1e]/75 bg-[#3d250b]/12 hover:bg-[#3d250b]/22 disabled:opacity-50 px-2 py-0.5 text-[9.5px] font-bold text-[#3d250b] transition-colors cursor-pointer"
          >
            {loadingMode === "logic_check"
              ? "Menguji Logika..."
              : "Uji Logika Aturan Dunia"}
          </button>
          <button
            type="button"
            disabled={loadingMode !== null}
            onClick={handleRunSocraticReview}
            className="rounded-full border border-[#14532d]/75 bg-[#14532d]/12 hover:bg-[#14532d]/22 disabled:opacity-50 px-2 py-0.5 text-[9.5px] font-bold text-[#14532d] transition-colors cursor-pointer"
          >
            {loadingMode === "socratic_review"
              ? "Menyiapkan Pertanyaan..."
              : "Tanya Pelatih Revisi"}
          </button>
        </div>
      </div>

      <p className="text-[9.5px] italic text-[#5c3d1e]">
        Saran pemantik AI Sokratik (tidak menulis ulang ceritamu &amp; bukan otoritas resmi KBBI/EYD V).
      </p>

      {errorMsg && (
        <p className="rounded border border-[#7f1d1d]/50 bg-[#7f1d1d]/10 px-2 py-1 text-[10px] font-semibold text-[#7f1d1d]">
          {errorMsg}
        </p>
      )}

      {logicResult && (
        <div className="rounded border border-[#5c3d1e]/40 bg-[#5c3d1e]/8 p-2 space-y-1 text-[10px] text-[#241407]">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <strong
              className={
                logicResult.data.consistencyStatus === "konsisten"
                  ? "text-[#14532d]"
                  : logicResult.data.consistencyStatus === "terindikasi_melanggar"
                    ? "text-[#7f1d1d]"
                    : "text-[#7c2d12]"
              }
            >
              Uji Logika:{" "}
              {logicResult.data.consistencyStatus === "konsisten"
                ? "Konsisten dengan Aturan ✓"
                : logicResult.data.consistencyStatus === "terindikasi_melanggar"
                  ? "Indikasi Melanggar Aturan!"
                  : "Perlu Diperkuat"}
            </strong>
            <span className="text-[8.5px] font-semibold text-[#5c3d1e]">
              {providerTag(logicResult.provider, logicResult.model)}
            </span>
          </div>
          {logicResult.fallbackNotice && (
            <p className="text-[9px] italic text-[#7c2d12]">{logicResult.fallbackNotice}</p>
          )}
          <p className="leading-snug">{logicResult.data.summary}</p>
          <div className="space-y-0.5 pt-0.5">
            <span className="font-bold text-[#3d250b]">Pertanyaan Penuntun:</span>
            {logicResult.data.guidingQuestions.map((q, idx) => (
              <p key={idx} className="leading-snug pl-2">
                {idx + 1}. {q}
              </p>
            ))}
          </div>
        </div>
      )}

      {reviewResult && (
        <div className="rounded border border-[#14532d]/40 bg-[#14532d]/8 p-2 space-y-1 text-[10px] text-[#1e1106]">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <strong className="text-[#14532d]">Catatan Pelatih Revisi (TP 5)</strong>
            <span className="text-[8.5px] font-semibold text-[#5c3d1e]">
              {providerTag(reviewResult.provider, reviewResult.model)}
            </span>
          </div>
          {reviewResult.fallbackNotice && (
            <p className="text-[9px] italic text-[#7c2d12]">{reviewResult.fallbackNotice}</p>
          )}
          <div className="space-y-0.5">
            <span className="font-bold text-[#14532d]">Yang Sudah Bagus:</span>
            {reviewResult.data.appreciations.map((a, idx) => (
              <p key={idx} className="leading-snug pl-2">
                • {a}
              </p>
            ))}
          </div>
          <div className="space-y-0.5 pt-0.5">
            <span className="font-bold text-[#3d250b]">Pertanyaan untuk Revisi Mandiri:</span>
            {reviewResult.data.guidingQuestions.map((q, idx) => (
              <p key={idx} className="leading-snug pl-2">
                {idx + 1}. {q}
              </p>
            ))}
          </div>
          <p className="pt-0.5 font-semibold text-[#7c2d12]">
            Tantangan Mini: {reviewResult.data.nextMiniChallenge}
          </p>
        </div>
      )}
    </div>
  );
}
