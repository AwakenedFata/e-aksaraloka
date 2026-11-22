/**
 * Mesin Analisis Sastra Real-Time (Live Literary Detector) & Authority Layer
 * untuk Babak IV: Meja Studio Tulis E-Aksaraloka (Keterampilan Menulis Teks Naratif Kelas VII).
 *
 * Selaras dengan:
 * 1. Buku Siswa Bahasa Indonesia Kelas VII Revisi Bab II Bagian C Kegiatan 12 (hlm. 70)
 * 2. Lembar Analisis Project Media Pembelajaran Kelompok 6 (TP 1-5 & 5 Peluang Peran Media)
 * 3. Audit Sumber Otoritatif (docs/authority-sources-audit.md):
 *    - EydRuleProvider (deterministic_rule dengan rujukan bab EYD Edisi V)
 *    - CuratedLexiconProvider (authority_verified hasil kurasi manual tanpa scraping KBBI)
 *    - KbbiLinkProvider (tautan rujukan ke kbbi.kemendikdasmen.go.id tanpa fetch/scraping)
 */

export const PRESET_FANTASY_THEMES = [
  "Lintas Waktu & Konsekuensi",
  "Dunia Sihir & Akademi",
  "Mitos & Pusaka Nusantara",
] as const;

export type PresetFantasyTheme = (typeof PRESET_FANTASY_THEMES)[number];

/** Mendukung 3 tema kurasi kurikulum maupun tema fantasi orisinal pilihan siswa sendiri. */
export type FantasyThemeCategory = PresetFantasyTheme | (string & {});

export type VerificationStatus =
  | "authority_verified"
  | "deterministic_rule"
  | "stylistic";

export interface StudioExtraSpread {
  readonly id: string;
  readonly leftTitle: string;
  readonly rightTitle: string;
  readonly leftText: string;
  readonly rightText: string;
}

export interface StudioDraftData {
  readonly authorName: string;
  readonly authorClass: string;
  // Langkah 1: Tema & Aturan Dunia Fantasi (Peluang Peran Media #1 & #2)
  readonly themeCategory: FantasyThemeCategory;
  readonly worldRule: string;
  // Langkah 2: Tokoh Memikat (Protagonis & Antagonis)
  readonly protagonistName: string;
  readonly protagonistTraitAction: string;
  readonly antagonistName: string;
  readonly antagonistConflictTrigger: string;
  // Langkah 3: Latar Tempat & Peta Lima Indera (Peluang Peran Media #4)
  readonly settingPlace: string;
  readonly sensorySight: string;
  readonly sensorySound: string;
  readonly sensorySmellTouch: string;
  // Langkah 4: Kerangka Diagram Alur (Peluang Peran Media #2 & #3)
  readonly outlineOrientasi: string;
  readonly outlineKomplikasiKlimaks: string;
  readonly outlineResolusi: string;
  // Langkah 5: Pengembangan Naskah Cerita Utuh (4 Tahap Paragraf + Lembar Tambahan)
  readonly paragraphOrientasi: string;
  readonly paragraphKomplikasi?: string;
  readonly paragraphKlimaks: string;
  readonly paragraphResolusi: string;
  readonly extraSpreads?: readonly StudioExtraSpread[];
  readonly isModelPresetReference?: boolean;
  // Langkah 6: Judul, Amanat, & Daftar Periksa Revisi Mandiri (Peluang #3, #4, #5)
  readonly storyTitle: string;
  readonly amanat: string;
  readonly selfRevisionChecks: Readonly<Record<string, boolean>>;
}

export interface SavedManuscriptItem {
  readonly id: string;
  readonly savedAtIso: string;
  readonly storyTitle: string;
  readonly authorName: string;
  readonly authorClass: string;
  readonly themeCategory: FantasyThemeCategory;
  readonly wordCount: number;
  readonly studioScore: number;
  readonly draft: StudioDraftData;
}

export interface StorySeedPreset {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly description: string;
  readonly draftPreset: Omit<
    StudioDraftData,
    "authorName" | "authorClass" | "selfRevisionChecks"
  >;
}

export interface EydAndLexiconIssue {
  readonly id: string;
  readonly foundText: string;
  readonly suggestion: string;
  readonly explanation: string;
  readonly ruleReference: string;
  readonly referenceUrl: string;
  readonly verificationStatus: VerificationStatus;
}

export interface LiteraryIndicatorStatus {
  readonly id:
    | "struktur"
    | "konsistensi_indera"
    | "majas_asosiasi"
    | "dialog_langsung"
    | "tak_langsung_konjungsi";
  readonly title: string;
  readonly tpCode: string;
  readonly passed: boolean;
  readonly scoreWeight: number;
  readonly earnedScore: number;
  readonly summary: string;
  readonly detectedSnippets: readonly string[];
  readonly improvementHint: string;
}

export interface LiteraryAnalysisResult {
  readonly totalWords: number;
  readonly orientasiWords: number;
  readonly komplikasiWords: number;
  readonly klimaksWords: number;
  readonly resolusiWords: number;
  readonly isModelPresetReference: boolean;
  readonly unfilledPlaceholderCount: number;
  readonly indicators: readonly LiteraryIndicatorStatus[];
  readonly passedIndicatorsCount: number;
  readonly revisionCheckedCount: number;
  readonly totalRevisionChecklistCount: number;
  readonly eydAndLexiconIssues: readonly EydAndLexiconIssue[];
  readonly studioScore: number;
  readonly isReadyForSeal: boolean;
}

export interface SelfRevisionChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly category: "Struktur & Logika" | "Detail & Tokoh" | "Bahasa & Ejaan";
}

