"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  type ClassroomRecord,
  type StudentSubmissionRecord,
} from "@/lib/submissions/submissionSchemas";
import { CoachMarkBadge, TeacherTooltip } from "./TeacherTooltip";

interface TeacherStats {
  readonly totalStudents: number;
  readonly avgHolisticScore: number;
  readonly avgStudioScore: number;
  readonly originalCount: number;
  readonly presetWarningCount: number;
  readonly syncedCount: number;
  readonly unsyncedCount: number;
  readonly featuredCount: number;
}

interface TeacherDashboardClientProps {
  readonly initialConfigured: boolean;
  readonly initialAuthenticated: boolean;
  readonly initialDatabaseConfigured: boolean;
  readonly initialSheetsConfigured: boolean;
  readonly initialSheetsMode: string;
  readonly initialSpreadsheetUrl: string | null;
  readonly initialSelectedSubmissionId: string | null;
}

type GuruTab = "rekap" | "galeri" | "kelas";
type TourTargetId = "kpi" | "filters" | "table" | "tabs" | "actions";

interface GuruTourStep {
  readonly target: TourTargetId;
  readonly badge: string;
  readonly title: string;
  readonly body: string;
  readonly tip: string;
  readonly switchTab?: GuruTab;
}

const GURU_TOUR_STORAGE_KEY = "aksaraloka:guru-tour-done:v1";
const guruTourListeners = new Set<() => void>();

function subscribeGuruTour(cb: () => void): () => void {
  guruTourListeners.add(cb);
  return () => {
    guruTourListeners.delete(cb);
  };
}

function notifyGuruTourListeners(): void {
  for (const cb of guruTourListeners) {
    cb();
  }
}

function getGuruTourDoneClientSnapshot(): boolean {
  try {
    return window.localStorage.getItem(GURU_TOUR_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function getGuruTourDoneServerSnapshot(): boolean {
  // Always true during SSR & initial hydration so server and client HTML match 100%
  return true;
}

const GURU_TOUR_STEPS: readonly GuruTourStep[] = [
  {
    target: "kpi",
    badge: "Ringkasan Cepat",
    title: "Pantau Kondisi Kelas dalam Sekejap",
    body: "Empat kartu ini merangkum jumlah siswa yang sudah mengumpulkan, rata-rata nilai kelas, berapa karya yang sudah masuk ke Google Sheets, serta karya pilihan galeri.",
    tip: "Arahkan kursor atau ketuk tanda tanya (?) di setiap kartu untuk melihat penjelasan singkatnya.",
    switchTab: "rekap",
  },
  {
    target: "filters",
    badge: "Saring & Cari",
    title: "Temukan Siswa atau Kelas dengan Cepat",
    body: "Gunakan kotak pencarian untuk mencari nama siswa atau judul cerita. Bapak/Ibu juga bisa menyaring berdasarkan kode kelas atau status pengiriman ke Google Sheets.",
    tip: "Jika siswa baru saja mengumpulkan tugas, tekan tombol 'Segarkan Data' untuk memuat hasil terbaru.",
    switchTab: "rekap",
  },
  {
    target: "table",
    badge: "Baca & Beri Nilai",
    title: "Baca Cerita Utuh & Beri Nilai Akhir Guru",
    body: "Tekan tombol 'Baca & Nilai' pada baris siswa untuk membuka lembaran cerita fantasi yang nyaman dibaca, lengkap dengan Peta Rancang, catatan EYD V, dan kolom nilai guru.",
    tip: "Nilai akhir dan catatan yang Bapak/Ibu simpan di sini akan otomatis ikut mengisi kolom Guru di Google Sheets.",
    switchTab: "rekap",
  },
  {
    target: "tabs",
    badge: "Galeri & Kode Kelas",
    title: "Tampilkan Galeri Kelas & Atur Kode Kelas",
    body: "Gunakan tab 'Galeri Apresiasi Kelas' untuk menampilkan cerita terbaik siswa di layar kelas, dan tab 'Atur Kode Kelas' bila ingin memisahkan pengumpulan antar kelas (misalnya VII-A dan VII-B).",
    tip: "Tandai karya terbaik lewat centang 'Karya Pilihan' saat membaca naskah siswa.",
    switchTab: "rekap",
  },
  {
    target: "actions",
    badge: "Google Sheets & Excel",
    title: "Buka Google Sheets atau Unduh Arsip Excel",
    body: "Semua hasil karya siswa otomatis diteruskan ke Google Sheets (3 tab: Rekap Nilai, Naskah Cerita, dan Peta Rancang). Bapak/Ibu juga bisa mengunduh cadangan Excel kapan saja.",
    tip: "Jika ada kiriman yang tertunda saat jaringan sekolah sibuk, cukup tekan 'Kirim Ulang ke Sheets'.",
  },
];

function formatWibDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Mengizinkan guru menempelkan tautan Google Sheets penuh ATAU ID langsung
 * tanpa harus memahami apa itu "Spreadsheet ID".
 */
function extractSpreadsheetIdFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{10,120})/);
  if (urlMatch?.[1]) return urlMatch[1];
  return trimmed;
}

function getAuthenticityBadge(status: StudentSubmissionRecord["analysis"]["authenticityStatus"]): {
  readonly label: string;
  readonly hint: string;
  readonly className: string;
} {
  if (status === "orisinal") {
    return {
      label: "Karya Asli",
      hint: "Ditulis sendiri oleh siswa dan tidak mengandung bagian rumpang [...].",
      className:
        "bg-emerald-950/75 text-emerald-200 border border-emerald-400/40",
    };
  }
  if (status === "teks_contoh_preset") {
    return {
      label: "Masih Teks Contoh",
      hint: "Siswa mengumpulkan contoh cerita bawaan tanpa mengubah isinya menjadi cerita sendiri.",
      className: "bg-amber-950/80 text-amber-200 border border-amber-400/50",
    };
  }
  return {
    label: "Belum Lengkap",
    hint: "Masih ada bagian bertanda [...] di dalam cerita yang belum diisi siswa.",
    className: "bg-amber-950/70 text-amber-200 border border-amber-400/40",
  };
}

function getSheetStatusBadge(status: StudentSubmissionRecord["sheetSync"]["status"]): {
  readonly label: string;
  readonly hint: string;
  readonly className: string;
} {
  if (status === "synced") {
    return {
      label: "Masuk Sheets",
      hint: "Nilai, cerita utuh, dan Peta Rancang siswa ini sudah tercatat di Google Sheets.",
      className: "bg-sky-950/75 text-sky-200 border border-sky-400/40",
    };
  }
  if (status === "failed") {
    return {
      label: "Perlu Kirim Ulang",
      hint: "Karya aman tersimpan di Ruang Guru, tetapi pengiriman ke Google Sheets sempat tertunda.",
      className: "bg-rose-950/75 text-rose-200 border border-rose-400/45",
    };
  }
  if (status === "pending") {
    return {
      label: "Menunggu",
      hint: "Sedang menunggu pengiriman ke Google Sheets.",
      className: "bg-stone-800/90 text-stone-200 border border-white/15",
    };
  }
  return {
    label: "Belum Terhubung",
    hint: "Tautan Google Sheets belum diaktifkan oleh pengelola aplikasi.",
    className: "bg-stone-800/80 text-stone-300 border border-white/10",
  };
}

