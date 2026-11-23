import {
  formatAuthenticityLabel,
  type StudentSubmissionRecord,
} from "@/lib/submissions/submissionSchemas";

export const SHEET_TAB_REKAP = "Rekap_Nilai";
export const SHEET_TAB_NASKAH = "Naskah_Cerita";
export const SHEET_TAB_PETA = "Peta_Rancang_LKS";

export const SHEET_TABS = [
  SHEET_TAB_REKAP,
  SHEET_TAB_NASKAH,
  SHEET_TAB_PETA,
] as const;

export type SheetTabName = (typeof SHEET_TABS)[number];

/** 27 kolom (A..AA) untuk rekap utama guru & dosen FKIP */
export const REKAP_NILAI_HEADERS: readonly string[] = [
  "ID Pengumpulan",
  "Waktu Kumpul (WIB)",
  "Versi",
  "Kode Kelas",
  "Kelas",
  "No. Absen",
  "Nama Siswa",
  "Babak 1 - Alur & Amanat",
  "Babak 2 - Tokoh & Indra",
  "Babak 3 - Gaya Bahasa",
  "Kuis Bonus",
  "Skor Materi (60%)",
  "Skor Studio Tulis (40%)",
  "Nilai Total Holistik",
  "Kategori Kelayakan (PjBL)",
  "Segel Materi (x/3)",
  "Segel Studio",
  "Judul Cerita",
  "Tema Fantasi",
  "Jumlah Kata",
  "Indikator Lulus (x/5)",
  "Temuan EYD V",
  "Ceklis Revisi Mandiri",
  "Status Keaslian",
  "Link Baca Panel Guru",
  "Nilai Akhir Guru",
  "Catatan Guru",
];

/** 19 kolom (A..S) untuk pembacaan naskah cerita utuh langsung di Spreadsheet */
export const NASKAH_CERITA_HEADERS: readonly string[] = [
  "ID Pengumpulan",
  "Waktu Kumpul (WIB)",
  "Versi",
  "Kode Kelas",
  "Kelas",
  "No. Absen",
  "Nama Siswa",
  "Judul Cerita",
  "Tema Fantasi",
  "Jumlah Kata",
  "Paragraf Orientasi",
  "Paragraf Komplikasi",
  "Paragraf Klimaks",
  "Paragraf Resolusi",
  "Lembar Tambahan",
  "Naskah Cerita Utuh",
  "Amanat Cerita",
  "Refleksi Penulis",
  "Ringkasan 5 Indikator & EYD V",
];

/** 17 kolom (A..Q) untuk rekap proses pra-menulis (LKS / Peta Rancang) */
export const PETA_RANCANG_HEADERS: readonly string[] = [
  "ID Pengumpulan",
  "Waktu Kumpul (WIB)",
  "Versi",
  "Kode Kelas",
  "Kelas",
  "No. Absen",
  "Nama Siswa",
  "Aturan Dunia Fantasi",
  "Protagonis & Aksi Watak",
  "Antagonis & Pemicu Konflik",
  "Latar Tempat",
  "Indra Penglihatan",
  "Indra Pendengaran",
  "Indra Penciuman & Perabaan",
  "Kerangka Orientasi",
  "Kerangka Komplikasi & Klimaks",
  "Kerangka Resolusi & Refleksi Amanat Babak I",
];

const MAX_SHEET_CELL_CHARS = 49_000;

export function truncateSheetCell(value: string, maxChars = MAX_SHEET_CELL_CHARS): string {
  if (value.length <= maxChars) return value;
  const suffix = "\n...[dipotong: >49rb huruf]";
  if (maxChars <= suffix.length) return value.slice(0, Math.max(0, maxChars));
  return `${value.slice(0, maxChars - suffix.length)}${suffix}`;
}

export function formatTimestampWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return iso;
  }
}