export const SELF_REVISION_CHECKLIST: readonly SelfRevisionChecklistItem[] = [
  {
    id: "rev-struktur",
    label:
      "Ceritaku sudah punya bagian Awal, Masalah, Puncak, dan Akhir yang berurutan.",
    category: "Struktur & Logika",
  },
  {
    id: "rev-aturan",
    label:
      "Cara tokohku menyelesaikan masalah sudah sesuai dengan aturan keajaiban ceritaku.",
    category: "Struktur & Logika",
  },
  {
    id: "rev-watak-indera",
    label:
      "Sifat tokohku sudah terlihat dari perbuatannya dan ada gambaran panca indera (cahaya, suara, atau aroma/suhu).",
    category: "Detail & Tokoh",
  },
  {
    id: "rev-majas-dialog",
    label:
      "Aku sudah memakai perumpamaan (seperti/bagaikan/laksana) dan kalimat dialog tokoh.",
    category: "Bahasa & Ejaan",
  },
  {
    id: "rev-eyd",
    label:
      "Kata depan tempat ('di atas', 'di dalam') sudah kupisah dan tanda baca dialog sudah rapi.",
    category: "Bahasa & Ejaan",
  },
];

export const INITIAL_STUDIO_DRAFT: StudioDraftData = {
  authorName: "",
  authorClass: "VII-A",
  themeCategory: "Lintas Waktu & Konsekuensi",
  worldRule: "",
  protagonistName: "",
  protagonistTraitAction: "",
  antagonistName: "",
  antagonistConflictTrigger: "",
  settingPlace: "",
  sensorySight: "",
  sensorySound: "",
  sensorySmellTouch: "",
  outlineOrientasi: "",
  outlineKomplikasiKlimaks: "",
  outlineResolusi: "",
  paragraphOrientasi: "",
  paragraphKomplikasi: "",
  paragraphKlimaks: "",
  paragraphResolusi: "",
  extraSpreads: [],
  isModelPresetReference: false,
  storyTitle: "",
  amanat: "",
  selfRevisionChecks: {
    "rev-struktur": false,
    "rev-aturan": false,
    "rev-watak-indera": false,
    "rev-majas-dialog": false,
    "rev-eyd": false,
  },
};

