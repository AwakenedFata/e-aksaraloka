"use client";

import { useState, useEffect } from "react";
import {
  type GrimoireChapterId,
  ASTROLABE_SIDE_QUESTS,
  FANTASY_LEXICON_BANK,
} from "@/lib/learning/narrativeCurriculumData";
import {
  useAksaralokaLearning,
  updateLearningState,
  updateStudioDraft,
  resetLearningState,
} from "@/lib/learning/learningStore";
import {
  buildProgressionMapModel,
  type ProgressionMapNode,
  type ProgressionNodeId,
} from "@/lib/learning/progressionMap";
import {
  playChime,
  playSealUnlock,
  playErrorTone,
} from "@/lib/learning/audioEngine";
import {
  AstrolabProgressionMap,
  PETA_WALKTHROUGH_STEPS,
} from "@/components/peta/AstrolabProgressionMap";

interface PetaPembelajaranModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onJumpToGrimoireChapter: (chapter: GrimoireChapterId) => void;
  readonly onJumpToStudio: () => void;
}

type ModalTab = "peta" | "quest" | "luring";

const TOUR_STORAGE_KEY = "aksaraloka:peta-tour-seen:v1";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function PetaPembelajaranModal({
  isOpen,
  onClose,
  onJumpToGrimoireChapter,
  onJumpToStudio,
}: PetaPembelajaranModalProps) {
  const { state, metrics } = useAksaralokaLearning();
  const [activeTab, setActiveTab] = useState<ModalTab>("peta");
  const [userSelectedNodeId, setUserSelectedNodeId] =
    useState<ProgressionNodeId | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(TOUR_STORAGE_KEY) === "1" ? null : 0;
    } catch {
      return null;
    }
  });
  const [isConfirmingReset, setIsConfirmingReset] = useState<boolean>(false);
  const [lexiconCategoryFilter, setLexiconCategoryFilter] = useState<string>("all");
  const [lexiconTypeFilter, setLexiconTypeFilter] = useState<
    "Semua" | "Denotatif" | "Konotatif" | "Kiasan / Majas"
  >("Semua");

  const studentName = state.studioDraft.authorName;
  const studentClass = state.studioDraft.authorClass;

  useEffect(() => {
    if (!isConfirmingReset) return;
    const timer = window.setTimeout(() => setIsConfirmingReset(false), 4500);
    return () => window.clearTimeout(timer);
  }, [isConfirmingReset]);

  const handleRequestReset = () => {
    if (!isConfirmingReset) {
      playErrorTone();
      setIsConfirmingReset(true);
      return;
    }
    playChime();
    setIsConfirmingReset(false);
    setUserSelectedNodeId(null);
    resetLearningState();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mapModel = buildProgressionMapModel(state, metrics);
  const tourFocusNodeId =
    walkthroughStep !== null
      ? PETA_WALKTHROUGH_STEPS[walkthroughStep]?.focusNodeId ?? null
      : null;
  const activeMapNodeId =
    tourFocusNodeId ?? userSelectedNodeId ?? mapModel.recommendedNodeId;

  const handleSelectMapNode = (nodeId: ProgressionNodeId) => {
    playChime();
    setUserSelectedNodeId(nodeId);
  };

  const handleNavigateMapNode = (node: ProgressionMapNode) => {
    playChime();
    if (node.destination.kind === "chapter") {
      onClose();
      onJumpToGrimoireChapter(node.destination.chapter);
      return;
    }
    if (node.destination.kind === "studio") {
      onClose();
      onJumpToStudio();
      return;
    }
    setActiveTab("quest");
  };

  const handleDismissWalkthrough = () => {
    playChime();
    setWalkthroughStep(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
      } catch {
        // Ignore storage errors
      }
    }
  };

  const handleNextWalkthrough = () => {
    playChime();
    if (
      walkthroughStep === null ||
      walkthroughStep >= PETA_WALKTHROUGH_STEPS.length - 1
    ) {
      handleDismissWalkthrough();
    } else {
      setWalkthroughStep(walkthroughStep + 1);
    }
  };

  const handleStartWalkthrough = () => {
    playChime();
    setActiveTab("peta");
    setWalkthroughStep(0);
  };

  const handleQuestSelect = (
    questId: string,
    optionId: string,
    isCorrect: boolean
  ) => {
    if (isCorrect) {
      playSealUnlock();
    } else {
      playErrorTone();
    }
    updateLearningState((prev) => ({
      ...prev,
      questAnswers: {
        ...prev.questAnswers,
        [questId]: optionId,
      },
    }));
  };

  const handlePrintOfflineWorksheet = () => {
    playChime();
    const win = window.open("", "_blank", "width=920,height=860");
    if (!win) return;

    const safeName = escapeHtml(
      studentName.trim() || "................................................"
    );
    const safeClass = escapeHtml(studentClass.trim() || "VII-....");
    const safeCustomAmanat = escapeHtml(
      state.customAmanatReflection.trim() ||
        "Pelajaran kebaikan yang dipetik dari perubahan tokoh utama: ......................................................................................"
    );

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Lembar Kerja Siswa (LKS) Luring & Rapor Kompetensi — E-Aksaraloka</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #18130d;
      margin: 0;
      padding: 28px 34px;
      line-height: 1.5;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #8c6826;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #7c5819;
      font-weight: bold;
    }
    h1 {
      font-size: 22px;
      margin: 4px 0 2px;
      color: #111827;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #5c4010;
      border-bottom: 1px solid #d6c5a3;
      padding-bottom: 4px;
      margin: 18px 0 8px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      background: #f9f5eb;
      border: 1px solid #d8c7a0;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .score-box {
      border: 1px solid #cbb482;
      padding: 8px 10px;
      border-radius: 6px;
      background: #fdfbf6;
      font-size: 12px;
    }
    .score-val {
      font-size: 18px;
      font-weight: bold;
      color: #7c5819;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      margin-top: 6px;
    }
    th, td {
      border: 1px solid #cab894;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f4ead5;
      color: #3f2b09;
    }
    .write-box {
      border: 1px dashed #8c6826;
      min-height: 74px;
      padding: 8px 10px;
      margin-top: 6px;
      border-radius: 4px;
      background: #fffdf9;
      font-size: 12px;
      color: #57534e;
    }
    .checklist {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      font-size: 12.5px;
      margin-top: 6px;
    }
    @media print {
      body { padding: 12px 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PUSTAKA AKSARALOKA · LEMBAR KERJA CERITA FANTASI KELAS VII SMP</div>
      <h1>Lembar Kerja Terbimbing & Rapor Menulis Cerita Fantasi</h1>
    </div>
    <div style="font-size: 12px; text-align: right;">
      Belajar Membaca &amp; Menulis Cerita Fantasi
    </div>
  </div>

  <div class="meta-grid">
    <div><strong>Nama Siswa:</strong> ${safeName}</div>
    <div><strong>Kelas:</strong> ${safeClass} · <strong>Gelar:</strong> ${escapeHtml(metrics.masteryRankTitle)}</div>
    <div><strong>Skor Holistik:</strong> ${metrics.holisticTotalPercentage}% (${escapeHtml(metrics.kelayakanCategory)})</div>
  </div>

  <div class="score-grid">
    <div class="score-box">
      <div>Segel I · Alur &amp; Struktur</div>
      <div class="score-val">${metrics.babak1Score}/100</div>
    </div>
    <div class="score-box">
      <div>Segel II · Watak &amp; 5 Indera</div>
      <div class="score-val">${metrics.babak2Score}/100</div>
    </div>
    <div class="score-box">
      <div>Segel III · Majas &amp; Dialog</div>
      <div class="score-val">${metrics.babak3Score}/100</div>
    </div>
    <div class="score-box">
      <div>Kuis Tantangan Logika</div>
      <div class="score-val">${metrics.questScore}/100</div>
    </div>
    <div class="score-box">
      <div>Studio Tulis (Karya)</div>
      <div class="score-val">${metrics.babak4Score}/100</div>
    </div>
  </div>

  <h2>Bagian 1 · Kamus Kata Fantasi & Contoh Perumpamaan (Majas Asosiasi)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Bagian Cerita</th>
        <th style="width: 38%;">Contoh Kata Panca Indera</th>
        <th style="width: 38%;">Contoh Perumpamaan &amp; Dialog yang Rapi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Suasana &amp; Panca Indera</strong></td>
        <td>
          • <em>Penglihatan:</em> berpendar merah delima, kabut keperakan, temaram lentera<br/>
          • <em>Pendengaran:</em> dentuman langkah, desir angin magis, gemerincing kristal<br/>
          • <em>Penciuman/Peraba:</em> harum kayu manis, hawa dingin menusuk tulang
        </td>
        <td>
          <strong>Kata Perumpamaan (Majas Asosiasi):</strong><br/>
          <em>seperti, bagai, bagaikan, laksana, bak, seumpama</em><br/>
          Contoh: "Bagaikan minyak dan air", "Laksana oase di padang pasir", "Melesat seperti anak panah".
        </td>
      </tr>
      <tr>
        <td><strong>Aturan Keajaiban &amp; Konflik</strong></td>
        <td>
          Setiap benda/kekuatan ajaib wajib memiliki <strong>syarat atau batas aturan</strong> agar penyelesaian di puncak masalah tetap masuk akal.
        </td>
        <td>
          <strong>Mengubah Dialog Langsung ke Kalimat Cerita:</strong><br/>
          Lepas tanda petik ("...") dan ubah kata ganti <em>aku/kau</em> menjadi <em>ia/nama tokoh</em>.
        </td>
      </tr>
    </tbody>
  </table>

  <h2>Bagian 2 · Rencana Cerita 6 Langkah</h2>
  <table>
    <tbody>
      <tr>
        <th style="width: 28%;">1. Ide & Aturan Keajaiban</th>
        <td>Tokoh biasa + benda/kejadian ajaib + batas aturan kekuatan: ........................................................................................................</td>
      </tr>
      <tr>
        <th>2. Tokoh Utama & Lawan</th>
        <td>Nama & bukti sifat lewat perbuatan (bukan cuma disebut baik/jahat): ....................................................................................</td>
      </tr>
      <tr>
        <th>3. Tempat & 3 Panca Indera</th>
        <td>Apa yang terlihat, terdengar, dan terasa di tempat itu: ..................................................................................................................</td>
      </tr>
      <tr>
        <th>4. Rencana Jalan Cerita</th>
        <td>
          • <strong>Awal Cerita (Orientasi):</strong> .............................................................................................................................................................<br/>
          • <strong>Masalah & Puncak (Klimaks):</strong> ..............................................................................................................................................<br/>
          • <strong>Akhir Cerita (Resolusi):</strong> .........................................................................................................................................................
        </td>
      </tr>
      <tr>
        <th>5. Pesan Kebaikan (Amanat)</th>
        <td>${safeCustomAmanat}</td>
      </tr>
    </tbody>
  </table>

  <h2>Bagian 3 · Lembar Menulis Cerita Fantasi</h2>
  <div class="write-box"><strong>Judul Cerita Fantasi:</strong> ........................................................................................................................<br/><br/><strong>Paragraf 1 (Awal Cerita / Orientasi — Kenalkan Tokoh, Tempat, & Awal Keajaiban):</strong><br/><br/><br/></div>
  <div class="write-box"><strong>Paragraf 2 (Masalah & Puncak / Klimaks — Muncul Masalah, Dialog "...", & Perumpamaan):</strong><br/><br/><br/></div>
  <div class="write-box"><strong>Paragraf 3 (Akhir Cerita / Resolusi — Penyelesaian Masalah & Pesan Kebaikan):</strong><br/><br/><br/></div>

  <h2>Bagian 4 · 6 Ceklis Sebelum Dikumpulkan</h2>
  <div class="checklist">
    <div>[ ] Ada bagian Awal, Puncak Masalah, dan Akhir yang urut.</div>
    <div>[ ] Penyelesaian masalah sesuai dengan aturan keajaiban cerita.</div>
    <div>[ ] Ada minimal 2 kata panca indera (cahaya, suara, atau aroma/suhu).</div>
    <div>[ ] Ada minimal 1 perumpamaan (seperti/bagaikan/laksana/bak).</div>
    <div>[ ] Ada kalimat langsung bertanda petik ("...") dan kalimat tak langsung.</div>
    <div>[ ] Kata depan tempat (di atas, di dalam, di sekolah) ditulis dipisah.</div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[65] select-none overflow-hidden overscroll-none bg-[#030712]"
      role="dialog"
      aria-modal="true"
      aria-label="Peta Petualangan Aksaraloka"
    >
      {/* 1. FULL-SCREEN MAP DISPLAY (NO CONTAINER BOX) */}
      <AstrolabProgressionMap
        nodes={mapModel.nodes}
        segments={mapModel.segments}
        selectedNodeId={activeMapNodeId}
        walkthroughStep={walkthroughStep}
        showInteractivePins={activeTab === "peta"}
        onSelectNode={handleSelectMapNode}
        onNavigateNode={handleNavigateMapNode}
        onNextWalkthrough={handleNextWalkthrough}
        onDismissWalkthrough={handleDismissWalkthrough}
      />

      {/* 2. TOP FLOATING PILLS OVER FULL-SCREEN MAP */}
      <div className="pointer-events-none fixed inset-x-0 top-2.5 z-40 flex justify-center px-3 sm:top-4 sm:px-6">
        <div className="flex w-full max-w-[1280px] flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-2">
          {/* Mobile Compact Top Row (Back + Progress + Help/Close) | Desktop Left Pill Group */}
          <div className="pointer-events-auto flex items-center justify-between gap-1.5 md:hidden">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full border border-[#d6b26f]/45 bg-slate-950/90 px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow-lg backdrop-blur-md cursor-pointer"
            >
              <span>&lt;- Kembali</span>
            </button>

            <span className="rounded-full border border-[#d6b26f]/40 bg-slate-950/88 px-2.5 py-1 text-[11px] font-bold text-[#ffe8b6] shadow-md">
              Segel {metrics.unlockedSealsCount}/3 ·{" "}
              <span className="text-emerald-300">{metrics.holisticTotalPercentage}%</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleStartWalkthrough}
                aria-label="Buka panduan cara main"
                className="min-h-[38px] rounded-full border border-[#f3d89b]/60 bg-slate-950/90 px-2.5 text-[11px] font-bold text-[#ffe8b6] shadow-md cursor-pointer"
              >
                ?
              </button>
              <button
                type="button"
                onClick={handleRequestReset}
                className={`min-h-[38px] rounded-full border px-2.5 text-[10.5px] font-semibold shadow-md cursor-pointer transition-colors ${
                  isConfirmingReset
                    ? "border-rose-400 bg-rose-950/95 text-rose-100"
                    : "border-white/15 bg-slate-950/90 text-stone-300"
                }`}
              >
                {isConfirmingReset ? "Yakin Reset?" : "Ulangi"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup Peta Petualangan"
                className="min-h-[38px] rounded-full border border-rose-300/45 bg-rose-950/85 px-2.5 text-[11px] font-bold text-rose-200 shadow-md cursor-pointer"
              >
                [ X ]
              </button>
            </div>
          </div>

          {/* Segmented 3-Tab Pill Group (Full-width grid on mobile, inline pill on desktop) */}
          <div className="pointer-events-auto grid grid-cols-3 items-center gap-1 rounded-full border border-[#d6b26f]/45 bg-slate-950/88 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.85)] backdrop-blur-md md:flex md:flex-wrap md:gap-1.5 md:px-2.5 md:py-1.5">
            <button
              type="button"
              onClick={onClose}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-white transition hover:border-[#f3d89b] hover:text-[#f3d89b] cursor-pointer"
            >
              <span>&lt;- Ruang Pustaka</span>
            </button>

            <div className="mx-0.5 hidden h-3.5 w-px bg-[#d6b26f]/30 md:block" />

            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("peta");
              }}
              className={`min-h-[36px] md:min-h-0 rounded-full px-2 md:px-3 py-1 text-[11px] font-bold transition-all cursor-pointer truncate ${
                activeTab === "peta"
                  ? "bg-[#f3d89b] text-slate-950 shadow-[0_0_12px_rgba(243,216,155,0.45)]"
                  : "text-amber-100/85 hover:text-white"
              }`}
            >
              <span className="md:hidden">Peta Misi</span>
              <span className="hidden md:inline">1. Peta Misi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("quest");
              }}
              className={`min-h-[36px] md:min-h-0 rounded-full px-2 md:px-3 py-1 text-[11px] font-bold transition-all cursor-pointer truncate ${
                activeTab === "quest"
                  ? "bg-[#f3d89b] text-slate-950 shadow-[0_0_12px_rgba(243,216,155,0.45)]"
                  : "text-amber-100/85 hover:text-white"
              }`}
            >
              <span className="md:hidden">Kuis ({metrics.questScore}%)</span>
              <span className="hidden md:inline">2. Kuis Bonus ({metrics.questScore}%)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("luring");
              }}
              className={`min-h-[36px] md:min-h-0 rounded-full px-2 md:px-3 py-1 text-[11px] font-bold transition-all cursor-pointer truncate ${
                activeTab === "luring"
                  ? "bg-[#f3d89b] text-slate-950 shadow-[0_0_12px_rgba(243,216,155,0.45)]"
                  : "text-amber-100/85 hover:text-white"
              }`}
            >
              <span className="md:hidden">LKS &amp; Kamus</span>
              <span className="hidden md:inline">3. Cetak LKS &amp; Kamus Kata</span>
            </button>
          </div>

          {/* Desktop Right Floating Pill Group */}
          <div className="pointer-events-auto hidden md:flex flex-wrap items-center gap-1.5 rounded-full border border-[#d6b26f]/45 bg-slate-950/84 px-3 py-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <span className="text-[11px] text-amber-100/85">
              <strong className="text-[#ffe8b6]">{metrics.masteryRankTitle}</strong>
              <span className="mx-1 text-[#d6b26f]/40">|</span>
              Segel{" "}
              <strong className="text-[#ffe8b6]">
                {metrics.unlockedSealsCount}/3
              </strong>{" "}
              <span className="mx-1 text-[#d6b26f]/40">|</span>
              <strong className="text-emerald-300">
                Total {metrics.holisticTotalPercentage}%
              </strong>
            </span>

            <div className="mx-0.5 h-3.5 w-px bg-[#d6b26f]/30" />

            <button
              type="button"
              onClick={handleStartWalkthrough}
              className="rounded-full border border-[#f3d89b]/60 bg-[#cda250]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#ffe8b6] transition hover:bg-[#cda250]/35 cursor-pointer"
            >
              ? Cara Main
            </button>

            <button
              type="button"
              onClick={handleRequestReset}
              className={`px-1.5 text-[11px] underline-offset-2 cursor-pointer transition-colors ${
                isConfirmingReset
                  ? "rounded-full border border-rose-400/70 bg-rose-950/85 px-2.5 py-0.5 font-bold text-rose-100"
                  : "text-stone-300 hover:text-amber-300 hover:underline"
              }`}
            >
              {isConfirmingReset ? "Klik Lagi: Hapus Semua?" : "Ulangi"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-rose-300/45 bg-rose-950/60 px-2.5 py-0.5 text-[11px] font-bold text-rose-200 transition hover:border-rose-300 hover:bg-rose-900/80 cursor-pointer"
              aria-label="Tutup Peta Petualangan"
            >
              [ X ] Tutup
            </button>
          </div>
        </div>
      </div>

      {/* 3. FLOATING OVERLAY WHEN TAB 2 (KUIS BONUS) OR TAB 3 (LKS & KAMUS KATA) IS OPEN */}
      {activeTab !== "peta" && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-black/65 px-3 pt-28 pb-8 backdrop-blur-[6px] sm:px-6 md:pt-20"
        >
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {activeTab === "quest" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#cda250]/50 bg-slate-950/92 px-4 py-3 text-xs sm:text-sm text-stone-200 shadow-2xl">
                  <span>
                    <strong className="text-[#f4d993]">
                      Misi Bonus Penjaga Aksara:
                    </strong>{" "}
                    Jawab 3 teka-teki singkat ini buat latihan mencari ide
                    cerita dan mengecek ejaan sebelum mengarang!
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      setActiveTab("peta");
                    }}
                    className="rounded-full border border-[#cda250]/60 bg-[#071324] px-3 py-1 text-xs font-bold text-[#f4d993] hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                  >
                    &lt;- Kembali ke Peta
                  </button>
                </div>

                {ASTROLABE_SIDE_QUESTS.map((quest) => {
                  const chosenId = state.questAnswers[quest.id];
                  const chosenOpt = quest.options.find(
                    (o) => o.id === chosenId
                  );

                  return (
                    <div
                      key={quest.id}
                      className="rounded-2xl border border-[#cda250]/35 bg-slate-950/92 p-4 sm:p-5 space-y-2.5 shadow-2xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-brand text-xs font-semibold tracking-wider text-[#f4d993] uppercase">
                          {quest.code}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {quest.targetCompetency}
                        </span>
                      </div>

                      <h3 className="font-serif text-base font-bold text-white">
                        {quest.title}
                      </h3>

                      <div className="rounded-lg border border-amber-400/25 bg-amber-950/25 p-3 text-xs sm:text-sm text-amber-100/90 italic">
                        {quest.scenario}
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-stone-200">
                        {quest.question}
                      </p>

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {quest.options.map((opt) => {
                          const isSelected = chosenId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                handleQuestSelect(
                                  quest.id,
                                  opt.id,
                                  opt.isCorrect
                                )
                              }
                              className={`text-left rounded-xl border p-3 text-xs sm:text-sm transition-all cursor-pointer ${
                                isSelected
                                  ? opt.isCorrect
                                    ? "border-emerald-400/70 bg-emerald-950/45 text-emerald-100"
                                    : "border-rose-400/70 bg-rose-950/45 text-rose-100"
                                  : "border-white/15 bg-white/5 text-stone-200 hover:border-[#cda250]/60 hover:bg-white/10"
                              }`}
                            >
                              {opt.text}
                            </button>
                          );
                        })}
                      </div>

                      {chosenOpt && (
                        <div
                          className={`rounded-lg p-3 text-xs leading-relaxed ${
                            chosenOpt.isCorrect
                              ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-200"
                              : "bg-rose-950/60 border border-rose-500/40 text-rose-200"
                          }`}
                        >
                          <strong>Penjelasan:</strong> {chosenOpt.feedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {activeTab === "luring" && (
              <>
                <div className="rounded-2xl border border-[#cda250]/50 bg-slate-950/92 p-4 sm:p-5 space-y-3.5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-brand text-[11px] tracking-widest text-[#f4d993] uppercase">
                        LEMBAR KERJA KERTAS &amp; KAMUS KATA FANTASI
                      </span>
                      <h3 className="mt-0.5 font-serif text-lg font-bold text-white">
                        Cetak Lembar Kerja Siswa (LKS) &amp; Rapor Belajar
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playChime();
                        setActiveTab("peta");
                      }}
                      className="rounded-full border border-[#cda250]/60 bg-[#071324] px-3 py-1 text-xs font-bold text-[#f4d993] hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                    >
                      &lt;- Kembali ke Peta
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Mau mengerjakan di kertas atau menyimpannya sebagai PDF? Isi
                    nama dan kelasmu di bawah, lalu klik tombol cetak!
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-stone-300">
                        Nama Lengkapmu:
                      </span>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) =>
                          updateStudioDraft({ authorName: e.target.value })
                        }
                        placeholder="Contoh: Aruna Pratama"
                        className="w-full rounded-lg border border-white/20 bg-[#030712] px-3 py-2 text-base sm:text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-stone-300">Kelas:</span>
                      <input
                        type="text"
                        value={studentClass}
                        onChange={(e) =>
                          updateStudioDraft({ authorClass: e.target.value })
                        }
                        placeholder="VII-A"
                        className="w-full rounded-lg border border-white/20 bg-[#030712] px-3 py-2 text-base sm:text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handlePrintOfflineWorksheet}
                        className="w-full min-h-[44px] rounded-lg bg-[#cda250] px-4 py-2.5 text-xs font-brand font-bold tracking-wider uppercase text-[#030712] transition-all hover:bg-[#f4d993] cursor-pointer"
                      >
                        Cetak LKS &amp; Rapor (PDF)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Kamus Kata Fantasi (48 Entri Terkurasi + Filter Kategori & Makna) */}
                <div className="rounded-2xl border border-[#cda250]/40 bg-slate-950/92 p-3.5 space-y-2.5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-brand text-[11px] font-bold tracking-wider text-[#f4d993] uppercase">
                      Kamus Kata Fantasi (6 Kategori · 48 Diksi Terkurasi)
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {(["Semua", "Denotatif", "Konotatif", "Kiasan / Majas"] as const).map(
                        (typeOpt) => (
                          <button
                            key={typeOpt}
                            type="button"
                            onClick={() => {
                              playChime();
                              setLexiconTypeFilter(typeOpt);
                            }}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                              lexiconTypeFilter === typeOpt
                                ? "bg-emerald-400 text-slate-950"
                                : "border border-white/15 bg-white/5 text-stone-300 hover:border-emerald-400/50"
                            }`}
                          >
                            {typeOpt}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playChime();
                        setLexiconCategoryFilter("all");
                      }}
                      className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
                        lexiconCategoryFilter === "all"
                          ? "bg-[#f4d993] text-slate-950"
                          : "border border-[#cda250]/35 bg-white/5 text-amber-100 hover:bg-white/10"
                      }`}
                    >
                      Semua Kategori
                    </button>
                    {FANTASY_LEXICON_BANK.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          playChime();
                          setLexiconCategoryFilter(cat.id);
                        }}
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
                          lexiconCategoryFilter === cat.id
                            ? "bg-[#f4d993] text-slate-950"
                            : "border border-[#cda250]/35 bg-white/5 text-amber-100 hover:bg-white/10"
                        }`}
                      >
                        {cat.category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {FANTASY_LEXICON_BANK.filter(
                    (cat) =>
                      lexiconCategoryFilter === "all" ||
                      cat.id === lexiconCategoryFilter
                  ).map((cat) => {
                    const filteredEntries = cat.entries.filter(
                      (entry) =>
                        lexiconTypeFilter === "Semua" ||
                        entry.type === lexiconTypeFilter
                    );
                    if (filteredEntries.length === 0) return null;
                    return (
                      <div
                        key={cat.id}
                        className="rounded-2xl border border-[#cda250]/35 bg-slate-950/92 p-4 space-y-2.5 shadow-2xl"
                      >
                        <div>
                          <h4 className="font-serif text-base font-bold text-[#f4d993]">
                            Kamus Kata: {cat.category}
                          </h4>
                          <p className="text-xs text-stone-400">{cat.subtitle}</p>
                        </div>
                        <div className="space-y-2">
                          {filteredEntries.map((entry) => (
                            <div
                              key={entry.word}
                              className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-white">
                                  {entry.word}
                                </strong>
                                <span className="rounded bg-[#cda250]/20 px-2 py-0.5 text-[10px] text-[#f4d993] shrink-0">
                                  {entry.type}
                                </span>
                              </div>
                              <p className="text-stone-300">{entry.meaning}</p>
                              <p className="text-amber-200/85 italic">
                                Contoh: &ldquo;{entry.example}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