export function buildTeacherPanelLink(
  submissionId: string,
  baseUrl?: string | null
): string {
  const cleanBase = baseUrl?.trim().replace(/\/+$/, "");
  if (!cleanBase) return `/guru?karya=${encodeURIComponent(submissionId)}`;
  return `${cleanBase}/guru?karya=${encodeURIComponent(submissionId)}`;
}

export function buildRekapNilaiRow(
  record: StudentSubmissionRecord,
  options: { readonly baseUrl?: string | null; readonly includeTeacherColumns?: boolean } = {}
): (string | number)[] {
  const baseCols: (string | number)[] = [
    record.submissionId,
    formatTimestampWib(record.submittedAtIso),
    `v${record.version}`,
    record.classCode,
    record.authorClass,
    record.absenNumber || "-",
    record.authorName,
    record.metrics.babak1Score,
    record.metrics.babak2Score,
    record.metrics.babak3Score,
    record.metrics.questScore,
    record.metrics.overallPercentage,
    record.metrics.babak4Score,
    record.metrics.holisticTotalPercentage,
    record.metrics.kelayakanCategory,
    `${record.metrics.unlockedSealsCount}/3`,
    record.analysis.isReadyForSeal ? "Lulus Segel" : "Belum Lengkap",
    truncateSheetCell(record.storyTitle, 300),
    truncateSheetCell(record.themeCategory, 200),
    record.analysis.totalWords,
    `${record.analysis.passedIndicatorsCount}/5`,
    record.analysis.eydIssuesCount,
    `${record.analysis.revisionCheckedCount}/${record.analysis.totalRevisionChecklistCount}`,
    formatAuthenticityLabel(record.analysis.authenticityStatus),
    buildTeacherPanelLink(record.submissionId, options.baseUrl),
  ];

  if (options.includeTeacherColumns !== false) {
    baseCols.push(
      record.teacherReview.teacherScore !== null
        ? record.teacherReview.teacherScore
        : "",
      truncateSheetCell(record.teacherReview.teacherFeedback, 4000)
    );
  }

  return baseCols;
}