export const STORY_SEED_PRESETS: readonly StorySeedPreset[] = [
  {
    id: "seed-waktu",
    badge: "Inspirasi 1 · Lintas Waktu",
    title: "Jam Saku Perunggu Kakek",
    description:
      "Terinspirasi dari 'Bola-Bola Waktu': seorang siswa menemukan jam saku tua yang dapat memutar balik waktu 15 menit, namun memiliki konsekuensi logis.",
    draftPreset: {
      themeCategory: "Lintas Waktu & Konsekuensi",
      worldRule:
        "Setiap kali jarum jam diputar mundur 15 menit, pemiliknya harus merelakan satu benda kesayangannya membeku menjadi batu.",
      protagonistName: "Damar",
      protagonistTraitAction:
        "Jujur dan rela berkorban: memilih mengakui kesalahannya daripada terus memutar waktu untuk berbohong.",
      antagonistName: "Bayang Waktu",
      antagonistConflictTrigger:
        "Membujuk Damar agar terus memutar jam saku sampai seluruh kenangan keluarganya ikut membatu.",
      settingPlace: "Loteng Perpustakaan Tua",
      sensorySight:
        "Cahaya keemasan berpendar dari roda gigi perunggu di tengah debu loteng yang temaram.",
      sensorySound:
        "Detak jarum jam menggema berat disusul derit papan kayu tua yang bergetar.",
      sensorySmellTouch:
        "Aroma kertas kuno yang lembap berpadu dengan hawa dingin yang menusuk telapak tangan.",
      outlineOrientasi:
        "Damar menemukan jam saku perunggu di loteng perpustakaan tua saat menghindari teguran karena memecahkan piala kelas.",
      outlineKomplikasiKlimaks:
        "Bayang Waktu membujuk Damar memutar jam agar lolos dari masalah, tetapi sepatu basket kesayangannya berubah menjadi batu dan waktu mulai retak.",
      outlineResolusi:
        "Damar menghentikan putaran jam, berani meminta maaf secara jujur di sekolah, dan belajar bertanggung jawab.",
      paragraphOrientasi:
        "Di dalam Loteng Perpustakaan Tua yang temaram, Damar melangkah pelan sambil menyeka keringat dinginnya. Cahaya keemasan berpendar dari sebuah jam saku perunggu di atas meja kayu berdebu. Aroma kertas kuno yang lembap menyergap hidungnya ketika ia memungut benda peninggalan kakeknya itu.",
      paragraphKomplikasi:
        "Tiba-tiba detak jarum jam menggema berat dan memunculkan sosok Bayang Waktu dari balik lemari tua. Sosok dingin itu mendesak Damar agar memutar jarum jam untuk menyembunyikan kesalahannya memecahkan piala kelas.",
      paragraphKlimaks:
        'Bayang Waktu melayang mendekat laksana kabut hitam pekat lalu berbisik, "Putarlah jarum itu sekarang agar tak seorang pun tahu kesalahanmu!" Namun Damar teringat aturan jam itu: ketika ia memutarnya sekali, sepatu kesayangannya seketika membeku menjadi batu dingin.',
      paragraphResolusi:
        "Akhirnya Damar menolak bujukan Bayang Waktu dan menutup rapat penutup jam perunggu tersebut. Ia mengatakan bahwa kejujuran jauh lebih berharga daripada pelarian semu. Keesokan paginya, Damar berani mengakui kesalahannya kepada guru dan berjanji memperbaiki piala itu dengan penuh tanggung jawab.",
      storyTitle: "Detak Terakhir Jam Saku Perunggu",
      amanat:
        "Beranilah mengakui kesalahan secara jujur karena jalan pintas untuk lari dari tanggung jawab selalu menuntut harga yang lebih berat.",
    },
  },
  {
    id: "seed-sihir",
    badge: "Inspirasi 2 · Akademi Sihir",
    title: "Lentera Tinta Hidup",
    description:
      "Terinspirasi dari 'Sihir Unik Mao': murid akademi yang diremehkan karena hanya mampu menyihir lukisan cahaya, namun justru menyelamatkan teman-temannya.",
    draftPreset: {
      themeCategory: "Dunia Sihir & Akademi",
      worldRule:
        "Tinta cahaya hanya dapat menyala di kegelapan apabila penulisnya menuliskan perasaan yang tulus tanpa rasa dendam.",
      protagonistName: "Kinan",
      protagonistTraitAction:
        "Tekun dan pemaaf: tetap menolong temannya yang sombong saat lorong akademi terkunci kabut gelap.",
      antagonistName: "Rora",
      antagonistConflictTrigger:
        "Sering mencemooh sihir lukisan Kinan sebagai sihir lemah yang tidak berguna dalam ujian.",
      settingPlace: "Aula Menara Lentera",
      sensorySight:
        "Goresan tinta biru safir melayang di udara membentuk burung cahaya yang berkilau.",
      sensorySound:
        "Desir angin malam menderu di balik jendela kaca patri disusul gemerisik pena bulu.",
      sensorySmellTouch:
        "Harum damar hangat dari lentera menenangkan udara aula yang semula sedingin es.",
      outlineOrientasi:
        "Kinan berlatih sihir lukisan tinta di Aula Menara Lentera meski Rora sering menertawakannya.",
      outlineKomplikasiKlimaks:
        "Saat badai memadamkan seluruh obor menara, mantra api Rora gagal karena ia panik, sementara kegelapan mengepung mereka.",
      outlineResolusi:
        "Kinan menggoreskan tinta cahaya dengan hati tulus untuk menerangi jalan keluar hingga Rora meminta maaf.",
      paragraphOrientasi:
        "Malam itu di Aula Menara Lentera, Kinan masih tekun menggoreskan pena bulunya di atas perkamen tua. Goresan tinta biru safir melayang di udara, sementara harum damar hangat memenuhi ruangan. Meskipun Rora sering mengejek bakatnya, Kinan tidak pernah berhenti berlatih.",
      paragraphKomplikasi:
        "Seketika badai petir menghantam atap menara dan memadamkan seluruh obor hingga aula terkunci dalam kegelapan pekat. Udara berubah sedingin es sementara suara angin menderu kencang dari balik jendela kaca patri.",
      paragraphKlimaks:
        'Di tengah kepanikan itu, Rora berseru dengan suara gemetar, "Tolong, mantra apiku sama sekali tidak bisa menyala di tengah kabut gelap ini!" Kinan segera menggoreskan kuasnya dengan hati tulus hingga lukisan tintanya berpendar terang bagaikan bintang kejora di langit malam.',
      paragraphResolusi:
        "Namun Kinan tidak membiarkan Rora tertinggal sendirian di dalam lorong yang dingin. Burung cahaya ciptaan Kinan menuntun mereka keluar menuju gerbang utama dengan selamat. Akhirnya Rora menyatakan bahwa ia sangat menyesal telah meremehkan keunikan sihir sahabatnya itu.",
      storyTitle: "Goresan Cahaya di Menara Lentera",
      amanat:
        "Jangan meremehkan keunikan bakat orang lain, sebab ketekunan dan ketulusan hati mampu menjadi penolong di saat paling genting.",
    },
  },
  {
    id: "seed-nusantara",
    badge: "Inspirasi 3 · Pusaka Nusantara",
    title: "Empat Biji Kemiri Penjaga Hutan",
    description:
      "Terinspirasi dari 'Keberanian Emas': petualangan menghadapi pemburu serakah dengan bekal empat biji kemiri bertuah yang bertingkat daya magisnya.",
    draftPreset: {
      themeCategory: "Mitos & Pusaka Nusantara",
      worldRule:
        "Empat biji kemiri pusaka hanya boleh dilempar satu per satu secara berurutan untuk melindungi hutan, bukan untuk menyakiti makhluk tak bersalah.",
      protagonistName: "Galih",
      protagonistTraitAction:
        "Pemberani dan cerdik: menggunakan keempat biji kemiri secara bertahap tanpa panik saat dikejar Raksasa Kabut.",
      antagonistName: "Raksasa Kabut",
      antagonistConflictTrigger:
        "Berusaha merampas mata air hutan larangan hingga mengeringkan desa di kaki gunung.",
      settingPlace: "Lembah Hutan Larangan",
      sensorySight:
        "Akar-akar pohon beringin raksasa berpendar hijau zamrud di sela kabut tebal.",
      sensorySound:
        "Gemuruh langkah Raksasa Kabut merontokkan ranting kering diiringi deru air terjun.",
      sensorySmellTouch:
        "Aroma tanah basah sehabis hujan dan percikan embun dingin menyentuh wajah Galih.",
      outlineOrientasi:
        "Galih menerima empat biji kemiri pusaka dari Kakek Penjaga Lembah Hutan Larangan untuk menyelamatkan mata air desa.",
      outlineKomplikasiKlimaks:
        "Raksasa Kabut mengejar Galih; Galih melempar biji kemiri secara bertahap dari semak berduri hingga dinding batu menjulang di puncak tebing.",
      outlineResolusi:
        "Biji kemiri terakhir memancarkan cahaya matahari yang membubarkan Raksasa Kabut dan memulihkan mata air desa.",
      paragraphOrientasi:
        "Di Lembah Hutan Larangan yang diselimuti aroma tanah basah, Galih menggenggam erat kantong berisi empat biji kemiri pusaka. Akar-akar pohon beringin tampak berpendar hijau zamrud di sela kabut. Ia harus menjaga mata air desa agar tidak dikuasai oleh keserakahan Raksasa Kabut.",
      paragraphKomplikasi:
        "Tiba-tiba gemuruh langkah Raksasa Kabut menggetarkan tanah hutan dan merontokkan ranting-ranting kering. Makhluk besar itu menghadang jalan setapak menuju tebing sambil mengulurkan tangannya yang sedingin batu sungai.",
      paragraphKlimaks:
        'Raksasa Kabut berteriak dengan suara menggelegar, "Serahkan kantong pusaka itu sekarang juga, anak kecil!" Galih berlari kencang seperti anak panah yang melesat dari busurnya, lalu melemparkan biji kemiri secara bertahap hingga tumbuh benteng bambu dan pusaran angin yang menahan langkah sang raksasa.',
      paragraphResolusi:
        "Ketika mencapai puncak tebing, Galih melemparkan biji kemiri keempat yang seketika memancarkan sinar keemasan hangat. Raksasa Kabut mengakui bahwa ia tidak sanggup melawan cahaya murni penjaga alam, lalu menghilang bersama angin. Akhirnya aliran mata air kembali jernih menghidupi seluruh warga desa.",
      storyTitle: "Rahasia Empat Kemiri Lembah Larangan",
      amanat:
        "Keberanian, kecerdikan, dan ketulusan menjaga kelestarian alam akan mengalahkan keserakahan yang merusak.",
    },
  },
];

