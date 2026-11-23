"use client";

import { useState } from "react";
import {
  saveCurrentManuscriptToPustaka,
  setLastSubmissionMeta,
  updateStudioDraft,
  type AksaralokaLearningState,
  type CompetencyMetrics,
  type SheetSyncStatus,
} from "@/lib/learning/learningStore";
import type { LiteraryAnalysisResult } from "@/lib/learning/literaryDetector";
import {
  playChime,
  playErrorTone,
  playSealUnlock,
} from "@/lib/learning/audioEngine";

interface SubmitToTeacherModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly state: AksaralokaLearningState;
  readonly metrics: CompetencyMetrics;
  readonly analysis: LiteraryAnalysisResult;
  readonly onSubmitted?: (message: string) => void;
}

interface SubmitSuccessState {
  readonly submissionId: string;
  readonly version: number;
  readonly classCode: string;
  readonly submittedAtIso: string;
  readonly storedInDatabase: boolean;
  readonly sheetSyncStatus: SheetSyncStatus;
  readonly sheetLastError: string | null;
  readonly holisticTotalPercentage: number;
  readonly studioScore: number;
  readonly authenticityLabel: string;
}

const CLIENT_SESSION_KEY = "aksaraloka:client-session-id:v1";

function getOrCreateClientSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_SESSION_KEY);
    if (existing) return existing;
    const created = `ses-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    window.localStorage.setItem(CLIENT_SESSION_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function SubmitToTeacherModal({
  isOpen,
  onClose,
  state,
  metrics,
  analysis,
  onSubmitted,
}: SubmitToTeacherModalProps) {
  if (!isOpen) return null;

  return (
    <SubmitToTeacherModalContent
      onClose={onClose}
      state={state}
      metrics={metrics}
      analysis={analysis}
      onSubmitted={onSubmitted}
    />
  );
}

function SubmitToTeacherModalContent({
  onClose,
  state,
  metrics,
  analysis,
  onSubmitted,
}: Omit<SubmitToTeacherModalProps, "isOpen">) {
  const draft = state.studioDraft;

  const [authorName, setAuthorName] = useState(draft.authorName);
  const [authorClass, setAuthorClass] = useState(draft.authorClass || "VII-A");
  const [absenNumber, setAbsenNumber] = useState(draft.authorAbsen ?? "");
  const [classCode, setClassCode] = useState(draft.classCode ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SubmitSuccessState | null>(null);

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanName = authorName.trim();
    const cleanClass = authorClass.trim();
    const cleanAbsen = absenNumber.trim();
    const cleanCode = classCode.trim().toUpperCase();

    if (cleanName.length < 2) {
      playErrorTone();
      setErrorMessage("Isi Nama Lengkapmu terlebih dahulu (minimal 2 huruf).");
      return;
    }
    if (cleanClass.length < 1) {
      playErrorTone();
      setErrorMessage("Isi Kelasmu terlebih dahulu (contoh: VII-A).");
      return;
    }
    if (analysis.totalWords < 10) {
      playErrorTone();
      setErrorMessage(
        "Ceritamu masih terlalu singkat (kurang dari 10 kata). Tulis dulu paragraf ceritamu sebelum dikumpulkan ke guru."
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    // Selaraskan identitas terbaru ke draf lokal & simpan cadangan lokal ke Galeri terlebih dahulu
    updateStudioDraft({
      authorName: cleanName,
      authorClass: cleanClass,
      authorAbsen: cleanAbsen,
      classCode: cleanCode,
    });
    if (!analysis.isModelPresetReference && analysis.totalWords >= 15) {
      saveCurrentManuscriptToPustaka();
    }

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: cleanName,
          authorClass: cleanClass,
          absenNumber: cleanAbsen,
          classCode: cleanCode,
          clientSessionId: getOrCreateClientSessionId(),
          learningState: {
            plotPlacedIds: state.plotPlacedIds,
            climaxSimulationTested: state.climaxSimulationTested,
            selectedAmanatId: state.selectedAmanatId,
            customAmanatReflection: state.customAmanatReflection,
            characterEvidenceAnswers: state.characterEvidenceAnswers,
            pouchOrderIds: state.pouchOrderIds,
            sensoryUpgradeAnswers: state.sensoryUpgradeAnswers,
            majasAnswers: state.majasAnswers,
            dialogueAnswers: state.dialogueAnswers,
            questAnswers: state.questAnswers,
            studioDraft: {
              ...draft,
              authorName: cleanName,
              authorClass: cleanClass,
              authorAbsen: cleanAbsen,
              classCode: cleanCode,
            },
          },
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        submissionId?: string;
        version?: number;
        classCode?: string;
        submittedAtIso?: string;
        storedInDatabase?: boolean;
        sheetSync?: { status?: SheetSyncStatus; lastError?: string | null };
        metrics?: CompetencyMetrics;
        analysisSummary?: { authenticityLabel?: string };
      };

      if (!response.ok || !data.ok || !data.submissionId) {
        playErrorTone();
        setErrorMessage(
          data.error ||
            "Pengumpulan ke server belum berhasil. Karyamu tetap tersimpan aman di Galeri browser ini."
        );
        return;
      }

      const syncStatus: SheetSyncStatus = data.sheetSync?.status ?? "not_configured";
      const result: SubmitSuccessState = {
        submissionId: data.submissionId,
        version: data.version ?? 1,
        classCode: data.classCode ?? (cleanCode || cleanClass),
        submittedAtIso: data.submittedAtIso ?? new Date().toISOString(),
        storedInDatabase: Boolean(data.storedInDatabase),
        sheetSyncStatus: syncStatus,
        sheetLastError: data.sheetSync?.lastError ?? null,
        holisticTotalPercentage:
          data.metrics?.holisticTotalPercentage ?? metrics.holisticTotalPercentage,
        studioScore: data.metrics?.babak4Score ?? analysis.studioScore,
        authenticityLabel: data.analysisSummary?.authenticityLabel ?? "Orisinal",
      };

      setLastSubmissionMeta({
        submissionId: result.submissionId,
        version: result.version,
        submittedAtIso: result.submittedAtIso,
        classCode: result.classCode,
        sheetSyncStatus: result.sheetSyncStatus,
        storedInDatabase: result.storedInDatabase,
      });

      setSuccessResult(result);
      playSealUnlock();
      onSubmitted?.(
        `Karya "${draft.storyTitle.trim() || "Cerita Fantasimu"}" berhasil dikumpulkan ke Guru (ID: ${result.submissionId}, v${result.version}).`
      );
    } catch {
      playErrorTone();
      setErrorMessage(
        "Tidak dapat terhubung ke server. Periksa koneksi internetmu — draf ceritamu tetap tersimpan aman di browser ini."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020617]/82 p-4 backdrop-blur-md pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-teacher-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#cda250]/55 bg-[#070d19] text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#cda250]/25 bg-[#0b1324] px-5 py-3.5">
          <div>
            <p className="font-brand text-[10px] font-bold uppercase tracking-[0.2em] text-[#cda250]">
              Pengumpulan Resmi · Studio Tulis
            </p>
            <h2
              id="submit-teacher-modal-title"
              className="font-brand text-base font-bold text-[#f4d993]"
            >
              Kumpulkan Karya &amp; Nilai ke Guru
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              playChime();
              onClose();
            }}
            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold text-stone-300 hover:border-[#f4d993]/60 hover:text-white cursor-pointer"
          >
            [X] Tutup
          </button>
        </div>

        <div className="max-h-[80dvh] overflow-y-auto px-5 py-4 space-y-4">
          {successResult ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-400/45 bg-emerald-950/45 p-4 space-y-2">
                <p className="font-brand text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Berhasil Dikumpulkan · Versi v{successResult.version}
                </p>
                <p className="text-sm text-stone-100">
                  Karya ceritamu, Peta Rancang, dan skor latihan sudah tercatat di
                  sistem guru.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <span className="block text-[10px] uppercase text-stone-400">
                      ID Pengumpulan
                    </span>
                    <strong className="font-mono text-[#f4d993]">
                      {successResult.submissionId}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <span className="block text-[10px] uppercase text-stone-400">
                      Nilai Total Holistik
                    </span>
                    <strong className="text-emerald-300">
                      {successResult.holisticTotalPercentage}% (Studio{" "}
                      {successResult.studioScore}%)
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs space-y-1.5 text-stone-300">
                <p>
                  <strong className="text-stone-100">Kode Kelas:</strong>{" "}
                  {successResult.classCode}
                </p>
                <p>
                  <strong className="text-stone-100">Status Database Server:</strong>{" "}
                  {successResult.storedInDatabase
                    ? "Tersimpan permanen di MongoDB"
                    : "Mode langsung Spreadsheet"}
                </p>
                <p>
                  <strong className="text-stone-100">Status Google Spreadsheet:</strong>{" "}
                  {successResult.sheetSyncStatus === "synced"
                    ? "Sudah diteruskan otomatis ke Spreadsheet Guru"
                    : successResult.sheetSyncStatus === "not_configured"
                      ? "Tersimpan di Panel Guru (Spreadsheet belum ditautkan admin)"
                      : "Tersimpan aman di server; menunggu sinkron ulang Guru ke Spreadsheet"}
                </p>
                <p>
                  <strong className="text-stone-100">Status Keaslian:</strong>{" "}
                  {successResult.authenticityLabel}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    onClose();
                  }}
                  className="rounded-full bg-[#f4d993] px-5 py-2 text-xs font-bold text-[#030712] hover:bg-white transition-colors cursor-pointer"
                >
                  Selesai &amp; Kembali ke Buku
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmSubmit} className="space-y-4">
              {/* Ringkasan karya yang akan dikirim */}
              <div className="rounded-xl border border-[#cda250]/30 bg-[#0d1629] p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#f4d993] truncate">
                    {draft.storyTitle.trim() || "(Belum diberi judul cerita)"}
                  </span>
                  <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                    {analysis.totalWords} kata
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-stone-300">
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <span className="block text-[10px] text-stone-400">Materi (60%)</span>
                    <strong className="text-stone-100">{metrics.overallPercentage}%</strong>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <span className="block text-[10px] text-stone-400">Studio (40%)</span>
                    <strong className="text-stone-100">{analysis.studioScore}%</strong>
                  </div>
                  <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
                    <span className="block text-[10px] text-stone-400">Total Holistik</span>
                    <strong className="text-[#f4d993]">
                      {metrics.holisticTotalPercentage}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Peringatan keaslian / kelengkapan */}
              {analysis.isModelPresetReference && (
                <div className="rounded-xl border border-amber-400/50 bg-amber-950/45 px-3.5 py-2.5 text-xs text-amber-100">
                  <strong>Perhatian:</strong> Paragrafmu masih terdeteksi sebagai{" "}
                  <strong>Teks Contoh Preset</strong>. Guru akan melihat tanda status
                  preset bila kamu belum mengubahnya dengan kalimatmu sendiri.
                </div>
              )}

              {!analysis.isModelPresetReference &&
                analysis.unfilledPlaceholderCount > 0 && (
                  <div className="rounded-xl border border-amber-400/45 bg-amber-950/35 px-3.5 py-2.5 text-xs text-amber-100">
                    <strong>Info:</strong> Masih ada{" "}
                    <strong>{analysis.unfilledPlaceholderCount} bagian [...]</strong> yang
                    belum diisi di ceritamu. Kamu tetap boleh mengumpulkan, atau lengkapi
                    dulu agar skormu maksimal.
                  </div>
                )}

              {/* Form Identitas Ringkas (Tanpa login email yang merepotkan siswa kelas VII) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="submit-author-name"
                    className="mb-1 block font-bold text-[#f4d993]"
                  >
                    Nama Lengkap Siswa *
                  </label>
                  <input
                    id="submit-author-name"
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Contoh: Nadia Putri Ramadhani"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="submit-author-class"
                    className="mb-1 block font-bold text-[#f4d993]"
                  >
                    Kelas *
                  </label>
                  <input
                    id="submit-author-class"
                    type="text"
                    required
                    value={authorClass}
                    onChange={(e) => setAuthorClass(e.target.value)}
                    placeholder="Contoh: VII-A"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="submit-author-absen"
                    className="mb-1 block font-bold text-stone-200"
                  >
                    No. Absen (Opsional)
                  </label>
                  <input
                    id="submit-author-absen"
                    type="text"
                    value={absenNumber}
                    onChange={(e) => setAbsenNumber(e.target.value)}
                    placeholder="Contoh: 14"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="submit-class-code"
                    className="mb-1 block font-bold text-stone-200"
                  >
                    Kode Kelas dari Guru (Opsional)
                  </label>
                  <input
                    id="submit-class-code"
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    placeholder="Kosongkan jika guru tidak memberi kode, mis. VII-A-2026"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono uppercase text-white placeholder:font-sans placeholder:normal-case placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                  />
                </div>
              </div>

              {state.lastSubmissionMeta && (
                <p className="text-[11px] text-stone-400">
                  Pengumpulan sebelumnya:{" "}
                  <strong className="text-stone-200">
                    {state.lastSubmissionMeta.submissionId} (v
                    {state.lastSubmissionMeta.version})
                  </strong>
                  . Mengirim lagi akan memperbarui rekap guru sebagai versi revisi
                  berikutnya.
                </p>
              )}

              {errorMessage && (
                <div className="rounded-xl border border-rose-400/50 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-100">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playChime();
                    onClose();
                  }}
                  disabled={isSubmitting}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-emerald-500 hover:bg-emerald-400 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Mengirim ke Server & Spreadsheet..."
                    : state.lastSubmissionMeta
                      ? "Kirim Revisi ke Guru ->"
                      : "Kumpulkan ke Guru Sekarang ->"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