export function buildNaskahCeritaRow(
  record: StudentSubmissionRecord
): (string | number)[] {
  const extraSpreadsText = (record.draft.extraSpreads ?? [])
    .map((sp, idx) => {
      const parts: string[] = [];
      if (sp.leftText.trim()) {
        parts.push(`[Lembar +${idx + 1} Kiri · ${sp.leftTitle || "Lanjutan"}]\n${sp.leftText.trim()}`);
      }
      if (sp.rightText.trim()) {
        parts.push(`[Lembar +${idx + 1} Kanan · ${sp.rightTitle || "Lanjutan"}]\n${sp.rightText.trim()}`);
      }
      return parts.join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const indicatorSummary = record.analysis.indicators
    .map((ind) => `${ind.passed ? "[LULUS]" : "[BELUM]"} ${ind.tpCode} ${ind.title} (${ind.earnedScore}/${ind.scoreWeight})`)
    .join("; ");

  const eydSummary =
    record.analysis.eydAndLexiconIssues.length === 0
      ? "EYD V: 0 temuan ejaan."
      : `EYD V (${record.analysis.eydAndLexiconIssues.length} temuan): ${record.analysis.eydAndLexiconIssues
          .slice(0, 8)
          .map((i) => `"${i.foundText}" -> "${i.suggestion}"`)
          .join("; ")}`;

  return [
    record.submissionId,
    formatTimestampWib(record.submittedAtIso),
    `v${record.version}`,
    record.classCode,
    record.authorClass,
    record.absenNumber || "-",
    record.authorName,
    truncateSheetCell(record.storyTitle, 300),
    truncateSheetCell(record.themeCategory, 200),
    record.analysis.totalWords,
    truncateSheetCell(record.draft.paragraphOrientasi.trim()),
    truncateSheetCell((record.draft.paragraphKomplikasi ?? "").trim()),
    truncateSheetCell(record.draft.paragraphKlimaks.trim()),
    truncateSheetCell(record.draft.paragraphResolusi.trim()),
    truncateSheetCell(extraSpreadsText),
    truncateSheetCell(record.fullStoryText),
    truncateSheetCell(record.draft.amanat.trim(), 4000),
    truncateSheetCell((record.draft.authorReflection ?? "").trim(), 4000),
    truncateSheetCell(`${indicatorSummary}\n${eydSummary}`, 8000),
  ];
}

export function buildPetaRancangRow(
  record: StudentSubmissionRecord
): (string | number)[] {
  const protagonis = [
    record.draft.protagonistName.trim(),
    record.draft.protagonistTraitAction.trim(),
  ]
    .filter(Boolean)
    .join(" — ");

  const antagonis = [
    record.draft.antagonistName.trim(),
    record.draft.antagonistConflictTrigger.trim(),
  ]
    .filter(Boolean)
    .join(" — ");

  const resolusiDanAmanat = [
    record.draft.outlineResolusi.trim(),
    record.customAmanatReflection
      ? `[Refleksi Amanat Babak I]: ${record.customAmanatReflection}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    record.submissionId,
    formatTimestampWib(record.submittedAtIso),
    `v${record.version}`,
    record.classCode,
    record.authorClass,
    record.absenNumber || "-",
    record.authorName,
    truncateSheetCell(record.draft.worldRule.trim(), 4000),
    truncateSheetCell(protagonis, 4000),
    truncateSheetCell(antagonis, 4000),
    truncateSheetCell(record.draft.settingPlace.trim(), 1000),
    truncateSheetCell(record.draft.sensorySight.trim(), 2000),
    truncateSheetCell(record.draft.sensorySound.trim(), 2000),
    truncateSheetCell(record.draft.sensorySmellTouch.trim(), 2000),
    truncateSheetCell(record.draft.outlineOrientasi.trim(), 4000),
    truncateSheetCell(record.draft.outlineKomplikasiKlimaks.trim(), 4000),
    truncateSheetCell(resolusiDanAmanat, 5000),
  ];
}

/**
 * Mencegah CSV/Excel Formula Injection (`=`, `+`, `-`, `@`) sambil mempertahankan
 * angka murni dan format RFC 4180 agar Microsoft Excel Windows membukanya tanpa rusak.
 */
export function escapeCsvCell(value: string | number): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Menghasilkan file CSV ber-UTF-8 BOM yang mencakup rekap nilai, naskah utuh,
 * dan ringkasan Peta Rancang untuk unduhan cadangan offline guru.
 */
export function buildTeacherExportCsv(
  records: readonly StudentSubmissionRecord[],
  baseUrl?: string | null
): string {
  const headers: readonly string[] = [
    ...REKAP_NILAI_HEADERS,
    "Aturan Dunia Fantasi",
    "Tokoh Protagonis",
    "Tokoh Antagonis",
    "Latar Tempat",
    "Naskah Cerita Utuh",
    "Amanat Cerita",
    "Refleksi Penulis",
  ];

  const lines: string[] = [headers.map((h) => escapeCsvCell(h)).join(",")];

  for (const record of records) {
    const rekapCols = buildRekapNilaiRow(record, {
      baseUrl,
      includeTeacherColumns: true,
    });
    const extraCols: (string | number)[] = [
      record.draft.worldRule.trim(),
      [record.draft.protagonistName.trim(), record.draft.protagonistTraitAction.trim()]
        .filter(Boolean)
        .join(" - "),
      [record.draft.antagonistName.trim(), record.draft.antagonistConflictTrigger.trim()]
        .filter(Boolean)
        .join(" - "),
      record.draft.settingPlace.trim(),
      record.fullStoryText,
      record.draft.amanat.trim(),
      (record.draft.authorReflection ?? "").trim(),
    ];

    lines.push([...rekapCols, ...extraCols].map((cell) => escapeCsvCell(cell)).join(","));
  }

  // UTF-8 BOM ensures Excel on Windows decodes Indonesian characters properly.
  return `\uFEFF${lines.join("\r\n")}`;
}