// ============================================================================
// AUTHORITY LAYER: EYD V RULE PROVIDER & CURATED LEXICON PROVIDER
// ============================================================================

const LOCATIVE_NOUNS_MERGED = [
  "perpustakaan",
  "sekolah",
  "rumah",
  "dalam",
  "atas",
  "bawah",
  "depan",
  "belakang",
  "samping",
  "sana",
  "sini",
  "situ",
  "mana",
  "hutan",
  "kamar",
  "kelas",
  "meja",
  "kursi",
  "sudut",
  "tengah",
  "luar",
  "ujung",
  "balik",
  "antara",
  "pinggir",
  "tepi",
  "desa",
  "kota",
  "gunung",
  "lembah",
  "gua",
  "menara",
  "dunia",
  "istana",
  "kastel",
  "gerbang",
  "pasar",
  "kantin",
  "sungai",
  "laut",
  "langit",
  "puncak",
  "seberang",
  "sekitar",
  "dekat",
  "halaman",
  "lorong",
  "jembatan",
  "taman",
  "pantai",
  "pulau",
  "negeri",
  "kerajaan",
  "ruangan",
  "loteng",
  "aula",
  "dinding",
  "lantai",
] as const;

const KE_LOCATIVE_NOUNS_MERGED = [
  "atas",
  "bawah",
  "dalam",
  "depan",
  "belakang",
  "sana",
  "sini",
  "situ",
  "mana",
  "sekolah",
  "rumah",
  "hutan",
  "istana",
  "lorong",
  "perpustakaan",
] as const;

interface CuratedLexiconEntry {
  readonly nonStandard: string;
  readonly standard: string;
  readonly note: string;
  readonly verifiedDate: string;
}

const CURATED_NON_STANDARD_LEXICON: readonly CuratedLexiconEntry[] = [
  {
    nonStandard: "resiko",
    standard: "risiko",
    note: "Bentuk baku menurut KBBI VI Daring (diverifikasi manual oleh kurator Aksaraloka).",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "nasehat",
    standard: "nasihat",
    note: "Bentuk baku menurut KBBI VI Daring; gunakan 'nasihat' dan 'menasihati'.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "praktek",
    standard: "praktik",
    note: "Bentuk baku serapan menurut KBBI VI Daring dan EYD V.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "apotik",
    standard: "apotek",
    note: "Bentuk baku menurut KBBI VI Daring (pasangan kata: apotek - apoteker).",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "sekedar",
    standard: "sekadar",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'sekadar'.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "nafas",
    standard: "napas",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'napas' (bernapas).",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "hembus",
    standard: "embus",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'embus' (berembus, embusan).",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "kawatir",
    standard: "khawatir",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'khawatir'.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "kuatir",
    standard: "khawatir",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'khawatir'.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "jaman",
    standard: "zaman",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'zaman'.",
    verifiedDate: "2026-10-03",
  },
  {
    nonStandard: "lembab",
    standard: "lembap",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'lembap' (berakhiran -p).",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "mahluk",
    standard: "makhluk",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'makhluk' (memakai 'kh').",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "karna",
    standard: "karena",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'karena'.",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "aktifitas",
    standard: "aktivitas",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'aktivitas'.",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "merubah",
    standard: "mengubah",
    note: "Kata dasarnya 'ubah', sehingga bentuk berimbuhan bakunya adalah 'mengubah'.",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "terlanjur",
    standard: "telanjur",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'telanjur'.",
    verifiedDate: "2026-11-22",
  },
  {
    nonStandard: "fikir",
    standard: "pikir",
    note: "Bentuk baku menurut KBBI VI Daring adalah 'pikir' (berpikir, pikiran).",
    verifiedDate: "2026-11-22",
  },
];

/**
 * KbbiLinkProvider: menghasilkan URL rujukan resmi ke KBBI VI Daring
 * tanpa melakukan scraping atau mengklaim API resmi (sesuai docs/authority-sources-audit.md).
 */
export function buildKbbiReferenceUrl(word: string): string {
  const cleaned = word.trim().toLowerCase().replace(/[^a-z-\s]/g, "");
  return `https://kbbi.kemendikdasmen.go.id/entri/${encodeURIComponent(cleaned || "narasi")}`;
}

export function buildEydReferenceUrl(): string {
  return "https://ejaan.kemendikdasmen.go.id/";
}

/**
 * Menjalankan audit deterministik EYD Edisi V & Leksikon Baku terhadap teks siswa.
 */