export function TeacherDashboardClient({
  initialConfigured,
  initialAuthenticated,
  initialDatabaseConfigured,
  initialSheetsConfigured,
  initialSheetsMode,
  initialSpreadsheetUrl,
  initialSelectedSubmissionId,
}: TeacherDashboardClientProps) {
  const [configured] = useState(initialConfigured);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [databaseConfigured, setDatabaseConfigured] = useState(
    initialDatabaseConfigured
  );
  const [sheetsConfigured, setSheetsConfigured] = useState(initialSheetsConfigured);
  const [sheetsMode, setSheetsMode] = useState(initialSheetsMode);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(
    initialSpreadsheetUrl
  );

  // Login form
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Guided Onboarding / Product Tour (SSR-safe via useSyncExternalStore)
  const isTourDoneInStorage = useSyncExternalStore(
    subscribeGuruTour,
    getGuruTourDoneClientSnapshot,
    getGuruTourDoneServerSnapshot
  );
  // null = ikut status localStorage (otomatis mulai di langkah 0 setelah hydrate), -1 = ditutup manual
  const [manualTourStep, setManualTourStep] = useState<number | null>(null);
  const tourStepIndex: number | null =
    manualTourStep === -1
      ? null
      : manualTourStep !== null
        ? manualTourStep
        : isTourDoneInStorage
          ? null
          : 0;

  // Refs for smooth auto-scroll during interactive tour
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const kpiRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLElement | null>(null);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<GuruTab>("rekap");
  const [submissions, setSubmissions] = useState<StudentSubmissionRecord[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRecord[]>([]);
  const [stats, setStats] = useState<TeacherStats>({
    totalStudents: 0,
    avgHolisticScore: 0,
    avgStudioScore: 0,
    originalCount: 0,
    presetWarningCount: 0,
    syncedCount: 0,
    unsyncedCount: 0,
    featuredCount: 0,
  });
  const [filterClassCode, setFilterClassCode] = useState<string>("ALL");
  const [filterSyncStatus, setFilterSyncStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loadedListKey, setLoadedListKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  // Detail reader & teacher review state
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedSubmissionId
  );
  const [detailRefreshTick, setDetailRefreshTick] = useState<number>(0);
  const [selectedDetail, setSelectedDetail] =
    useState<StudentSubmissionRecord | null>(null);
  const [selectedRevisions, setSelectedRevisions] = useState<
    StudentSubmissionRecord[]
  >([]);
  const [loadedDetailKey, setLoadedDetailKey] = useState<string | null>(null);
  const [reviewScoreInput, setReviewScoreInput] = useState<string>("");
  const [reviewFeedbackInput, setReviewFeedbackInput] = useState<string>("");
  const [reviewFeaturedInput, setReviewFeaturedInput] = useState<boolean>(false);
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [isSyncingOne, setIsSyncingOne] = useState<boolean>(false);

  // Classroom management form
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newClassSheetInput, setNewClassSheetInput] = useState("");
  const [isSavingClass, setIsSavingClass] = useState(false);

  const showBanner = useCallback((msg: string) => {
    setBannerMessage(msg);
  }, []);

  const currentListKey = `${filterClassCode}|${filterSyncStatus}|${searchQuery.trim()}|${refreshTick}`;
  const isLoadingList = authenticated && loadedListKey !== currentListKey;
  const currentDetailKey = selectedId ? `${selectedId}|${detailRefreshTick}` : null;
  const isLoadingDetail =
    authenticated && currentDetailKey !== null && loadedDetailKey !== currentDetailKey;

  const triggerReloadDashboard = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const triggerReloadDetail = useCallback(() => {
    setDetailRefreshTick((t) => t + 1);
  }, []);

  const finishTour = useCallback(() => {
    setManualTourStep(-1);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(GURU_TOUR_STORAGE_KEY, "1");
      } catch {
        // Ignore storage errors
      }
      notifyGuruTourListeners();
    }
  }, []);

  const startTour = useCallback(() => {
    setSelectedId(null);
    setSelectedDetail(null);
    setActiveTab("rekap");
    setManualTourStep(0);
  }, []);

  const activeTourStep =
    authenticated && tourStepIndex !== null
      ? GURU_TOUR_STEPS[tourStepIndex] ?? null
      : null;

  // Scroll the highlighted coach-mark target gently into view during the tour
  useEffect(() => {
    if (!activeTourStep) return;
    const map: Record<TourTargetId, HTMLElement | null> = {
      actions: actionsRef.current,
      kpi: kpiRef.current,
      tabs: tabsRef.current,
      filters: filtersRef.current,
      table: tableRef.current,
    };
    const el = map[activeTourStep.target];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeTourStep]);

  // Escape closes detail modal or active tour
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedId) {
        setSelectedId(null);
        setSelectedDetail(null);
      } else if (tourStepIndex !== null) {
        finishTour();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, tourStepIndex, finishTour]);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    const qs = new URLSearchParams();
    if (filterClassCode !== "ALL") qs.set("classCode", filterClassCode);
    if (filterSyncStatus !== "ALL") qs.set("syncStatus", filterSyncStatus);
    if (searchQuery.trim()) qs.set("search", searchQuery.trim());

    fetch(`/api/teacher/submissions?${qs.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        const data = (await res.json()) as {
          error?: string;
          databaseConfigured?: boolean;
          sheetsConfigured?: boolean;
          sheetsMode?: string;
          spreadsheetUrl?: string | null;
          submissions?: StudentSubmissionRecord[];
          classrooms?: ClassroomRecord[];
          stats?: TeacherStats;
        };
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setListError(
            data.error ?? "Belum berhasil memuat daftar karya siswa. Coba segarkan kembali."
          );
          setLoadedListKey(currentListKey);
          return;
        }
        setListError(null);
        setDatabaseConfigured(Boolean(data.databaseConfigured));
        setSheetsConfigured(Boolean(data.sheetsConfigured));
        if (data.sheetsMode) setSheetsMode(data.sheetsMode);
        setSpreadsheetUrl(data.spreadsheetUrl ?? null);
        setSubmissions(data.submissions ?? []);
        setClassrooms(data.classrooms ?? []);
        if (data.stats) setStats(data.stats);
        setLoadedListKey(currentListKey);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        void err;
        setListError("Koneksi terganggu saat memuat data. Silakan tekan 'Segarkan Data'.");
        setLoadedListKey(currentListKey);
      });

    return () => controller.abort();
  }, [
    authenticated,
    filterClassCode,
    filterSyncStatus,
    searchQuery,
    refreshTick,
    currentListKey,
  ]);

  useEffect(() => {
    if (!authenticated || !selectedId || !currentDetailKey) return;
    const controller = new AbortController();

    fetch(`/api/teacher/submissions/${encodeURIComponent(selectedId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!res.ok) {
          setLoadedDetailKey(currentDetailKey);
          return;
        }
        const data = (await res.json()) as {
          submission: StudentSubmissionRecord;
          revisions: StudentSubmissionRecord[];
        };
        if (controller.signal.aborted) return;
        setSelectedDetail(data.submission);
        setSelectedRevisions(data.revisions ?? []);
        setReviewScoreInput(
          data.submission.teacherReview.teacherScore !== null
            ? String(data.submission.teacherReview.teacherScore)
            : ""
        );
        setReviewFeedbackInput(data.submission.teacherReview.teacherFeedback);
        setReviewFeaturedInput(data.submission.teacherReview.isFeaturedInGallery);
        setLoadedDetailKey(currentDetailKey);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        void err;
        setLoadedDetailKey(currentDetailKey);
      });

    return () => controller.abort();
  }, [authenticated, selectedId, currentDetailKey]);

  const availableClassCodes = useMemo(() => {
    const set = new Set<string>();
    for (const c of classrooms) set.add(c.classCode);
    for (const s of submissions) set.add(s.classCode);
    return Array.from(set).sort();
  }, [classrooms, submissions]);

  const gallerySubmissions = useMemo(() => {
    const featured = submissions.filter(
      (s) => s.teacherReview.isFeaturedInGallery
    );
    return featured.length > 0 ? featured : submissions;
  }, [submissions]);

  const hasActiveFilters =
    filterClassCode !== "ALL" ||
    filterSyncStatus !== "ALL" ||
    searchQuery.trim().length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/teacher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        databaseConfigured?: boolean;
        sheetsConfigured?: boolean;
        sheetsMode?: string;
        spreadsheetUrl?: string | null;
      };
      if (!res.ok || !data.ok) {
        setAuthError(data.error ?? "Kata sandi guru belum sesuai. Silakan coba lagi.");
        return;
      }
      setAccessCode("");
      setAuthenticated(true);
      setDatabaseConfigured(Boolean(data.databaseConfigured));
      setSheetsConfigured(Boolean(data.sheetsConfigured));
      if (data.sheetsMode) setSheetsMode(data.sheetsMode);
      setSpreadsheetUrl(data.spreadsheetUrl ?? null);
    } catch {
      setAuthError("Tidak dapat terhubung ke layanan. Periksa koneksi internet Bapak/Ibu.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/teacher/auth", { method: "DELETE" });
    setAuthenticated(false);
    setSelectedDetail(null);
    setSelectedId(null);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || isSavingReview) return;

    let parsedScore: number | null = null;
    if (reviewScoreInput.trim() !== "") {
      const num = Number(reviewScoreInput.trim());
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        showBanner("Nilai Akhir Guru harus berupa angka antara 0 sampai 100.");
        return;
      }
      parsedScore = Math.round(num);
    }

    setIsSavingReview(true);
    try {
      const res = await fetch(
        `/api/teacher/submissions/${encodeURIComponent(selectedDetail.submissionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherScore: parsedScore,
            teacherFeedback: reviewFeedbackInput.trim(),
            isFeaturedInGallery: reviewFeaturedInput,
          }),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        submission?: StudentSubmissionRecord;
      };
      if (!res.ok || !data.ok || !data.submission) {
        showBanner(data.error ?? "Belum berhasil menyimpan penilaian guru.");
        return;
      }
      setSelectedDetail(data.submission);
      showBanner(
        data.submission.sheetSync.status === "synced"
          ? `Nilai & catatan untuk ${data.submission.authorName} berhasil disimpan dan langsung diperbarui di Google Sheets.`
          : `Nilai & catatan untuk ${data.submission.authorName} berhasil disimpan di Ruang Guru.`
      );
      triggerReloadDashboard();
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleSyncSheets = async (submissionId?: string) => {
    if (submissionId) {
      setIsSyncingOne(true);
    } else {
      setIsSyncingAll(true);
    }
    try {
      const res = await fetch("/api/teacher/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionId ? { submissionId } : {}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        attempted?: number;
        synced?: number;
        failed?: number;
      };
      if (!res.ok || !data.ok) {
        showBanner(data.error ?? "Pengiriman ulang ke Google Sheets belum berhasil.");
        return;
      }
      if ((data.attempted ?? 0) === 0) {
        showBanner("Semua karya siswa sudah masuk ke Google Sheets. Tidak ada data tertunda.");
      } else {
        showBanner(
          `Selesai mengirim ke Google Sheets: ${data.synced ?? 0} berhasil${
            (data.failed ?? 0) > 0 ? `, ${data.failed} masih tertunda` : ""
          }.`
        );
      }
      triggerReloadDashboard();
      if (selectedId) {
        triggerReloadDetail();
      }
    } finally {
      setIsSyncingAll(false);
      setIsSyncingOne(false);
    }
  };

  const handleCreateOrUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingClass) return;
    setIsSavingClass(true);
    try {
      const cleanSheetId = extractSpreadsheetIdFromInput(newClassSheetInput);
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classCode: newClassCode.trim().toUpperCase(),
          className: newClassName.trim(),
          teacherName: newTeacherName.trim(),
          spreadsheetId: cleanSheetId,
          isActive: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        classroom?: ClassroomRecord;
      };
      if (!res.ok || !data.ok || !data.classroom) {
        showBanner(data.error ?? "Kode kelas belum berhasil disimpan.");
        return;
      }
      setNewClassCode("");
      setNewClassName("");
      setNewTeacherName("");
      setNewClassSheetInput("");
      showBanner(
        `Kode kelas "${data.classroom.classCode}" (${data.classroom.className}) siap dibagikan ke siswa.`
      );
      triggerReloadDashboard();
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleToggleClassroomActive = async (cls: ClassroomRecord) => {
    const res = await fetch("/api/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classCode: cls.classCode,
        className: cls.className,
        teacherName: cls.teacherName,
        spreadsheetId: cls.spreadsheetId ?? "",
        isActive: !cls.isActive,
      }),
    });
    if (res.ok) {
      showBanner(
        `Pengumpulan untuk kelas "${cls.classCode}" sekarang ${
          !cls.isActive ? "dibuka kembali" : "ditutup sementara"
        }.`
      );
      triggerReloadDashboard();
    }
  };

  const exportCsvUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (filterClassCode !== "ALL") qs.set("classCode", filterClassCode);
    return `/api/teacher/export?${qs.toString()}`;
  }, [filterClassCode]);

  const highlightRing = (target: TourTargetId) =>
    activeTourStep?.target === target
      ? "relative z-20 ring-2 ring-[#f4d993] ring-offset-4 ring-offset-[#030712] shadow-[0_0_36px_rgba(244,217,147,0.22)] transition-all duration-300"
      : "transition-all duration-300";

  const goToTourStep = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(GURU_TOUR_STEPS.length - 1, nextIdx));
    const step = GURU_TOUR_STEPS[clamped];
    if (step?.switchTab) {
      setActiveTab(step.switchTab);
    }
    setManualTourStep(clamped);
  };

  // ============================================================================
  // HALAMAN MASUK RUANG GURU (RAMAH GURU NON-DEVELOPER)
  // ============================================================================
  if (!authenticated) {
    return (
      <div className="min-h-dvh bg-[#030712] text-stone-100 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-[#cda250]/45 bg-[#070d19] p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.8)] space-y-6">
          {/* Header salam hangat */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cda250]/40 bg-[#0d1629] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#f4d993]">
              Aksaraloka · Bahasa Indonesia Kelas VII
            </div>
            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-[#f4d993] leading-tight">
              Ruang Guru Aksaraloka
            </h1>
            <p className="text-sm leading-relaxed text-stone-300">
              Selamat datang, Bapak/Ibu Guru. Masuk untuk membaca cerita fantasi siswa
              secara utuh, memeriksa Peta Rancang dan ejaan EYD V, memberi nilai akhir,
              serta membuka rekap Google Sheets.
            </p>
          </div>

          {!configured ? (
            <div className="rounded-2xl border border-amber-400/45 bg-amber-950/35 p-4 text-sm leading-relaxed text-amber-100 space-y-3">
              <p className="font-bold text-[#f4d993]">
                Akses Ruang Guru Belum Diaktifkan
              </p>
              <p className="text-xs sm:text-sm text-amber-100/90">
                Kata sandi khusus guru belum diatur oleh pengelola media. Silakan hubungi
                pengelola aplikasi sekolah atau tim pembuat Aksaraloka untuk mengaktifkannya.
              </p>
              <details className="rounded-xl border border-amber-400/25 bg-black/25 px-3.5 py-2.5 text-xs text-stone-300">
                <summary className="cursor-pointer font-semibold text-amber-200">
                  Catatan Teknis untuk Pengelola / Admin
                </summary>
                <p className="mt-2 leading-relaxed">
                  Atur <code className="text-[#f4d993]">TEACHER_ACCESS_CODE</code> (minimal
                  4 karakter) di berkas <code className="text-[#f4d993]">.env.local</code>{" "}
                  atau pengaturan Environment Variables Vercel, lalu muat ulang server.
                </p>
              </details>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-access-code"
                  className="block text-sm font-semibold text-[#f4d993]"
                >
                  Kata Sandi Guru
                </label>
                <div className="relative">
                  <input
                    id="teacher-access-code"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Ketik kata sandi khusus guru..."
                    className="h-11 w-full rounded-xl border border-white/20 bg-black/45 pl-4 pr-24 text-sm text-white placeholder:text-stone-400 focus:border-[#f4d993] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-stone-300 hover:text-white cursor-pointer"
                  >
                    {showPassword ? "Tutup" : "Lihat"}
                  </button>
                </div>
                <p className="text-xs text-stone-400">
                  Gunakan kata sandi yang dibagikan pengelola media pembelajaran.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-400/50 bg-rose-950/55 px-4 py-2.5 text-xs sm:text-sm text-rose-100"
                >
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="h-11 w-full rounded-full bg-[#f4d993] hover:bg-white text-sm font-bold text-[#030712] shadow-lg shadow-[#cda250]/15 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isLoggingIn ? "Sedang Memeriksa..." : "Masuk ke Ruang Guru ->"}
              </button>
            </form>
          )}

          {/* Status layanan dengan bahasa manusiawi */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                    databaseConfigured
                      ? "bg-emerald-950/70 text-emerald-200 border border-emerald-400/35"
                      : "bg-stone-800 text-stone-300 border border-white/10"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      databaseConfigured ? "bg-emerald-400" : "bg-stone-500"
                    }`}
                  />
                  Penyimpanan Karya: {databaseConfigured ? "Siap" : "Belum Aktif"}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                    sheetsConfigured
                      ? "bg-sky-950/70 text-sky-200 border border-sky-400/35"
                      : "bg-stone-800 text-stone-300 border border-white/10"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      sheetsConfigured ? "bg-sky-400" : "bg-stone-500"
                    }`}
                  />
                  Google Sheets: {sheetsConfigured ? "Terhubung" : "Belum Ditautkan"}
                </span>
              </div>

              <Link
                href="/"
                className="font-semibold text-[#f4d993] hover:underline no-underline whitespace-nowrap"
              >
                &lt;- Halaman Siswa
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DASBOR RUANG GURU TERAUTENTIKASI
  // ============================================================================
  const activeTabMicrocopy: Record<GuruTab, string> = {
    rekap:
      "Klik tombol 'Baca & Nilai' pada baris siswa untuk membaca cerita utuhnya, memeriksa ejaan EYD V, dan memasukkan nilai akhir guru.",
    galeri:
      "Kumpulan cerita fantasi siswa dalam tampilan kartu rapi — cocok ditampilkan di layar proyektor saat sesi apresiasi dan refleksi kelas.",
    kelas:
      "Buat kode kelas (misalnya VII-A-2026) untuk ditulis di papan tulis agar hasil pengumpulan tiap kelas langsung terkelompok rapi.",
  };

  return (
    <div
      className={`min-h-dvh bg-[#030712] text-stone-100 ${
        activeTourStep ? "pb-64 sm:pb-48" : "pb-14"
      }`}
    >
      {/* Header Atas */}
      <header className="sticky top-0 z-30 border-b border-[#cda250]/25 bg-[#050a15]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:border-[#f4d993]/60 hover:text-white no-underline whitespace-nowrap"
            >
              &lt;- Halaman Siswa
            </Link>
            <div className="min-w-0">
              <p className="font-brand text-[10px] font-bold uppercase tracking-[0.2em] text-[#cda250] truncate">
                Aksaraloka · Bahasa Indonesia Kelas VII
              </p>
              <h1 className="font-brand text-base sm:text-lg font-bold text-[#f4d993] truncate">
                Ruang Guru &amp; Penilaian Karya
              </h1>
            </div>
          </div>

          {/* Tombol Aksi Utama (Coach Mark Target: actions) */}
          <div
            ref={actionsRef}
            className={`flex flex-wrap items-center gap-2 rounded-2xl ${
              activeTourStep?.target === "actions" ? "p-1.5 bg-[#091224]" : ""
            } ${highlightRing("actions")}`}
          >
            <button
              type="button"
              onClick={startTour}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cda250]/55 bg-[#0b1528] hover:bg-[#132240] px-3.5 py-1.5 text-xs font-bold text-[#f4d993] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#f4d993] text-[10px] font-extrabold text-[#030712]">
                ?
              </span>
              Panduan Cepat
            </button>

            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/55 bg-emerald-950/70 hover:bg-emerald-900/80 px-3.5 py-1.5 text-xs font-bold text-emerald-100 no-underline transition-colors whitespace-nowrap"
              >
                Buka Google Sheets -&gt;
              </a>
            )}

            {sheetsConfigured && (
              <button
                type="button"
                onClick={() => void handleSyncSheets()}
                disabled={isSyncingAll}
                title="Mengirim ulang karya siswa yang belum masuk ke Google Sheets"
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  stats.unsyncedCount > 0
                    ? "border border-amber-400/60 bg-amber-950/70 hover:bg-amber-900/80 text-amber-100"
                    : "border border-white/15 bg-white/5 hover:bg-white/10 text-stone-200"
                }`}
              >
                {isSyncingAll
                  ? "Sedang Mengirim..."
                  : stats.unsyncedCount > 0
                    ? `Kirim Ulang ke Sheets (${stats.unsyncedCount})`
                    : "Perbarui Google Sheets"}
              </button>
            )}

            {databaseConfigured && (
              <a
                href={exportCsvUrl}
                title="Mengunduh seluruh rekap nilai dan naskah cerita dalam berkas siap buka di Microsoft Excel"
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-stone-100 no-underline transition-colors whitespace-nowrap"
              >
                Unduh Rekap Excel
              </a>
            )}

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-full border border-rose-400/40 bg-rose-950/45 hover:bg-rose-900/65 px-3.5 py-1.5 text-xs font-semibold text-rose-200 cursor-pointer whitespace-nowrap"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Notifikasi Aksi */}
        {bannerMessage && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#cda250]/50 bg-[#0d182d] px-4 py-3 text-sm text-[#f4d993]"
          >
            <span>{bannerMessage}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              aria-label="Tutup pemberitahuan"
              className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-stone-300 hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Pemberitahuan ramah bila layanan penyimpanan/Sheets belum ditautkan */}
        {(!databaseConfigured || !sheetsConfigured) && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-950/30 px-4 py-3.5 text-xs sm:text-sm text-amber-100 space-y-2">
            <p className="font-semibold text-[#f4d993]">
              Pengaturan Layanan Belum Lengkap
            </p>
            <p className="leading-relaxed text-amber-100/90">
              {!databaseConfigured && !sheetsConfigured
                ? "Penyimpanan karya daring dan tautan Google Sheets belum diaktifkan. Hubungi pengelola aplikasi agar hasil pengumpulan siswa dapat masuk otomatis."
                : !databaseConfigured
                  ? "Penyimpanan karya daring belum diaktifkan oleh pengelola aplikasi, sehingga daftar karya belum dapat tampil di halaman ini."
                  : "Karya siswa sudah tersimpan aman di Ruang Guru, namun tautan otomatis ke Google Sheets belum diaktifkan. Bapak/Ibu tetap dapat memakai tombol 'Unduh Rekap Excel'."}
            </p>
            <details className="rounded-xl border border-amber-400/25 bg-black/25 px-3 py-2 text-xs text-stone-300">
              <summary className="cursor-pointer font-semibold text-amber-200">
                Info Teknis untuk Pengelola ({sheetsMode})
              </summary>
              <p className="mt-1.5 leading-relaxed">
                Lengkapi <code>MONGODB_URI</code> dan kredensial Google Sheets (
                <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
                <code>GOOGLE_PRIVATE_KEY</code>, <code>GOOGLE_SPREADSHEET_ID</code>)
                mengikuti panduan <code>docs/database-and-sheets-setup.md</code>.
              </p>
            </details>
          </div>
        )}

        {/* ================================================================= */}
        {/* BAGIAN 1: 4 KARTU RINGKASAN KELAS (Coach Mark Target: kpi)        */}
        {/* ================================================================= */}
        <section
          ref={kpiRef}
          className={`rounded-3xl ${
            activeTourStep?.target === "kpi" ? "p-3 bg-[#081021]" : ""
          } ${highlightRing("kpi")}`}
        >
          {activeTourStep?.target === "kpi" && (
            <CoachMarkBadge
              stepNumber={1}
              totalSteps={GURU_TOUR_STEPS.length}
              text={activeTourStep.badge}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Kartu 1 */}
            <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-4 sm:p-5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Karya Terkumpul
                </p>
                <TeacherTooltip
                  align="right"
                  content="Jumlah siswa yang sudah menekan tombol 'Kumpulkan ke Guru'. Label 'teks contoh' menandai siswa yang belum mengubah teks contoh bawaan."
                />
              </div>
              <p className="font-brand text-3xl font-bold text-[#f4d993]">
                {stats.totalStudents}
              </p>
              <p className="text-xs text-stone-400">
                {stats.originalCount} karya asli · {stats.presetWarningCount} teks contoh
              </p>
            </div>

            {/* Kartu 2 */}
            <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-4 sm:p-5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Rata-Rata Nilai Kelas
                </p>
                <TeacherTooltip
                  align="right"
                  content="Gabungan skor otomatis dari latihan materi Babak 1–3 & Kuis (60%) serta pemeriksa naskah Studio Tulis (40%)."
                />
              </div>
              <p className="font-brand text-3xl font-bold text-emerald-300">
                {stats.avgHolisticScore}%
              </p>
              <p className="text-xs text-stone-400">
                Rata-rata nilai cerita: {stats.avgStudioScore}%
              </p>
            </div>

            {/* Kartu 3 */}
            <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-4 sm:p-5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Masuk Google Sheets
                </p>
                <TeacherTooltip
                  align="right"
                  content="Menunjukkan berapa banyak karya yang sudah berhasil diteruskan otomatis ke 3 tab Google Sheets (Rekap Nilai, Naskah Cerita, dan Peta Rancang)."
                />
              </div>
              <p className="font-brand text-3xl font-bold text-sky-300">
                {stats.syncedCount}
                <span className="text-lg font-normal text-stone-400">
                  /{stats.totalStudents}
                </span>
              </p>
              <p className="text-xs text-stone-400">
                {stats.totalStudents === 0
                  ? "Menunggu kiriman siswa pertama"
                  : stats.unsyncedCount === 0
                    ? "Semua sudah tercatat di Google Sheets"
                    : `${stats.unsyncedCount} karya perlu dikirim ulang`}
              </p>
            </div>

            {/* Kartu 4 */}
            <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-4 sm:p-5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Karya Pilihan Kelas
                </p>
                <TeacherTooltip
                  align="right"
                  content="Cerita terbaik yang Bapak/Ibu beri tanda 'Karya Pilihan' agar mudah dibuka di Galeri Apresiasi saat sesi refleksi kelas."
                />
              </div>
              <p className="font-brand text-3xl font-bold text-amber-300">
                {stats.featuredCount}
              </p>
              <p className="text-xs text-stone-400">
                {classrooms.length} kode kelas terdaftar
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* BAGIAN 2: TAB NAVIGASI + UX MICROCOPY KONTEKSTUAL                 */}
        {/* ================================================================= */}
        <div
          ref={tabsRef}
          className={`space-y-3 rounded-2xl ${
            activeTourStep?.target === "tabs" ? "p-3 bg-[#081021]" : ""
          } ${highlightRing("tabs")}`}
        >
          {activeTourStep?.target === "tabs" && (
            <CoachMarkBadge
              stepNumber={4}
              totalSteps={GURU_TOUR_STEPS.length}
              text={activeTourStep.badge}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            {(
              [
                {
                  id: "rekap",
                  label: `Daftar Karya Siswa (${submissions.length})`,
                },
                {
                  id: "galeri",
                  label: `Galeri Apresiasi Kelas (${gallerySubmissions.length})`,
                },
                {
                  id: "kelas",
                  label: `Atur Kode Kelas (${classrooms.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#f4d993] text-[#030712] shadow-md shadow-[#cda250]/15"
                    : "border border-white/15 bg-white/5 text-stone-200 hover:border-[#cda250]/50 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* UX Microcopy kontekstual per tab */}
          <p className="text-xs sm:text-sm leading-relaxed text-stone-300">
            {activeTabMicrocopy[activeTab]}
          </p>
        </div>

        {/* ================================================================= */}
        {/* BAGIAN 3: BARIS PENCARIAN & SARINGAN PROPORSIONAL                 */}
        {/* ================================================================= */}
        {activeTab !== "kelas" && (
          <div
            ref={filtersRef}
            className={`rounded-2xl border border-white/10 bg-[#080f1e] p-3.5 sm:p-4 space-y-2.5 ${highlightRing(
              "filters"
            )}`}
          >
            {activeTourStep?.target === "filters" && (
              <CoachMarkBadge
                stepNumber={2}
                totalSteps={GURU_TOUR_STEPS.length}
                text={activeTourStep.badge}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Kotak Pencarian proporsional, ikon kaca pembesar jelas, tidak terpotong */}
              <div className="relative md:col-span-5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama siswa, kelas, atau judul cerita..."
                  aria-label="Cari nama siswa, kelas, atau judul cerita"
                  className="h-10 w-full rounded-xl border border-white/20 bg-black/45 pl-10 pr-4 text-sm text-white placeholder:text-stone-400 focus:border-[#f4d993] focus:outline-none"
                />
              </div>

              {/* Filter Kelas */}
              <div className="md:col-span-3">
                <select
                  value={filterClassCode}
                  onChange={(e) => setFilterClassCode(e.target.value)}
                  aria-label="Saring berdasarkan kelas"
                  className="h-10 w-full rounded-xl border border-white/20 bg-[#0b1324] px-3.5 text-sm text-stone-100 focus:border-[#f4d993] focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#080f1e] text-stone-100">
                    Semua Kelas
                  </option>
                  {availableClassCodes.map((code) => (
                    <option
                      key={code}
                      value={code}
                      className="bg-[#080f1e] text-stone-100"
                    >
                      Kelas {code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status Google Sheets */}
              <div className="md:col-span-2">
                <select
                  value={filterSyncStatus}
                  onChange={(e) => setFilterSyncStatus(e.target.value)}
                  aria-label="Saring berdasarkan status Google Sheets"
                  className="h-10 w-full rounded-xl border border-white/20 bg-[#0b1324] px-3.5 text-sm text-stone-100 focus:border-[#f4d993] focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#080f1e] text-stone-100">
                    Semua Status
                  </option>
                  <option value="synced" className="bg-[#080f1e] text-stone-100">
                    Masuk Sheets
                  </option>
                  <option value="failed" className="bg-[#080f1e] text-stone-100">
                    Perlu Kirim Ulang
                  </option>
                  <option value="pending" className="bg-[#080f1e] text-stone-100">
                    Menunggu
                  </option>
                  <option value="not_configured" className="bg-[#080f1e] text-stone-100">
                    Belum Terhubung
                  </option>
                </select>
              </div>

              {/* Tombol Segarkan */}
              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerReloadDashboard}
                  className="h-10 w-full rounded-xl border border-[#cda250]/45 bg-[#0e192e] hover:bg-[#162542] px-3.5 text-xs sm:text-sm font-bold text-[#f4d993] cursor-pointer whitespace-nowrap transition-colors"
                >
                  Segarkan Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: DAFTAR KARYA SISWA (Coach Mark Target: table)              */}
        {/* ================================================================= */}
        {activeTab === "rekap" && (
          <section
            ref={tableRef}
            className={`space-y-4 rounded-2xl ${
              activeTourStep?.target === "table" ? "p-2 bg-[#081021]" : ""
            } ${highlightRing("table")}`}
          >
            {activeTourStep?.target === "table" && (
              <CoachMarkBadge
                stepNumber={3}
                totalSteps={GURU_TOUR_STEPS.length}
                text={activeTourStep.badge}
              />
            )}

            {listError && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/45 bg-rose-950/45 p-4 text-sm text-rose-100"
              >
                {listError}
              </div>
            )}

            {isLoadingList ? (
              <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-10 text-center text-sm text-stone-300">
                Sedang memuat daftar karya siswa...
              </div>
            ) : submissions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-8 sm:p-10 text-center space-y-3">
                <p className="font-brand text-base font-bold text-[#f4d993]">
                  {hasActiveFilters
                    ? "Tidak ada karya yang sesuai dengan saringan"
                    : "Belum ada karya siswa yang masuk"}
                </p>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-stone-400">
                  {hasActiveFilters
                    ? "Coba ubah kata kunci pencarian atau pilih 'Semua Kelas' untuk melihat seluruh pengumpulan."
                    : "Saat siswa selesai menulis di Studio Tulis dan menekan tombol 'Kumpulkan ke Guru', naskah cerita dan nilainya akan otomatis muncul di tabel ini serta masuk ke Google Sheets."}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterClassCode("ALL");
                      setFilterSyncStatus("ALL");
                      setSearchQuery("");
                    }}
                    className="mt-1 rounded-full bg-[#f4d993] hover:bg-white px-4 py-2 text-xs font-bold text-[#030712] cursor-pointer"
                  >
                    Tampilkan Semua Karya
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#080f1e]">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-[#0c162b] text-xs font-bold uppercase tracking-wider text-stone-300">
                    <tr>
                      <th className="px-4 py-3.5 min-w-[180px]">Siswa &amp; Kelas</th>
                      <th className="px-4 py-3.5 min-w-[220px]">Judul Cerita</th>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Latihan
                          <TeacherTooltip
                            content="Rata-rata skor latihan pemahaman materi (Babak 1–3 & Kuis Bonus, bobot 60%)."
                          />
                        </span>
                      </th>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Cerita
                          <TeacherTooltip
                            content="Skor otomatis pemeriksa naskah cerita fantasi di Studio Tulis (bobot 40%)."
                          />
                        </span>
                      </th>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Total
                          <TeacherTooltip
                            content="Nilai gabungan otomatis (60% Latihan + 40% Cerita) sebagai acuan awal."
                          />
                        </span>
                      </th>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap">
                        Nilai Guru
                      </th>
                      <th className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Keaslian
                          <TeacherTooltip
                            align="right"
                            content="Memudahkan guru membedakan karya asli siswa dari teks contoh bawaan atau draf yang masih belum lengkap."
                          />
                        </span>
                      </th>
                      <th className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Google Sheets
                          <TeacherTooltip
                            align="right"
                            content="Status apakah nilai dan cerita siswa ini sudah berhasil masuk ke berkas Google Sheets guru."
                          />
                        </span>
                      </th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {submissions.map((item) => {
                      const authBadge = getAuthenticityBadge(
                        item.analysis.authenticityStatus
                      );
                      const sheetBadge = getSheetStatusBadge(item.sheetSync.status);
                      return (
                        <tr
                          key={item.submissionId}
                          className={`hover:bg-white/[0.035] transition-colors ${
                            selectedDetail?.submissionId === item.submissionId
                              ? "bg-[#cda250]/12"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 align-middle">
                            <p className="font-bold text-stone-100 leading-snug">
                              {item.authorName}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-400">
                              {item.authorClass}
                              {item.absenNumber ? ` · No. ${item.absenNumber}` : ""} ·{" "}
                              <span className="text-[#cda250] font-semibold">
                                {item.classCode}
                              </span>
                            </p>
                          </td>

                          <td className="px-4 py-3.5 align-middle max-w-[280px]">
                            <p
                              title={item.storyTitle}
                              className="font-semibold text-[#f4d993] truncate"
                            >
                              {item.storyTitle}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-400 whitespace-nowrap">
                              {item.analysis.totalWords} kata · Kiriman ke-{item.version} ·{" "}
                              {formatWibDate(item.submittedAtIso)}
                            </p>
                          </td>

                          <td className="px-3 py-3.5 text-center align-middle font-semibold text-stone-200 whitespace-nowrap">
                            {item.metrics.overallPercentage}%
                          </td>

                          <td className="px-3 py-3.5 text-center align-middle font-semibold text-stone-200 whitespace-nowrap">
                            {item.metrics.babak4Score}%
                          </td>

                          <td className="px-3 py-3.5 text-center align-middle whitespace-nowrap">
                            <span className="inline-block rounded-full bg-emerald-950/75 border border-emerald-400/40 px-2.5 py-0.5 text-xs font-bold text-emerald-200">
                              {item.metrics.holisticTotalPercentage}%
                            </span>
                          </td>

                          <td className="px-3 py-3.5 text-center align-middle whitespace-nowrap">
                            {item.teacherReview.teacherScore !== null ? (
                              <span className="inline-block rounded-full bg-[#cda250]/20 border border-[#cda250]/55 px-2.5 py-0.5 text-xs font-bold text-[#f4d993]">
                                {item.teacherReview.teacherScore}
                              </span>
                            ) : (
                              <span className="text-xs text-stone-500">Belum dinilai</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                            <span
                              title={authBadge.hint}
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${authBadge.className}`}
                            >
                              {authBadge.label}
                            </span>
                          </td>

                          <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                            <span
                              title={sheetBadge.hint}
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${sheetBadge.className}`}
                            >
                              {sheetBadge.label}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right align-middle whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.submissionId)}
                              className="rounded-full bg-[#f4d993] hover:bg-white px-4 py-1.5 text-xs font-bold text-[#030712] cursor-pointer transition-colors whitespace-nowrap"
                            >
                              Baca &amp; Nilai
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 2: GALERI APRESIASI KELAS                                     */}
        {/* ================================================================= */}
        {activeTab === "galeri" && (
          <section className="space-y-4">
            {gallerySubmissions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#080f1e] p-10 text-center space-y-2">
                <p className="font-brand text-base font-bold text-[#f4d993]">
                  Galeri Apresiasi Masih Kosong
                </p>
                <p className="text-sm text-stone-400">
                  Karya siswa yang sudah dikumpulkan akan tampil di sini dalam format kartu
                  cerita siap baca di depan kelas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallerySubmissions.map((item) => (
                  <article
                    key={item.submissionId}
                    className="flex flex-col justify-between rounded-2xl border border-[#cda250]/35 bg-[#080f1e] p-5 space-y-4 hover:border-[#f4d993]/65 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#cda250] truncate">
                          {item.authorClass} · {item.themeCategory}
                        </span>
                        {item.teacherReview.isFeaturedInGallery && (
                          <span className="shrink-0 rounded-full bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                            Karya Pilihan
                          </span>
                        )}
                      </div>
                      <h3 className="font-brand text-lg font-bold text-[#f4d993] leading-snug">
                        {item.storyTitle}
                      </h3>
                      <p className="text-xs font-semibold text-stone-300">
                        Penulis: {item.authorName} · {item.analysis.totalWords} kata
                      </p>
                      <p className="text-sm leading-relaxed text-stone-300/90 line-clamp-4">
                        {item.fullStoryText || "(Siswa belum menulis isi paragraf cerita)"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3.5">
                      <span className="text-xs font-bold text-emerald-300">
                        {item.teacherReview.teacherScore !== null
                          ? `Nilai Guru: ${item.teacherReview.teacherScore}`
                          : `Skor Awal: ${item.metrics.holisticTotalPercentage}%`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.submissionId)}
                        className="rounded-full border border-[#cda250]/60 bg-[#0d182d] hover:bg-[#cda250]/20 px-3.5 py-1.5 text-xs font-bold text-[#f4d993] cursor-pointer whitespace-nowrap"
                      >
                        Baca Cerita Utuh -&gt;
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 3: ATUR KODE KELAS                                            */}
        {/* ================================================================= */}
        {activeTab === "kelas" && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleCreateOrUpdateClass}
              className="lg:col-span-5 rounded-2xl border border-[#cda250]/35 bg-[#080f1e] p-5 sm:p-6 space-y-4 text-sm"
            >
              <div className="space-y-1">
                <h2 className="font-brand text-base font-bold text-[#f4d993]">
                  Buat Kode Kelas Baru
                </h2>
                <p className="text-xs leading-relaxed text-stone-400">
                  Bagikan kode singkat ini kepada siswa sebelum mereka menekan tombol
                  &ldquo;Kumpulkan ke Guru&rdquo; agar data tiap kelas tidak tercampur.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="new-class-code"
                  className="block text-xs font-bold text-stone-200"
                >
                  Kode Kelas * (huruf, angka, atau tanda strip)
                </label>
                <input
                  id="new-class-code"
                  type="text"
                  required
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: VII-A-2026"
                  className="h-10 w-full rounded-xl border border-white/20 bg-black/45 px-3.5 font-mono text-sm uppercase text-white placeholder:font-sans placeholder:normal-case placeholder:text-stone-400 focus:border-[#f4d993] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="new-class-name"
                  className="block text-xs font-bold text-stone-200"
                >
                  Nama Rombongan Belajar *
                </label>
                <input
                  id="new-class-name"
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Contoh: Kelas VII-A SMPN 1"
                  className="h-10 w-full rounded-xl border border-white/20 bg-black/45 px-3.5 text-sm text-white placeholder:text-stone-400 focus:border-[#f4d993] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="new-teacher-name"
                  className="block text-xs font-bold text-stone-200"
                >
                  Nama Guru Pengampu (Opsional)
                </label>
                <input
                  id="new-teacher-name"
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Contoh: Ibu Siti Rahayu, S.Pd."
                  className="h-10 w-full rounded-xl border border-white/20 bg-black/45 px-3.5 text-sm text-white placeholder:text-stone-400 focus:border-[#f4d993] focus:outline-none"
                />
              </div>

              {/* Disembunyikan rapi dalam accordion agar guru awam tidak bingung */}
              <details className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs">
                <summary className="cursor-pointer font-semibold text-stone-300 hover:text-[#f4d993]">
                  Opsi Lanjutan: Pakai Google Sheets Terpisah untuk Kelas Ini
                </summary>
                <div className="mt-2.5 space-y-1.5">
                  <label
                    htmlFor="new-class-sheet"
                    className="block text-stone-300 leading-relaxed"
                  >
                    Tempel tautan Google Sheets khusus kelas ini (kosongkan bila ingin
                    memakai Google Sheets utama):
                  </label>
                  <input
                    id="new-class-sheet"
                    type="text"
                    value={newClassSheetInput}
                    onChange={(e) => setNewClassSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="h-9 w-full rounded-lg border border-white/15 bg-black/45 px-3 text-xs text-white placeholder:text-stone-500 focus:border-[#f4d993] focus:outline-none"
                  />
                </div>
              </details>

              <button
                type="submit"
                disabled={isSavingClass}
                className="h-10 w-full rounded-full bg-[#f4d993] hover:bg-white text-sm font-bold text-[#030712] cursor-pointer disabled:opacity-60 transition-colors"
              >
                {isSavingClass ? "Menyimpan..." : "Simpan Kode Kelas"}
              </button>
            </form>

            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#080f1e] p-5 sm:p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="font-brand text-base font-bold text-[#f4d993]">
                  Daftar Kelas yang Terdaftar
                </h2>
                <p className="text-xs text-stone-400">
                  Bapak/Ibu dapat menutup sementara sebuah kode kelas apabila batas waktu
                  pengumpulan tugas sudah selesai.
                </p>
              </div>

              {classrooms.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/25 p-5 text-sm leading-relaxed text-stone-400">
                  Belum ada kode kelas khusus yang dibuat. Tidak masalah — siswa tetap
                  bisa mengumpulkan karya dengan menuliskan nama kelasnya (misalnya{" "}
                  <strong className="text-stone-200">VII-A</strong>) pada formulir
                  pengumpulan.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {classrooms.map((cls) => (
                    <div
                      key={cls.classCode}
                      className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[#cda250]/15 border border-[#cda250]/45 px-2 py-0.5 font-mono text-xs font-bold text-[#f4d993]">
                            {cls.classCode}
                          </span>
                          <span className="text-sm font-semibold text-stone-100">
                            {cls.className}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              cls.isActive
                                ? "bg-emerald-950/75 text-emerald-200 border border-emerald-400/40"
                                : "bg-rose-950/75 text-rose-200 border border-rose-400/40"
                            }`}
                          >
                            {cls.isActive ? "Dibuka" : "Ditutup"}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400">
                          {cls.teacherName || "Guru Bahasa Indonesia"} ·{" "}
                          {cls.spreadsheetId
                            ? "Memakai Google Sheets khusus kelas"
                            : "Memakai Google Sheets utama"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleToggleClassroomActive(cls)}
                        className="rounded-full border border-white/15 bg-white/5 hover:border-[#f4d993]/60 hover:text-white px-3.5 py-1.5 text-xs font-semibold text-stone-200 cursor-pointer whitespace-nowrap"
                      >
                        {cls.isActive ? "Tutup Pengumpulan" : "Buka Kembali"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ==================================================================== */}
      {/* INTERACTIVE WALKTHROUGH / PRODUCT TOUR BAR (DOCKED BAWAH LAYAR)      */}
      {/* ==================================================================== */}
      {activeTourStep && tourStepIndex !== null && (
        <aside
          role="dialog"
          aria-label="Panduan Interaktif Ruang Guru"
          className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 z-40 sm:w-[440px] rounded-2xl border-2 border-[#f4d993]/80 bg-[#0a1326]/98 p-4 sm:p-5 text-stone-100 shadow-[0_20px_70px_rgba(0,0,0,0.9)] backdrop-blur-md space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f4d993]">
              <span className="rounded-full bg-[#f4d993] px-2 py-0.5 text-[10px] text-[#030712]">
                {tourStepIndex + 1} / {GURU_TOUR_STEPS.length}
              </span>
              Panduan Ruang Guru
            </span>
            <button
              type="button"
              onClick={finishTour}
              className="text-xs font-semibold text-stone-400 hover:text-white cursor-pointer"
            >
              Lewati
            </button>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-brand text-base font-bold text-white leading-snug">
              {activeTourStep.title}
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-stone-200">
              {activeTourStep.body}
            </p>
            <p className="rounded-xl border border-[#cda250]/30 bg-[#050b17] px-3 py-2 text-xs leading-relaxed text-[#f4d993]">
              <strong>Tips:</strong> {activeTourStep.tip}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {GURU_TOUR_STEPS.map((st, idx) => (
                <button
                  key={st.target}
                  type="button"
                  onClick={() => goToTourStep(idx)}
                  aria-label={`Pindah ke langkah ${idx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === tourStepIndex
                      ? "w-6 bg-[#f4d993]"
                      : "w-2 bg-white/25 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {tourStepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => goToTourStep(tourStepIndex - 1)}
                  className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-stone-200 cursor-pointer"
                >
                  &lt;- Sebelumnya
                </button>
              )}
              {tourStepIndex < GURU_TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToTourStep(tourStepIndex + 1)}
                  className="rounded-full bg-[#f4d993] hover:bg-white px-4 py-1.5 text-xs font-bold text-[#030712] cursor-pointer"
                >
                  Lanjut -&gt;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishTour}
                  className="rounded-full bg-emerald-400 hover:bg-emerald-300 px-4 py-1.5 text-xs font-bold text-[#030712] cursor-pointer"
                >
                  Mulai Memeriksa
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ==================================================================== */}
      {/* MODAL BACA KARYA & PENILAIAN GURU (DUAL-SCROLL PROPORSIONAL)         */}
      {/* ==================================================================== */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Lembar Baca Cerita dan Penilaian Guru"
        >
          <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[#cda250]/55 bg-[#070d19] shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#cda250]/25 bg-[#0b1324] px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#cda250] truncate">
                  {selectedDetail
                    ? `${selectedDetail.authorName} · ${selectedDetail.authorClass}${
                        selectedDetail.absenNumber
                          ? ` (No. ${selectedDetail.absenNumber})`
                          : ""
                      } · Kiriman ke-${selectedDetail.version}`
                    : "Memuat naskah siswa..."}
                </p>
                <h2 className="font-brand text-lg sm:text-xl font-bold text-[#f4d993] truncate">
                  {selectedDetail?.storyTitle ?? "Memuat karya siswa..."}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {selectedDetail && sheetsConfigured && (
                  <button
                    type="button"
                    disabled={isSyncingOne}
                    onClick={() =>
                      void handleSyncSheets(selectedDetail.submissionId)
                    }
                    className="rounded-full border border-sky-400/50 bg-sky-950/65 hover:bg-sky-900/75 px-3.5 py-1.5 text-xs font-bold text-sky-100 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSyncingOne ? "Mengirim..." : "Kirim ke Google Sheets"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setSelectedDetail(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 px-3.5 py-1.5 text-xs font-bold text-stone-100 cursor-pointer whitespace-nowrap"
                >
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {isLoadingDetail || !selectedDetail ? (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-stone-300">
                Sedang membuka naskah cerita, Peta Rancang, dan catatan ejaan...
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
                {/* Kolom Kiri (7 col): Lembar Baca Cerita + Peta Rancang (scroll mandiri di desktop) */}
                <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-white/10 p-5 sm:p-6 space-y-5 lg:overflow-y-auto">
                  {/* Riwayat Kiriman / Revisi */}
                  {selectedRevisions.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b1324] px-3.5 py-2.5 text-xs">
                      <span className="font-semibold text-stone-300">
                        Siswa ini mengirim revisi ({selectedRevisions.length} kali):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedRevisions.map((rev) => (
                          <button
                            key={rev.submissionId}
                            type="button"
                            onClick={() => setSelectedId(rev.submissionId)}
                            className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer ${
                              rev.submissionId === selectedDetail.submissionId
                                ? "bg-[#f4d993] text-[#030712]"
                                : "border border-white/15 text-stone-300 hover:text-white"
                            }`}
                          >
                            Kiriman ke-{rev.version}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lembar Cerita Bernuansa Kertas Nyaman Baca */}
                  <article className="rounded-2xl border border-[#cda250]/50 bg-[#f7ecd2] p-5 sm:p-6 text-[#1e1207] space-y-4 shadow-inner">
                    <div className="border-b border-[#5c3d1e]/30 pb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#6b4720]">
                        Tema: {selectedDetail.themeCategory} ·{" "}
                        {selectedDetail.analysis.totalWords} Kata
                      </p>
                      <h3 className="mt-1 font-brand text-xl sm:text-2xl font-bold text-[#2b1706] leading-snug">
                        {selectedDetail.storyTitle}
                      </h3>
                    </div>

                    <div className="space-y-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {selectedDetail.draft.paragraphOrientasi.trim() && (
                        <div>
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                            Bagian Awal (Orientasi)
                          </span>
                          <p>{selectedDetail.draft.paragraphOrientasi.trim()}</p>
                        </div>
                      )}
                      {(selectedDetail.draft.paragraphKomplikasi ?? "").trim() && (
                        <div>
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                            Munculnya Masalah (Komplikasi)
                          </span>
                          <p>{selectedDetail.draft.paragraphKomplikasi?.trim()}</p>
                        </div>
                      )}
                      {selectedDetail.draft.paragraphKlimaks.trim() && (
                        <div>
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                            Puncak Cerita (Klimaks)
                          </span>
                          <p>{selectedDetail.draft.paragraphKlimaks.trim()}</p>
                        </div>
                      )}
                      {selectedDetail.draft.paragraphResolusi.trim() && (
                        <div>
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                            Penyelesaian (Resolusi)
                          </span>
                          <p>{selectedDetail.draft.paragraphResolusi.trim()}</p>
                        </div>
                      )}
                      {(selectedDetail.draft.extraSpreads ?? []).map((sp, i) => (
                        <div
                          key={sp.id}
                          className="space-y-3 border-t border-[#5c3d1e]/25 pt-3"
                        >
                          {sp.leftText.trim() && (
                            <div>
                              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                                Lembar Lanjutan {i + 1} · {sp.leftTitle || "Kiri"}
                              </span>
                              <p>{sp.leftText.trim()}</p>
                            </div>
                          )}
                          {sp.rightText.trim() && (
                            <div>
                              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#6b4720]">
                                Lembar Lanjutan {i + 1} · {sp.rightTitle || "Kanan"}
                              </span>
                              <p>{sp.rightText.trim()}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {(selectedDetail.draft.amanat.trim() ||
                      (selectedDetail.draft.authorReflection ?? "").trim()) && (
                      <div className="border-t border-[#5c3d1e]/30 pt-3.5 space-y-2 text-sm">
                        {selectedDetail.draft.amanat.trim() && (
                          <p>
                            <strong>Pesan Cerita (Amanat):</strong>{" "}
                            {selectedDetail.draft.amanat}
                          </p>
                        )}
                        {(selectedDetail.draft.authorReflection ?? "").trim() && (
                          <p>
                            <strong>Refleksi Siswa:</strong>{" "}
                            {selectedDetail.draft.authorReflection}
                          </p>
                        )}
                      </div>
                    )}
                  </article>

                  {/* Peta Rancang (LKS Pra-Menulis) */}
                  <div className="rounded-2xl border border-white/10 bg-[#0b1324] p-5 space-y-3 text-xs sm:text-sm">
                    <h4 className="font-brand text-sm font-bold text-[#f4d993]">
                      Peta Rancang Siswa (LKS Pra-Menulis)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-300 leading-relaxed">
                      <p>
                        <strong className="text-stone-100">Aturan Keajaiban:</strong>{" "}
                        {selectedDetail.draft.worldRule || "-"}
                      </p>
                      <p>
                        <strong className="text-stone-100">Latar Tempat:</strong>{" "}
                        {selectedDetail.draft.settingPlace || "-"}
                      </p>
                      <p>
                        <strong className="text-stone-100">Tokoh Utama:</strong>{" "}
                        {selectedDetail.draft.protagonistName || "-"} —{" "}
                        {selectedDetail.draft.protagonistTraitAction || "-"}
                      </p>
                      <p>
                        <strong className="text-stone-100">Tokoh Lawan:</strong>{" "}
                        {selectedDetail.draft.antagonistName || "-"} —{" "}
                        {selectedDetail.draft.antagonistConflictTrigger || "-"}
                      </p>
                      <p>
                        <strong className="text-stone-100">Indra Penglihatan:</strong>{" "}
                        {selectedDetail.draft.sensorySight || "-"}
                      </p>
                      <p>
                        <strong className="text-stone-100">Indra Pendengaran:</strong>{" "}
                        {selectedDetail.draft.sensorySound || "-"}
                      </p>
                      <p className="sm:col-span-2">
                        <strong className="text-stone-100">
                          Indra Penciuman &amp; Perabaan:
                        </strong>{" "}
                        {selectedDetail.draft.sensorySmellTouch || "-"}
                      </p>
                      <div className="sm:col-span-2 space-y-1 border-t border-white/10 pt-2">
                        <strong className="block text-stone-100">Kerangka Alur:</strong>
                        <p>
                          <strong>Awal:</strong>{" "}
                          {selectedDetail.draft.outlineOrientasi || "-"}
                        </p>
                        <p>
                          <strong>Konflik &amp; Puncak:</strong>{" "}
                          {selectedDetail.draft.outlineKomplikasiKlimaks || "-"}
                        </p>
                        <p>
                          <strong>Akhir:</strong>{" "}
                          {selectedDetail.draft.outlineResolusi || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan (5 col): Penilaian Guru + Ringkasan Pemeriksa Otomatis (scroll mandiri di desktop) */}
                <div className="lg:col-span-5 p-5 sm:p-6 space-y-5 lg:overflow-y-auto">
                  {/* Form Penilaian Guru ditaruh di ATAS agar guru langsung bisa memberi nilai saat membaca */}
                  <form
                    onSubmit={handleSaveReview}
                    className="rounded-2xl border border-emerald-400/40 bg-emerald-950/25 p-5 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-brand text-sm font-bold text-emerald-200">
                          Beri Nilai &amp; Catatan Guru
                        </h4>
                        <p className="mt-0.5 text-xs text-stone-300">
                          Otomatis tersimpan dan ikut memperbarui kolom Guru di Google
                          Sheets.
                        </p>
                      </div>
                      <TeacherTooltip
                        align="right"
                        content="Nilai dan catatan Bapak/Ibu akan langsung masuk ke kolom 'Nilai Akhir Guru' dan 'Catatan Guru' pada tab Rekap Nilai di Google Sheets."
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="teacher-score-input"
                        className="block text-xs font-bold text-stone-200"
                      >
                        Nilai Akhir Guru (0–100)
                      </label>
                      <input
                        id="teacher-score-input"
                        type="number"
                        min={0}
                        max={100}
                        value={reviewScoreInput}
                        onChange={(e) => setReviewScoreInput(e.target.value)}
                        placeholder="Contoh: 88"
                        className="h-10 w-full rounded-xl border border-white/20 bg-black/45 px-3.5 text-sm text-white placeholder:text-stone-400 focus:border-emerald-300 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="teacher-feedback-input"
                        className="block text-xs font-bold text-stone-200"
                      >
                        Catatan Umpan Balik untuk Siswa
                      </label>
                      <textarea
                        id="teacher-feedback-input"
                        rows={3}
                        value={reviewFeedbackInput}
                        onChange={(e) => setReviewFeedbackInput(e.target.value)}
                        placeholder="Tuliskan apresiasi dan saran perbaikan cerita untuk siswa..."
                        className="w-full rounded-xl border border-white/20 bg-black/45 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-stone-400 focus:border-emerald-300 focus:outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs sm:text-sm text-stone-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reviewFeaturedInput}
                        onChange={(e) => setReviewFeaturedInput(e.target.checked)}
                        className="h-4 w-4 accent-[#cda250]"
                      />
                      <span>Tandai sebagai Karya Pilihan di Galeri Kelas</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSavingReview}
                      className="h-10 w-full rounded-full bg-emerald-400 hover:bg-emerald-300 text-sm font-bold text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isSavingReview
                        ? "Sedang Menyimpan..."
                        : "Simpan Nilai & Catatan Guru"}
                    </button>

                    {selectedDetail.sheetSync.status === "failed" && (
                      <div className="rounded-xl border border-rose-400/35 bg-rose-950/35 p-3 text-xs text-rose-100 space-y-1">
                        <p>
                          Pengiriman ke Google Sheets sempat tertunda. Tekan tombol{" "}
                          <strong>&ldquo;Kirim ke Google Sheets&rdquo;</strong> di kanan
                          atas untuk mencoba lagi.
                        </p>
                        {selectedDetail.sheetSync.lastError && (
                          <details className="text-[11px] text-rose-200/80">
                            <summary className="cursor-pointer underline">
                              Detail teknis untuk admin
                            </summary>
                            <p className="mt-1 break-all">
                              {selectedDetail.sheetSync.lastError}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                  </form>

                  {/* Ringkasan Pemeriksa Otomatis */}
                  <div className="rounded-2xl border border-[#cda250]/30 bg-[#0b1324] p-5 space-y-3.5 text-xs sm:text-sm">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-brand text-sm font-bold text-[#f4d993]">
                          Ringkasan Pemeriksa Otomatis
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            getAuthenticityBadge(
                              selectedDetail.analysis.authenticityStatus
                            ).className
                          }`}
                        >
                          {
                            getAuthenticityBadge(
                              selectedDetail.analysis.authenticityStatus
                            ).label
                          }
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        Skor otomatis ini berfungsi sebagai alat bantu awal. Keputusan
                        nilai akhir tetap berada di tangan Bapak/Ibu Guru.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-xl bg-black/35 p-3">
                        <span className="block text-stone-400">
                          Latihan Babak 1 / 2 / 3 / Kuis
                        </span>
                        <strong className="mt-1 block text-sm text-stone-100">
                          {selectedDetail.metrics.babak1Score} ·{" "}
                          {selectedDetail.metrics.babak2Score} ·{" "}
                          {selectedDetail.metrics.babak3Score} ·{" "}
                          {selectedDetail.metrics.questScore}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-black/35 p-3">
                        <span className="block text-stone-400">
                          Skor Gabungan Awal
                        </span>
                        <strong className="mt-1 block text-sm text-emerald-300">
                          {selectedDetail.metrics.holisticTotalPercentage}% (
                          {selectedDetail.metrics.unlockedSealsCount}/3 Segel)
                        </strong>
                      </div>
                    </div>

                    {/* 5 Indikator Sastra */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-200">
                        5 Misi Cerita Fantasi (
                        {selectedDetail.analysis.passedIndicatorsCount}/5 Terpenuhi):
                      </p>
                      <div className="space-y-1.5">
                        {selectedDetail.analysis.indicators.map((ind) => (
                          <div
                            key={ind.id}
                            className="flex items-start justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  ind.passed
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-400/35"
                                    : "bg-amber-950 text-amber-200 border border-amber-400/35"
                                }`}
                              >
                                {ind.passed ? "Terpenuhi" : "Perlu Dilengkapi"}
                              </span>
                              <p className="text-stone-200 leading-snug">
                                {ind.tpCode} · {ind.title}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold text-stone-300">
                              {ind.earnedScore}/{ind.scoreWeight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Catatan Ejaan EYD V */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-200">
                        Catatan Ejaan EYD V ({selectedDetail.analysis.eydIssuesCount}):
                      </p>
                      {selectedDetail.analysis.eydAndLexiconIssues.length === 0 ? (
                        <p className="rounded-xl bg-emerald-950/35 px-3 py-2 text-xs text-emerald-200">
                          Tidak ditemukan kesalahan ejaan EYD V dasar pada cerita ini.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {selectedDetail.analysis.eydAndLexiconIssues.map(
                            (issue) => (
                              <li
                                key={issue.id}
                                className="rounded-xl bg-rose-950/35 px-3 py-2 text-xs leading-relaxed text-rose-100"
                              >
                                &ldquo;{issue.foundText}&rdquo; sebaiknya ditulis{" "}
                                <strong className="text-white">
                                  &ldquo;{issue.suggestion}&rdquo;
                                </strong>
                                <span className="block text-[11px] text-rose-200/80">
                                  Rujukan: {issue.ruleReference}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
