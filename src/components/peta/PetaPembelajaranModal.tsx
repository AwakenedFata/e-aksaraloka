"use client";

import { useState, useEffect } from "react";
import {
  type GrimoireChapterId,
  TUJUAN_PEMBELAJARAN_LIST,
  ASTROLABE_SIDE_QUESTS,
  FANTASY_LEXICON_BANK,
} from "@/lib/learning/narrativeCurriculumData";
import {
  useAksaralokaLearning,
  updateLearningState,
  resetLearningState,
} from "@/lib/learning/learningStore";
import {
  playChime,
  playSealUnlock,
  playErrorTone,
} from "@/lib/learning/audioEngine";

interface PetaPembelajaranModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onJumpToGrimoireChapter: (chapter: GrimoireChapterId) => void;
  readonly onJumpToStudio: () => void;
}

type ModalTab = "peta" | "quest" | "luring";

export function PetaPembelajaranModal({
  isOpen,
  onClose,
  onJumpToGrimoireChapter,
  onJumpToStudio,
}: PetaPembelajaranModalProps) {
  const { state, metrics } = useAksaralokaLearning();
  const [activeTab, setActiveTab] = useState<ModalTab>("peta");
  const [studentName, setStudentName] = useState<string>("");
  const [studentClass, setStudentClass] = useState<string>("VII-A");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleQuestSelect = (questId: string, optionId: string, isCorrect: boolean) => {
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

    const safeName = studentName.trim() || "................................................";
    const safeClass = studentClass.trim() || "VII-....";

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
      grid-template-columns: repeat(4, 1fr);
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
      <div class="brand">PUSTAKA AKSARALOKA · BAHASA INDONESIA KELAS VII SMP (FASE D)</div>
      <h1>Lembar Kerja Terbimbing & Rapor Menulis Teks Cerita Fantasi</h1>
    </div>
    <div style="font-size: 12px; text-align: right;">
      Kurikulum Merdeka · Bab II (Hlm. 52–70)
    </div>
  </div>

  <div class="meta-grid">
    <div><strong>Nama Siswa:</strong> ${safeName}</div>
    <div><strong>Kelas:</strong> ${safeClass}</div>
    <div><strong>Status Penguasaan:</strong> ${metrics.overallPercentage}% (${metrics.kelayakanCategory})</div>
  </div>

  <div class="score-grid">
    <div class="score-box">
      <div>Segel I · Alur & Struktur</div>
      <div class="score-val">${metrics.babak1Score}/100</div>
    </div>
    <div class="score-box">
      <div>Segel II · Watak & 5 Indera</div>
      <div class="score-val">${metrics.babak2Score}/100</div>
    </div>
    <div class="score-box">
      <div>Segel III · Majas & Dialog</div>
      <div class="score-val">${metrics.babak3Score}/100</div>
    </div>
    <div class="score-box">
      <div>Quest Tantangan Logika</div>
      <div class="score-val">${metrics.questScore}/100</div>
    </div>
  </div>

  <h2>Bagian 1 · Bank Kata Fantasi & Penanda Majas Asosiasi (Referensi Cepat)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Kategori Unsur</th>
        <th style="width: 38%;">Pilihan Kosakata & Frasa Sensori</th>
        <th style="width: 38%;">Contoh Majas Asosiasi & Kaidah Dialog EYD V</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Peta Lima Indera (Latar & Suasana)</strong></td>
        <td>
          • <em>Penglihatan:</em> berpendar merah delima, kabut keperakan, temaram lentera<br/>
          • <em>Pendengaran:</em> dentuman langkah, desir angin magis, gemerincing kristal<br/>
          • <em>Penciuman/Perabaan:</em> harum kayu manis, hawa dingin menusuk tulang
        </td>
        <td>
          <strong>Penanda Majas Asosiasi (Hlm. 63):</strong><br/>
          <em>seperti, bagai, bagaikan, laksana, bak, seumpama</em><br/>
          Contoh: "Bagaikan minyak dan air", "Laksana oase di padang pasir", "Melesat seperti anak panah".
        </td>
      </tr>
      <tr>
        <td><strong>Aturan Dunia & Konflik</strong></td>
        <td>
          Setiap benda/kekuatan ajaib wajib memiliki <strong>syarat atau batas aturan</strong> agar penyelesaian di Klimaks tetap logis dan tidak melompat-lompat.
        </td>
        <td>
          <strong>Kalimat Langsung ke Tak Langsung (Hlm. 69):</strong><br/>
          Lepas tanda petik ("...") dan ubah kata ganti <em>aku/kau</em> menjadi <em>ia/nama tokoh</em>.
        </td>
      </tr>
    </tbody>
  </table>

  <h2>Bagian 2 · Kerangka Bertahap 6 Langkah Menulis Cerita Fantasi (Hlm. 70)</h2>
  <table>
    <tbody>
      <tr>
        <th style="width: 28%;">1. Ide & Aturan Dunia Fantasi</th>
        <td>Tokoh biasa + benda/kejadian ajaib + batas aturan kekuatan: ........................................................................................................</td>
      </tr>
      <tr>
        <th>2. Tokoh Protagonis & Antagonis</th>
        <td>Nama & bukti sifat melalui tindakan (bukan sekadar disebut baik/jahat): ....................................................................................</td>
      </tr>
      <tr>
        <th>3. Latar Tempat, Waktu, & 3 Indera</th>
        <td>Penglihatan, pendengaran, dan suasana latar: ..................................................................................................................................</td>
      </tr>
      <tr>
        <th>4. Diagram Alur (Awal–Tengah–Akhir)</th>
        <td>
          • <strong>Orientasi (Awal):</strong> ...........................................................................................................................................................................<br/>
          • <strong>Komplikasi & Klimaks (Puncak):</strong> ..................................................................................................................................................<br/>
          • <strong>Resolusi (Akhir):</strong> ............................................................................................................................................................................
        </td>
      </tr>
      <tr>
        <th>5. Rumusan Amanat Cerita</th>
        <td>${state.customAmanatReflection.trim() || "Pesan moral yang dipetik dari perubahan tokoh utama: ......................................................................................"}</td>
      </tr>
    </tbody>
  </table>

  <h2>Bagian 3 · Area Penulisan Naskah Cerita Fantasi (3 Paragraf Terstruktur)</h2>
  <div class="write-box"><strong>Judul Cerita Fantasi:</strong> ........................................................................................................................<br/><br/><strong>Paragraf 1 (Orientasi — Pengenalan Tokoh & Latar Sensori):</strong><br/><br/><br/></div>
  <div class="write-box"><strong>Paragraf 2 (Komplikasi & Klimaks — Munculnya Masalah, Dialog Langsung, & Puncak Ketegangan):</strong><br/><br/><br/></div>
  <div class="write-box"><strong>Paragraf 3 (Resolusi & Amanat — Penyelesaian Masalah & Perubahan Sikap Tokoh):</strong><br/><br/><br/></div>

  <h2>Bagian 4 · Daftar Periksa Revisi Mandiri (TP 5 · Isi, Logika Alur, & Bahasa EYD V)</h2>
  <div class="checklist">
    <div>[ ] Struktur Orientasi, Komplikasi-Klimaks, dan Resolusi sudah lengkap.</div>
    <div>[ ] Alur logis dan konsisten dengan aturan dunia fantasi yang dibuat.</div>
    <div>[ ] Menggunakan minimal 2 detail panca indera pada deskripsi latar/tokoh.</div>
    <div>[ ] Menyisipkan minimal 1 Majas Asosiasi (bagai/bagaikan/laksana/bak/seperti).</div>
    <div>[ ] Menyisipkan Kalimat Langsung bertanda petik ("...") dan Kalimat Tak Langsung.</div>
    <div>[ ] Kata depan penunjuk tempat (di atas, di dalam, di sekolah) ditulis terpisah.</div>
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
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-3 py-4 sm:px-6 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="peta-modal-heading"
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#cda250]/55 bg-gradient-to-b from-[#071324]/98 via-[#040b18]/98 to-[#030712]/98 text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cda250]/30 bg-[#030712]/80 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#f4d993] shadow-[0_0_8px_#f4d993]" />
              <span className="font-brand text-[10px] sm:text-xs font-semibold tracking-[0.25em] text-[#f4d993] uppercase">
                ASTROLAB PUSTAKA · KOMPAS KOMPETENSI KELAS VII
              </span>
            </div>
            <h2
              id="peta-modal-heading"
              className="mt-1 font-serif text-xl sm:text-2xl font-medium text-white"
            >
              Peta Pembelajaran, Quest Logika, & Perangkat Luring
            </h2>
          </div>

          {/* Live Competency Summary Badges */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/90 px-3.5 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Segel Terbuka
              </div>
              <div className="font-brand text-sm font-semibold text-[#f4d993]">
                {metrics.unlockedSealsCount} / 3 Segel
              </div>
            </div>

            <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/90 px-3.5 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                Capaian Kompetensi
              </div>
              <div className="font-brand text-sm font-semibold text-emerald-300">
                {metrics.overallPercentage}% · {metrics.kelayakanCategory.split(" ")[0]}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-stone-300 transition-colors hover:border-[#f4d993] hover:text-white cursor-pointer"
              aria-label="Tutup Peta Pembelajaran"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#050d1a] px-5 py-2.5 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("peta");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-brand tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "peta"
                  ? "bg-[#cda250] text-[#030712] font-semibold shadow-[0_0_16px_rgba(205,162,80,0.45)]"
                  : "border border-white/15 bg-white/5 text-stone-300 hover:border-[#cda250]/60 hover:text-white"
              }`}
            >
              1. Peta 5 TP & Jalur Cepat
            </button>
            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("quest");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-brand tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "quest"
                  ? "bg-[#cda250] text-[#030712] font-semibold shadow-[0_0_16px_rgba(205,162,80,0.45)]"
                  : "border border-white/15 bg-white/5 text-stone-300 hover:border-[#cda250]/60 hover:text-white"
              }`}
            >
              2. Quest Tantangan ({metrics.questScore}%)
            </button>
            <button
              type="button"
              onClick={() => {
                playChime();
                setActiveTab("luring");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-brand tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === "luring"
                  ? "bg-[#cda250] text-[#030712] font-semibold shadow-[0_0_16px_rgba(205,162,80,0.45)]"
                  : "border border-white/15 bg-white/5 text-stone-300 hover:border-[#cda250]/60 hover:text-white"
              }`}
            >
              3. Cetak LKS Luring & Bank Kata
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              playChime();
              resetLearningState();
            }}
            className="text-[11px] text-stone-400 underline-offset-4 hover:text-amber-300 hover:underline cursor-pointer"
          >
            Atur Ulang Progres Simulasi
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div
          data-lenis-prevent
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-5"
        >
          {activeTab === "peta" && (
            <div className="space-y-5">
              {/* 4 Core Seals Progress Bar (Babak I - IV) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/75 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-brand text-xs tracking-wider text-[#f4d993] uppercase">
                        Babak I · Kompas Waktu
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          state.sealAlurUnlocked
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
                        }`}
                      >
                        {state.sealAlurUnlocked ? "Segel Terbuka" : `Skor ${metrics.babak1Score}%`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-stone-300">
                      Alur Awal–Tengah–Akhir, teks model <em>Bola-Bola Waktu</em>, &amp; rumusan Amanat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      onClose();
                      onJumpToGrimoireChapter("alur");
                    }}
                    className="mt-3 w-full rounded-lg border border-[#cda250]/60 bg-[#cda250]/15 px-3 py-1.5 text-xs font-semibold text-[#f4d993] transition-colors hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                  >
                    Buka Babak I di Kitab
                  </button>
                </div>

                <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/75 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-brand text-xs tracking-wider text-[#f4d993] uppercase">
                        Babak II · Cermin Watak
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          state.sealWatakUnlocked
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
                        }`}
                      >
                        {state.sealWatakUnlocked ? "Segel Terbuka" : `Skor ${metrics.babak2Score}%`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-stone-300">
                      Penokohan <em>Sihir Unik Mao</em>, 4 Kantong <em>Keberanian Emas</em>, &amp; Peta 5 Indera.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      onClose();
                      onJumpToGrimoireChapter("watak");
                    }}
                    className="mt-3 w-full rounded-lg border border-[#cda250]/60 bg-[#cda250]/15 px-3 py-1.5 text-xs font-semibold text-[#f4d993] transition-colors hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                  >
                    Buka Babak II di Kitab
                  </button>
                </div>

                <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/75 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-brand text-xs tracking-wider text-[#f4d993] uppercase">
                        Babak III · Alkimia Bahasa
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          state.sealBahasaUnlocked
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
                        }`}
                      >
                        {state.sealBahasaUnlocked ? "Segel Terbuka" : `Skor ${metrics.babak3Score}%`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-stone-300">
                      Majas Asosiasi, Bank Kata Fantasi, &amp; Kalimat Langsung/Tak Langsung EYD V.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      onClose();
                      onJumpToGrimoireChapter("bahasa");
                    }}
                    className="mt-3 w-full rounded-lg border border-[#cda250]/60 bg-[#cda250]/15 px-3 py-1.5 text-xs font-semibold text-[#f4d993] transition-colors hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                  >
                    Buka Babak III di Kitab
                  </button>
                </div>

                <div className="rounded-xl border border-[#cda250]/40 bg-[#071324]/75 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-brand text-xs tracking-wider text-[#f4d993] uppercase">
                        Babak IV · Studio Tulis
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          state.sealStudioUnlocked
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                            : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
                        }`}
                      >
                        {state.sealStudioUnlocked ? "Segel Terbuka" : `Skor ${metrics.babak4Score}%`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-stone-300">
                      Penulisan Terbimbing 6 Langkah, Detektor Sastra Real-Time, &amp; Galeri ({state.savedManuscripts.length} Karya).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChime();
                      onClose();
                      onJumpToStudio();
                    }}
                    className="mt-3 w-full rounded-lg bg-[#cda250] px-3 py-1.5 text-xs font-bold text-[#030712] transition-colors hover:bg-[#f4d993] cursor-pointer"
                  >
                    Buka Meja Studio Tulis
                  </button>
                </div>
              </div>

              {/* 5 Tujuan Pembelajaran Mapping Table */}
              <div className="space-y-3">
                <h3 className="font-serif text-base sm:text-lg font-medium text-white">
                  Pemetaan 5 Tujuan Pembelajaran (TP) & Solusi Masalah Siswa
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {TUJUAN_PEMBELAJARAN_LIST.map((tp) => (
                    <div
                      key={tp.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#040915]/90 p-4 transition-colors hover:border-[#cda250]/50"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#cda250]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#f4d993]">
                            {tp.code}
                          </span>
                          <span className="font-serif text-sm sm:text-base font-medium text-white">
                            {tp.title}
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 leading-relaxed">
                          {tp.description}
                        </p>
                        <div className="pt-1 text-[11px] text-amber-200/85">
                          <strong>Peran Media:</strong> {tp.mediaRole}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            playChime();
                            onClose();
                            if (tp.targetDestination === "studio") {
                              onJumpToStudio();
                            } else {
                              onJumpToGrimoireChapter(tp.targetDestination);
                            }
                          }}
                          className="rounded-full border border-[#cda250]/60 bg-[#071324] px-4 py-2 text-xs font-brand tracking-wider uppercase text-[#f4d993] transition-all hover:bg-[#cda250] hover:text-[#030712] cursor-pointer"
                        >
                          {tp.targetDestination === "studio"
                            ? "Ke Meja Studio Tulis"
                            : `Lompat ke Babak ${tp.targetDestination.toUpperCase()}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "quest" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#cda250]/35 bg-[#071324]/70 p-4 text-xs sm:text-sm text-stone-200">
                <strong>Misi Tambahan Penjaga Aksara:</strong> Selesaikan 3 kasus penulisan di bawah ini untuk melatih kepekaan ide, logika dunia fantasi, dan ketelitian penyuntingan EYD V sebelum menulis naskah utuh di Studio Tulis.
              </div>

              {ASTROLABE_SIDE_QUESTS.map((quest) => {
                const chosenId = state.questAnswers[quest.id];
                const chosenOpt = quest.options.find((o) => o.id === chosenId);

                return (
                  <div
                    key={quest.id}
                    className="rounded-xl border border-white/15 bg-[#040915]/95 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-brand text-xs font-semibold tracking-wider text-[#f4d993] uppercase">
                        {quest.code}
                      </span>
                      <span className="text-[11px] text-stone-400">
                        {quest.targetCompetency}
                      </span>
                    </div>

                    <h3 className="font-serif text-base sm:text-lg font-medium text-white">
                      {quest.title}
                    </h3>

                    <div className="rounded-lg border border-amber-400/25 bg-amber-950/20 p-3 text-xs sm:text-sm text-amber-100/90 italic">
                      {quest.scenario}
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-stone-200">
                      {quest.question}
                    </p>

                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {quest.options.map((opt) => {
                        const isSelected = chosenId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleQuestSelect(quest.id, opt.id, opt.isCorrect)}
                            className={`text-left rounded-xl border p-3.5 text-xs sm:text-sm transition-all cursor-pointer ${
                              isSelected
                                ? opt.isCorrect
                                  ? "border-emerald-400/70 bg-emerald-950/40 text-emerald-100"
                                  : "border-rose-400/70 bg-rose-950/40 text-rose-100"
                                : "border-white/12 bg-white/5 text-stone-200 hover:border-[#cda250]/60 hover:bg-white/10"
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
                        <strong>Umpan Balik:</strong> {chosenOpt.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "luring" && (
            <div className="space-y-5">
              {/* Printable Offline Worksheet Generator Card */}
              <div className="rounded-xl border border-[#cda250]/50 bg-[#071324]/85 p-5 space-y-4">
                <div>
                  <span className="font-brand text-[11px] tracking-widest text-[#f4d993] uppercase">
                    DUKUNGAN AKSES TERBATAS & BELAJAR MANDIRI
                  </span>
                  <h3 className="mt-1 font-serif text-lg sm:text-xl font-medium text-white">
                    Cetak Lembar Kerja Siswa (LKS) Luring & Rapor Kompetensi
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Sesuai analisis kondisi kelas (waktu terbatas dan ketersediaan perangkat digital belum merata), guru atau siswa dapat mencetak Lembar Kerja Terbimbing lengkap beserta Bank Kata Fantasi, Peta Lima Indera, Diagram Alur, dan Daftar Periksa Revisi untuk dikerjakan secara luring.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-300">Nama Siswa (Opsional):</span>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Contoh: Aruna Pratama"
                      className="w-full rounded-lg border border-white/20 bg-[#030712] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-300">Kelas:</span>
                    <input
                      type="text"
                      value={studentClass}
                      onChange={(e) => setStudentClass(e.target.value)}
                      placeholder="VII-A"
                      className="w-full rounded-lg border border-white/20 bg-[#030712] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handlePrintOfflineWorksheet}
                      className="w-full rounded-lg bg-[#cda250] px-4 py-2.5 text-xs font-brand font-semibold tracking-wider uppercase text-[#030712] transition-all hover:bg-[#f4d993] cursor-pointer"
                    >
                      Cetak LKS & Rapor (PDF/Print)
                    </button>
                  </div>
                </div>
              </div>

              {/* Fantasy Lexicon Bank Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FANTASY_LEXICON_BANK.map((cat) => (
                  <div
                    key={cat.id}
                    className="rounded-xl border border-white/15 bg-[#040915]/90 p-4 space-y-3"
                  >
                    <div>
                      <h4 className="font-serif text-base font-medium text-[#f4d993]">
                        {cat.category}
                      </h4>
                      <p className="text-xs text-stone-400">{cat.subtitle}</p>
                    </div>
                    <div className="space-y-2.5">
                      {cat.entries.map((entry) => (
                        <div
                          key={entry.word}
                          className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-white">{entry.word}</strong>
                            <span className="rounded bg-[#cda250]/20 px-2 py-0.5 text-[10px] text-[#f4d993]">
                              {entry.type}
                            </span>
                          </div>
                          <p className="text-stone-300">{entry.meaning}</p>
                          <p className="text-amber-200/85 italic">&ldquo;{entry.example}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