export function auditEydAndLexicon(fullText: string): readonly EydAndLexiconIssue[] {
  const issues: EydAndLexiconIssue[] = [];
  if (!fullText.trim()) return issues;

  // 1. EydRuleProvider: Kata depan 'di' yang digabung dengan kata benda tempat/arah
  for (const noun of LOCATIVE_NOUNS_MERGED) {
    const regex = new RegExp(`\\b(di)(${noun})\\b`, "gi");
    const match = regex.exec(fullText);
    if (match && match[0]) {
      const found = match[0];
      const prefix = found.slice(0, 2);
      const rest = found.slice(2);
      issues.push({
        id: `eyd-di-${noun}`,
        foundText: found,
        suggestion: `${prefix} ${rest}`,
        explanation: `Kata depan '${prefix}' yang menunjukkan tempat atau arah wajib ditulis terpisah dari kata '${rest}'.`,
        ruleReference: "Aturan Penulisan Kata Depan ('di' dipisah)",
        referenceUrl: "https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/kata-depan/",
        verificationStatus: "deterministic_rule",
      });
    }
  }

  // 1b. EydRuleProvider: Kata depan 'ke' yang digabung dengan kata tempat/arah
  for (const noun of KE_LOCATIVE_NOUNS_MERGED) {
    const regex = new RegExp(`\\b(ke)(${noun})\\b`, "gi");
    const match = regex.exec(fullText);
    if (match && match[0]) {
      const found = match[0];
      const prefix = found.slice(0, 2);
      const rest = found.slice(2);
      issues.push({
        id: `eyd-ke-${noun}`,
        foundText: found,
        suggestion: `${prefix} ${rest}`,
        explanation: `Kata depan '${prefix}' yang menunjukkan arah atau tempat wajib ditulis terpisah dari kata '${rest}'.`,
        ruleReference: "Aturan Penulisan Kata Depan ('ke' dipisah)",
        referenceUrl: "https://ejaan.kemendikdasmen.go.id/eyd/penulisan-kata/kata-depan/",
        verificationStatus: "deterministic_rule",
      });
    }
  }

  // 2. EydRuleProvider: Tanda baca titik/koma/seru/tanya yang diletakkan di luar tanda petik penutup
  const misplacedQuotePunctRegex = /["”]([.,!?])/g;
  const quoteMatches = Array.from(fullText.matchAll(misplacedQuotePunctRegex));
  if (quoteMatches.length > 0) {
    const first = quoteMatches[0]!;
    const punct = first[1]!;
    issues.push({
      id: "eyd-quote-punct",
      foundText:
        quoteMatches.length > 1
          ? `${first[0]} (${quoteMatches.length} bagian)`
          : first[0],
      suggestion: `${punct}"`,
      explanation:
        "Pada kalimat langsung, tanda baca penutup kalimat (titik, koma, tanda seru, atau tanda tanya) diletakkan di dalam (sebelum) tanda petik penutup.",
      ruleReference: "Aturan Tanda Baca Dialog (\"...\")",
      referenceUrl: "https://ejaan.kemendikdasmen.go.id/eyd/penggunaan-tanda-baca/tanda-petik/",
      verificationStatus: "deterministic_rule",
    });
  }

  // 3. CuratedLexiconProvider: Kata tidak baku yang sering muncul di karangan siswa
  for (const entry of CURATED_NON_STANDARD_LEXICON) {
    const regex = new RegExp(`\\b${entry.nonStandard}\\b`, "i");
    const match = regex.exec(fullText);
    if (match && match[0]) {
      issues.push({
        id: `lex-${entry.nonStandard}`,
        foundText: match[0],
        suggestion: entry.standard,
        explanation: `${entry.note} (Verifikasi: ${entry.verifiedDate}).`,
        ruleReference: `Cek Kata Baku '${entry.standard}' di Kamus`,
        referenceUrl: buildKbbiReferenceUrl(entry.standard),
        verificationStatus: "authority_verified",
      });
    }
  }

  return issues;
}

/**
 * Menerapkan seluruh saran perbaikan otomatis EYD V & Leksikon Baku ke sebuah string paragraf.
 */
export function applyAutomaticEydFixes(text: string): string {
  let result = text;

  for (const noun of LOCATIVE_NOUNS_MERGED) {
    const regex = new RegExp(`\\b(di)(${noun})\\b`, "gi");
    result = result.replace(regex, (_full, p1: string, p2: string) => `${p1} ${p2}`);
  }

  for (const noun of KE_LOCATIVE_NOUNS_MERGED) {
    const regex = new RegExp(`\\b(ke)(${noun})\\b`, "gi");
    result = result.replace(regex, (_full, p1: string, p2: string) => `${p1} ${p2}`);
  }

  result = result.replace(/["”]([.,!?])/g, (_full, punct: string) => `${punct}"`);

  for (const entry of CURATED_NON_STANDARD_LEXICON) {
    const regex = new RegExp(`\\b${entry.nonStandard}\\b`, "gi");
    result = result.replace(regex, (matched) => {
      const isCapitalized =
        matched.length > 0 &&
        matched[0] === matched[0]?.toUpperCase() &&
        matched[0] !== matched[0]?.toLowerCase();
      if (isCapitalized && entry.standard.length > 0) {
        return entry.standard[0]!.toUpperCase() + entry.standard.slice(1);
      }
      return entry.standard;
    });
  }

  return result;
}

// ============================================================================
// LIVE LITERARY DETECTOR: 5 INDIKATOR KOMPETENSI MENULIS NARATIF
// ============================================================================

const SCAFFOLD_PLACEHOLDER_REGEX = /\[[^\]\n]{3,110}\]/g;

function stripScaffoldPlaceholders(text: string): string {
  return text.replace(SCAFFOLD_PLACEHOLDER_REGEX, " ");
}

function countScaffoldPlaceholders(text: string): number {
  return (text.match(SCAFFOLD_PLACEHOLDER_REGEX) ?? []).length;
}

function countWords(text: string): number {
  const cleaned = stripScaffoldPlaceholders(text).trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

const SENSORY_KEYWORDS = [
  // Visual / Penglihatan & Cahaya
  "berpendar",
  "pendar",
  "cahaya",
  "bercahaya",
  "sinar",
  "bersinar",
  "temaram",
  "remang",
  "berkilau",
  "kilau",
  "berkilat",
  "kilat",
  "silau",
  "menyilaukan",
  "gemerlap",
  "gelap",
  "kegelapan",
  "pekat",
  "bayangan",
  "kabut",
  "berkabut",
  "merah",
  "biru",
  "emas",
  "keemasan",
  "keperakan",
  "jingga",
  "ungu",
  "hijau",
  "zamrud",
  "safir",
  "berkedip",
  // Auditif / Pendengaran & Suara
  "suara",
  "bersuara",
  "gemuruh",
  "bergemuruh",
  "dentuman",
  "berdentum",
  "bisik",
  "berbisik",
  "bisikan",
  "derit",
  "berderit",
  "gemerisik",
  "detak",
  "berdetak",
  "menggema",
  "gema",
  "hening",
  "sunyi",
  "senyap",
  "teriak",
  "berteriak",
  "berseru",
  "geraman",
  "menggeram",
  "mengaum",
  "deru",
  "menderu",
  "desir",
  "berdesir",
  "melengking",
  "gemerincing",
  "nyaring",
  "menggelegar",
  // Olfaktoris, Taktil & Pengecapan (Aroma, Suhu, Sentuhan, Rasa)
  "aroma",
  "harum",
  "wangi",
  "bau",
  "amis",
  "pengap",
  "semerbak",
  "dingin",
  "sedingin",
  "sejuk",
  "hangat",
  "panas",
  "membakar",
  "membeku",
  "lembap",
  "basah",
  "kering",
  "kasar",
  "halus",
  "licin",
  "tajam",
  "perih",
  "gemetar",
  "menggigil",
  "menusuk",
  "angin",
  "embun",
  "manis",
  "pahit",
  "asin",
  "asam",
  "gurih",
] as const;

const NON_METAPHOR_SEPERTI_STARTERS = new Set([
  "biasa",
  "biasanya",
  "ini",
  "itu",
  "yang",
  "semula",
  "sebelumnya",
  "tadi",
  "kemarin",
  "halnya",
  "terlihat",
  "tampak",
  "dikatakan",
  "disebutkan",
  "seharusnya",
  "sediakala",
  "misalnya",
  "contohnya",
]);

const INDIRECT_SPEECH_MARKERS = [
  "mengatakan bahwa",
  "menyatakan bahwa",
  "berkata bahwa",
  "mengakui bahwa",
  "menyadari bahwa",
  "berjanji bahwa",
  "menceritakan bahwa",
  "bercerita bahwa",
  "berpikir bahwa",
  "menjelaskan bahwa",
  "mengingatkan bahwa",
  "memperingatkan bahwa",
  "meyakinkan bahwa",
  "menegaskan bahwa",
  "mengabarkan bahwa",
  "menjawab bahwa",
  "mengaku bahwa",
  "berpesan bahwa",
  "berharap bahwa",
  "memutuskan bahwa",
  "meminta agar",
  "menyuruh agar",
  "berpesan agar",
  "mengingatkan agar",
  "memperingatkan agar",
  "berharap agar",
  "mengajak agar",
  "menyarankan agar",
  "menyemangati",
  "mengancam akan",
] as const;

const CHRONOLOGICAL_CONNECTORS = [
  "tiba-tiba",
  "seketika",
  "namun",
  "tetapi",
  "akhirnya",
  "kemudian",
  "lalu",
  "perlahan",
  "keesokan",
  "ketika",
  "setelah",
  "sebelum",
  "sejak saat itu",
  "tak lama kemudian",
] as const;

const CHRONOLOGICAL_AND_INDIRECT_MARKERS = [
  ...INDIRECT_SPEECH_MARKERS,
  ...CHRONOLOGICAL_CONNECTORS,
] as const;

export function analyzeStudentManuscript(draft: StudioDraftData): LiteraryAnalysisResult {
  const orientasiWords = countWords(draft.paragraphOrientasi);
  const komplikasiWords = countWords(draft.paragraphKomplikasi ?? "");
  const klimaksWords = countWords(draft.paragraphKlimaks);
  const resolusiWords = countWords(draft.paragraphResolusi);
  const extraTexts = (draft.extraSpreads ?? [])
    .map((s) => `${s.leftText}\n${s.rightText}`)
    .join("\n");
  const extraWords = countWords(extraTexts);
  const totalWords =
    orientasiWords + komplikasiWords + klimaksWords + resolusiWords + extraWords;

  const rawCombinedParagraphs = `${draft.paragraphOrientasi}\n${
    draft.paragraphKomplikasi ?? ""
  }\n${draft.paragraphKlimaks}\n${draft.paragraphResolusi}${
    extraTexts.trim() ? `\n${extraTexts}` : ""
  }`;
  const unfilledPlaceholderCount = countScaffoldPlaceholders(rawCombinedParagraphs);
  const combinedParagraphs = stripScaffoldPlaceholders(rawCombinedParagraphs);
  const lowerCombined = combinedParagraphs.toLowerCase();

  // --------------------------------------------------------------------------
  // 1. Indikator Struktur Alur, Aturan Dunia, & Amanat (Bobot 20)
  // --------------------------------------------------------------------------
  const hasAllFourStages =
    orientasiWords >= 12 &&
    komplikasiWords >= 8 &&
    klimaksWords >= 10 &&
    resolusiWords >= 12;
  const hasTitleAndAmanat =
    draft.storyTitle.trim().length >= 3 && draft.amanat.trim().length >= 10;
  const hasWorldRule = draft.worldRule.trim().length >= 10;

  const strukturPassed = hasAllFourStages && hasTitleAndAmanat && hasWorldRule;
  const strukturPartialScore =
    (orientasiWords >= 12 ? 4 : orientasiWords > 0 ? 2 : 0) +
    (komplikasiWords >= 8 ? 4 : komplikasiWords > 0 ? 2 : 0) +
    (klimaksWords >= 10 ? 4 : klimaksWords > 0 ? 2 : 0) +
    (resolusiWords >= 12 ? 4 : resolusiWords > 0 ? 2 : 0) +
    (hasTitleAndAmanat && hasWorldRule ? 4 : hasTitleAndAmanat || hasWorldRule ? 2 : 0);

  const strukturSnippets: string[] = [];
  if (orientasiWords > 0) strukturSnippets.push(`Orientasi: ${orientasiWords} kata`);
  if (komplikasiWords > 0) strukturSnippets.push(`Komplikasi: ${komplikasiWords} kata`);
  if (klimaksWords > 0) strukturSnippets.push(`Klimaks: ${klimaksWords} kata`);
  if (resolusiWords > 0) strukturSnippets.push(`Resolusi: ${resolusiWords} kata`);

  // --------------------------------------------------------------------------
  // 2. Indikator Konsistensi Tokoh, Latar, & Detail Lima Indera (Bobot 20)
  // --------------------------------------------------------------------------
  const protag = draft.protagonistName.trim();
  const antag = draft.antagonistName.trim();
  const place = draft.settingPlace.trim();

  const protagUsed =
    protag.length >= 2 && lowerCombined.includes(protag.toLowerCase());
  const antagUsed =
    antag.length >= 2 && lowerCombined.includes(antag.toLowerCase());
  const placeUsed =
    place.length >= 2 && lowerCombined.includes(place.toLowerCase());

  const detectedSensoryWords = SENSORY_KEYWORDS.filter((kw) =>
    new RegExp(`\\b${kw}\\b`, "i").test(combinedParagraphs)
  );

  const konsistensiPassed =
    protagUsed &&
    (antagUsed || placeUsed) &&
    detectedSensoryWords.length >= 2;

  const konsistensiSnippets: string[] = [];
  if (protagUsed) konsistensiSnippets.push(`Tokoh Utama: "${protag}"`);
  if (antagUsed) konsistensiSnippets.push(`Tokoh Lawan: "${antag}"`);
  if (placeUsed) konsistensiSnippets.push(`Latar: "${place}"`);
  if (detectedSensoryWords.length > 0) {
    konsistensiSnippets.push(
      `Diksi Indera (${detectedSensoryWords.length}): ${detectedSensoryWords.slice(0, 4).join(", ")}`
    );
  }

  const konsistensiEarned = konsistensiPassed
    ? 20
    : Math.min(
        18,
        (protagUsed ? 6 : 0) +
          (antagUsed ? 4 : 0) +
          (placeUsed ? 4 : 0) +
          Math.min(6, detectedSensoryWords.length * 3)
      );

  // --------------------------------------------------------------------------
  // 3. Indikator Majas Asosiasi / Perumpamaan (Hlm. 63, Bobot 20)
  // --------------------------------------------------------------------------
  const majasRegex =
    /\b(seperti|bagaikan|bagai|laksana|seumpama|bak)\s+([a-zA-ZÀ-ÿ-]+(?:\s+[a-zA-ZÀ-ÿ-]+){1,4})/gi;
  const validMajasMatches: string[] = [];
  for (const m of combinedParagraphs.matchAll(majasRegex)) {
    const connector = (m[1] ?? "").toLowerCase();
    const rest = (m[2] ?? "").trim();
    const firstWordAfterConnector = rest.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (
      connector === "seperti" &&
      NON_METAPHOR_SEPERTI_STARTERS.has(firstWordAfterConnector)
    ) {
      continue;
    }
    validMajasMatches.push(m[0].trim());
  }
  const uniqueMajas = Array.from(new Set(validMajasMatches));
  const majasPassed = uniqueMajas.length >= 1;

  // --------------------------------------------------------------------------
  // 4. Indikator Kalimat Langsung / Dialog Tokoh EYD V (Hlm. 69, Bobot 20)
  // --------------------------------------------------------------------------
  const directSpeechRegex = /["“]([^"”]{5,180})["”]/g;
  const dialogMatches: string[] = [];
  let dlgMatch = directSpeechRegex.exec(combinedParagraphs);
  while (dlgMatch !== null) {
    if (dlgMatch[0] && dlgMatch[1] && dlgMatch[1].trim().length >= 5) {
      dialogMatches.push(dlgMatch[0].trim());
    }
    dlgMatch = directSpeechRegex.exec(combinedParagraphs);
  }

  const hasValidPunctInsideQuote = dialogMatches.some((q) =>
    /[,.!?]["”]$/.test(q)
  );
  const dialogPassed = dialogMatches.length >= 1 && hasValidPunctInsideQuote;
  const dialogEarned = dialogPassed
    ? 20
    : dialogMatches.length >= 1
      ? 12
      : 0;

  // --------------------------------------------------------------------------
  // 5. Indikator Kalimat Tak Langsung & Konjungsi Alur (Hlm. 69-70, Bobot 20)
  // --------------------------------------------------------------------------
  const detectedMarkers = CHRONOLOGICAL_AND_INDIRECT_MARKERS.filter((m) =>
    lowerCombined.includes(m)
  );
  const hasIndirectMarker = INDIRECT_SPEECH_MARKERS.some((m) =>
    lowerCombined.includes(m)
  );
  const hasChronologicalMarker = CHRONOLOGICAL_CONNECTORS.some((m) =>
    lowerCombined.includes(m)
  );

  const takLangsungPassed = hasIndirectMarker && hasChronologicalMarker;
  const takLangsungEarned = takLangsungPassed
    ? 20
    : Math.min(
        15,
        (hasIndirectMarker ? 10 : 0) + (hasChronologicalMarker ? 6 : 0)
      );

  const indicators: readonly LiteraryIndicatorStatus[] = [
    {
      id: "struktur",
      title: "1. Kelengkapan Cerita, Aturan Ajaib & Pesan",
      tpCode: "TP 1 & TP 2",
      passed: strukturPassed,
      scoreWeight: 20,
      earnedScore: strukturPassed ? 20 : strukturPartialScore,
      summary: strukturPassed
        ? `Hebat! Keempat tahap ceritamu sudah lengkap (${totalWords} kata) beserta aturan keajaiban dan pesan kebaikan.`
        : "Yuk lengkapi dulu! Pastikan Awal (min. 12 kata), Muncul Masalah (min. 8 kata), Puncak (min. 10 kata), dan Akhir (min. 12 kata) serta Judul, Aturan Keajaiban, dan Pesan Cerita sudah terisi.",
      detectedSnippets: strukturSnippets,
      improvementHint:
        "Isi semua 4 bagian cerita (Awal, Muncul Masalah, Puncak, Akhir), lalu lengkapi Judul, Aturan Keajaiban, dan Pesan Kebaikan.",
    },
    {
      id: "konsistensi_indera",
      title: "2. Nama Tokoh, Tempat, & Kata Panca Indera",
      tpCode: "TP 3",
      passed: konsistensiPassed,
      scoreWeight: 20,
      earnedScore: konsistensiEarned,
      summary: konsistensiPassed
        ? "Mantap! Nama tokoh, tempat kejadian, dan kata-kata panca indera sudah hidup di dalam ceritamu."
        : "Sebutkan nama Tokoh Utama dan Lawan/Tempat dari Lembar 1 di dalam ceritamu, lalu tambahkan minimal 2 kata panca indera.",
      detectedSnippets: konsistensiSnippets,
      improvementHint:
        "Pakai nama tokoh dan tempat yang kamu tulis di Lembar 1, lalu tambahkan kata suasana seperti 'berpendar', 'gemuruh', 'harum', atau 'dingin'.",
    },
    {
      id: "majas_asosiasi",
      title: "3. Kalimat Perumpamaan (Majas Asosiasi)",
      tpCode: "TP 4 (Hlm. 63)",
      passed: majasPassed,
      scoreWeight: 20,
      earnedScore: majasPassed ? 20 : 0,
      summary: majasPassed
        ? `Keren! Ditemukan ${uniqueMajas.length} kalimat perumpamaan di dalam ceritamu.`
        : "Belum ada kalimat perumpamaan di dalam ceritamu.",
      detectedSnippets: uniqueMajas,
      improvementHint:
        "Coba tambahkan perumpamaan dengan kata 'seperti', 'bagaikan', 'laksana', atau 'bak' (atau klik tombol '+ Perumpamaan' di Lembar 3!).",
    },
    {
      id: "dialog_langsung",
      title: "4. Dialog Tokoh Bertanda Petik (\"...\")",
      tpCode: "TP 4 (Hlm. 69)",
      passed: dialogPassed,
      scoreWeight: 20,
      earnedScore: dialogEarned,
      summary: dialogPassed
        ? "Bagus sekali! Dialog tokohmu sudah memakai tanda petik dua dan tanda baca yang rapi."
        : dialogMatches.length >= 1
          ? "Dialog sudah ada, tapi pastikan tanda seru/tanya/titik ditaruh DI DALAM sebelum tanda petik penutup ya!"
          : "Belum ada ucapan langsung tokoh yang memakai tanda petik dua (\"...\").",
      detectedSnippets: dialogMatches,
      improvementHint:
        'Tambahkan obrolan tokoh memakai tanda petik dua, contohnya: Raksasa berseru, "Jangan lari!" (atau klik tombol "+ Dialog" di Lembar 3).',
    },
    {
      id: "tak_langsung_konjungsi",
      title: "5. Kalimat Tak Langsung & Kata Penghubung Waktu",
      tpCode: "TP 4 & TP 5",
      passed: takLangsungPassed,
      scoreWeight: 20,
      earnedScore: takLangsungEarned,
      summary: takLangsungPassed
        ? "Lengkap! Kamu sudah memakai kalimat tak langsung dan kata penghubung waktu dengan baik."
        : "Tambahkan kalimat tak langsung (contoh: 'mengatakan bahwa...') dan kata penghubung waktu ('tiba-tiba', 'namun', 'akhirnya').",
      detectedSnippets: detectedMarkers,
      improvementHint:
        "Gunakan kalimat seperti 'mengatakan bahwa' / 'menyadari bahwa' serta kata 'tiba-tiba', 'seketika', atau 'akhirnya' (bisa klik tombol bantu di Lembar 2 & 3!).",
    },
  ];

  const passedIndicatorsCount = indicators.filter((i) => i.passed).length;
  const rawIndicatorSum = indicators.reduce((acc, item) => acc + item.earnedScore, 0);

  const revisionCheckedCount = SELF_REVISION_CHECKLIST.filter(
    (item) => draft.selfRevisionChecks[item.id] === true
  ).length;

  const eydAndLexiconIssues = auditEydAndLexicon(combinedParagraphs);

  const isModelPresetReference = Boolean(draft.isModelPresetReference);
  const studioScore = Math.min(100, Math.round(rawIndicatorSum));
  const isReadyForSeal =
    !isModelPresetReference &&
    unfilledPlaceholderCount === 0 &&
    passedIndicatorsCount >= 4 &&
    revisionCheckedCount >= 3 &&
    eydAndLexiconIssues.length === 0;

  return {
    totalWords,
    orientasiWords,
    komplikasiWords,
    klimaksWords,
    resolusiWords,
    isModelPresetReference,
    unfilledPlaceholderCount,
    indicators,
    passedIndicatorsCount,
    revisionCheckedCount,
    totalRevisionChecklistCount: SELF_REVISION_CHECKLIST.length,
    eydAndLexiconIssues,
    studioScore,
    isReadyForSeal,
  };
}
