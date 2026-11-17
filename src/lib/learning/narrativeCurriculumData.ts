/**
 * Kurikulum Bahasa Indonesia Kelas VII SMP (Fase D) — Bab II: Berkelana di Dunia Imajinasi
 * Bagian B & C: Elemen dan Keterampilan Menulis Teks Naratif / Cerita Fantasi (Halaman 52–70)
 *
 * Disusun dengan UX Microcopy & Quest Prompts ramah siswa Kelas VII SMP (usia 12–13 tahun).
 */

export type GrimoireChapterId = "alur" | "watak" | "bahasa";

export interface TujuanPembelajaranItem {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly targetIssue: string;
  readonly mediaRole: string;
  readonly targetDestination: "alur" | "watak" | "bahasa" | "studio";
}

export const TUJUAN_PEMBELAJARAN_LIST: readonly TujuanPembelajaranItem[] = [
  {
    id: "tp-1",
    code: "TP 1",
    title: "Mengenali Bagian & Unsur Cerita Fantasi",
    description:
      "Mengenali tokoh, latar tempat, pesan cerita (amanat), dan urutan jalan cerita (awal, masalah, puncak, akhir) dari kisah contoh.",
    targetIssue: "Bagian cerita belum lengkap & pesan kebaikan belum terlihat.",
    mediaRole: "3 kisah contoh bergambar/bersuara & permainan Gunung Alur.",
    targetDestination: "alur",
  },
  {
    id: "tp-2",
    code: "TP 2",
    title: "Mencari Ide & Menyusun Rencana Cerita",
    description:
      "Menemukan ide cerita fantasi yang seru dan menyusun urutan kejadiannya supaya tidak melompat-lompat.",
    targetIssue: "Bingung mencari ide awal & jalan cerita mudah melompat-lompat.",
    mediaRole: "3 Contoh Ide Cerita, Aturan Keajaiban, dan Lembar Rencana Cerita.",
    targetDestination: "studio",
  },
  {
    id: "tp-3",
    code: "TP 3",
    title: "Menghidupkan Tokoh & Suasana Panca Indera",
    description:
      "Mengembangkan cerita dengan sifat tokoh yang terlihat dari aksinya dan gambaran tempat yang melibatkan panca indera.",
    targetIssue: "Tokoh terasa datar dan gambaran tempat masih terlalu singkat.",
    mediaRole: "Tebak Bukti Sifat Mao & Emas serta latihan kalimat Panca Indera.",
    targetDestination: "watak",
  },
  {
    id: "tp-4",
    code: "TP 4",
    title: "Memakai Perumpamaan & Dialog yang Tepat",
    description:
      "Menggunakan kata-kata khas fantasi, perumpamaan (seperti/bagaikan), serta kalimat langsung dan tak langsung dengan benar.",
    targetIssue: "Pilihan kata masih sedikit dan tanda baca dialog sering keliru.",
    mediaRole: "Kamus Kata Fantasi, Pasangkan Perumpamaan, dan Ubah Kalimat Dialog.",
    targetDestination: "bahasa",
  },
  {
    id: "tp-5",
    code: "TP 5",
    title: "Memeriksa & Merapikan Tulisan Sendiri",
    description:
      "Mengecek kembali kelengkapan cerita, kelogisan jalan cerita, dan ejaan kata sebelum dikumpulkan.",
    targetIssue: "Buru-buru mengumpulkan cerita tanpa diperiksa lagi.",
    mediaRole: "Pemeriksa Cerita Otomatis & 5 Ceklis Mandiri di Studio Tulis.",
    targetDestination: "studio",
  },
];

// ============================================================================
// MISI 1 (BABAK I): SEGEL KOMPAS WAKTU (ALUR & PESAN CERITA — Hlm. 52–58 & 68)
// ============================================================================

export interface PlotBeatItem {
  readonly id: string;
  readonly stageLabel: string;
  readonly stagePosition:
    | "Orientasi (Awal)"
    | "Pemantik Masalah"
    | "Komplikasi (Tengah)"
    | "Klimaks (Puncak)"
    | "Resolusi (Akhir)";
  readonly correctOrder: number;
  readonly summary: string;
  readonly logicNote: string;
}

export const BOLA_WAKTU_AUDIO_SCRIPT =
  "Kisah Bola-Bola Waktu karya Fauzia A. Setiap pukul empat pagi, Ivan harus membantu ibunya membuat kue basah untuk dititipkan di kantin sekolah. Ivan merasa malu karena Fiam sering mengejeknya sebagai tukang kue. Suatu sore, pria berkerudung hitam memberinya bola-bola waktu bercahaya. Ivan memilih bola merah untuk melompat ke tahun 2022 agar tidak perlu lagi berjualan kue. Di masa depan itu, Ivan memang menjadi bintang basket populer, tetapi ia terkejut mendapati makam ayahnya yang wafat karena kelelahan bekerja seorang diri. Ivan menangis menyesal, lalu terbangun kembali di masa kini. Ia memeluk kedua orang tuanya dan bertekad bangga membantu ibunya sambil tetap giat berlatih basket.";

export const BOLA_WAKTU_PLOT_BEATS: readonly PlotBeatItem[] = [
  {
    id: "beat-orientasi",
    stageLabel: "Tahap 1 · Awal Cerita",
    stagePosition: "Orientasi (Awal)",
    correctOrder: 1,
    summary:
      "Ivan bangun pukul 04.00 pagi membantu ibunya membuat kue basah, tapi ia malu membawanya ke sekolah.",
    logicNote: "Mengenalkan siapa tokohnya (Ivan), di mana kejadiannya, dan apa yang ia rasakan.",
  },
  {
    id: "beat-pemantik",
    stageLabel: "Tahap 2 · Muncul Masalah",
    stagePosition: "Pemantik Masalah",
    correctOrder: 2,
    summary:
      "Fiam mengejek Ivan sebagai 'tukang kue' sehingga Ivan ingin lari dari kehidupannya.",
    logicNote: "Kejadian awal yang membuat tokoh utama ingin mengubah nasibnya.",
  },
  {
    id: "beat-komplikasi",
    stageLabel: "Tahap 3 · Masalah Membesar",
    stagePosition: "Komplikasi (Tengah)",
    correctOrder: 3,
    summary:
      "Ivan bertemu pria misterius berkerudung hitam dan memilih bola waktu merah untuk pindah ke tahun 2022.",
    logicNote: "Keajaiban mulai muncul! Bola waktu membawa Ivan melompat ke masa depan.",
  },
  {
    id: "beat-klimaks",
    stageLabel: "Tahap 4 · Puncak Masalah",
    stagePosition: "Klimaks (Puncak)",
    correctOrder: 4,
    summary:
      "Di tahun 2022 Ivan jadi pemain basket terkenal, tetapi ia menangis sedih saat tahu Ayahnya sudah tiada karena kelelahan bekerja sendirian.",
    logicNote: "Momen paling menegangkan dan mengharukan! Pilihan Ivan ternyata membawa akibat besar.",
  },
  {
    id: "beat-resolusi",
    stageLabel: "Tahap 5 · Akhir & Pesan",
    stagePosition: "Resolusi (Akhir)",
    correctOrder: 5,
    summary:
      "Ivan terbangun kembali di masa kini, memeluk Ayah-Ibunya dengan bersyukur, dan tidak malu lagi membantu berjualan kue.",
    logicNote: "Masalah selesai dan sifat Ivan berubah menjadi lebih baik.",
  },
];

export interface AmanatOption {
  readonly id: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly feedback: string;
}

export const BOLA_WAKTU_AMANAT_OPTIONS: readonly AmanatOption[] = [
  {
    id: "amanat-a",
    text: "Jangan pernah menerima benda bulat dari orang asing di jalan.",
    isCorrect: false,
    feedback:
      "Hampir tepat! Bola waktu itu hanya alat keajaiban di cerita. Coba perhatikan perubahan sikap Ivan kepada orang tuanya.",
  },
  {
    id: "amanat-b",
    text: "Sayangilah orang tua dan jangan malu membantu keluarga hanya karena gengsi pada teman.",
    isCorrect: true,
    feedback:
      "Hebat, jawabanmu tepat! Kejadian di tahun 2022 menyadarkan Ivan bahwa keluarga jauh lebih berharga daripada gengsi.",
  },
  {
    id: "amanat-c",
    text: "Berhentilah bermain basket supaya punya waktu jualan kue setiap hari.",
    isCorrect: false,
    feedback:
      "Kurang tepat. Di akhir cerita, Ivan tetap rajin berlatih basket sambil bangga membantu ibunya.",
  },
];

// ============================================================================
// MISI 2 (BABAK II): SEGEL CERMIN WATAK & PANCA INDERA (Hlm. 59–67)
// ============================================================================

export interface CharacterEvidenceChallenge {
  readonly id: string;
  readonly characterName: string;
  readonly storySource: string;
  readonly roleBadge: "Protagonis" | "Antagonis" | "Sahabat Pendukung";
  readonly traitClaim: string;
  readonly options: readonly {
    readonly id: string;
    readonly quote: string;
    readonly isValidEvidence: boolean;
    readonly explanation: string;
  }[];
}

export const CHARACTER_EVIDENCE_CHALLENGES: readonly CharacterEvidenceChallenge[] = [
  {
    id: "char-mao",
    characterName: "Mao — Kisah \"Sihir Unik Mao\"",
    storySource: "Komik 'Sihir Unik Mao'",
    roleBadge: "Protagonis",
    traitClaim: "Pantang menyerah dan membalas ejekan teman dengan kebaikan",
    options: [
      {
        id: "mao-opt-1",
        quote:
          "Walau sering lupa mantra dan ditertawakan, Mao terus berlatih bersama Piru sampai berhasil menyihir stroberi dan cokelat lezat untuk meredakan marah Yari.",
        isValidEvidence: true,
        explanation:
          "Tepat sekali! Sifat pantang menyerah dan baik hati Mao terlihat nyata dari perbuatannya.",
      },
      {
        id: "mao-opt-2",
        quote: "Mao adalah murid di Sekolah Peri Juara yang memakai jubah peri berwarna cerah.",
        isValidEvidence: false,
        explanation:
          "Kalimat ini baru menjelaskan pakaian Mao, belum menunjukkan perbuatan pantang menyerahnya.",
      },
    ],
  },
  {
    id: "char-yari",
    characterName: "Yari — Kisah \"Sihir Unik Mao\"",
    storySource: "Komik 'Sihir Unik Mao'",
    roleBadge: "Antagonis",
    traitClaim: "Sombong dan suka meremehkan teman",
    options: [
      {
        id: "yari-opt-1",
        quote: "Yari menguasai mantra terbang dan sihir dasar dengan cepat di kelas.",
        isValidEvidence: false,
        explanation:
          "Pintar di kelas bukan berarti sombong. Yuk, pilih kalimat yang menunjukkan ucapan/sikap Yari kepada Mao!",
      },
      {
        id: "yari-opt-2",
        quote:
          "Yari menunjuk Mao sambil mencibir, 'Kau peri paling payah di sekolah ini! Mantra mudah saja selalu gagal!'",
        isValidEvidence: true,
        explanation:
          "Benar! Ucapan dan cibiran Yari ini membuktikan sifatnya yang sombong.",
      },
    ],
  },
];

export interface PouchEscalationStep {
  readonly order: number;
  readonly pouchId: string;
  readonly itemName: string;
  readonly transformation: string;
  readonly tensionLevel: string;
}

export const EMAS_POUCH_STEPS: readonly PouchEscalationStep[] = [
  {
    order: 1,
    pouchId: "biji-timun",
    itemName: "Kantong Biji Timun",
    transformation: "Berubah jadi kebun timun lebat yang menghambat langkah Raksasa.",
    tensionLevel: "Bahaya Awal (35%) — Raksasa melambat karena asyik makan timun.",
  },
  {
    order: 2,
    pouchId: "jarum",
    itemName: "Kantong Jarum",
    transformation: "Tumbuh cepat jadi hutan bambu tajam dan rapat yang melukai kaki Raksasa.",
    tensionLevel: "Bahaya Naik (60%) — Raksasa kesakitan dan makin marah!",
  },
  {
    order: 3,
    pouchId: "garam",
    itemName: "Kantong Garam",
    transformation: "Berubah jadi lautan luas berombak besar yang hampir menenggelamkan Raksasa.",
    tensionLevel: "Hampir Puncak (85%) — Rintangan makin besar, tapi Raksasa masih bisa berenang!",
  },
  {
    order: 4,
    pouchId: "terasi",
    itemName: "Kantong Terasi (Puncak Klimaks)",
    transformation: "Meledak jadi lautan lumpur mendidih yang mengalahkan Raksasa dan menyelamatkan Emas!",
    tensionLevel: "Puncak Klimaks (100%) — Momen penentu kemenangan Emas!",
  },
];

export interface SensoryUpgradeChallenge {
  readonly id: string;
  readonly senseBadge: "Penglihatan & Cahaya" | "Pendengaran & Suara" | "Penciuman & Perabaan";
  readonly flatSentence: string;
  readonly options: readonly {
    readonly id: string;
    readonly text: string;
    readonly isRichSensory: boolean;
    readonly feedback: string;
  }[];
}

export const SENSORY_UPGRADE_CHALLENGES: readonly SensoryUpgradeChallenge[] = [
  {
    id: "sens-1",
    senseBadge: "Penglihatan & Cahaya",
    flatSentence: "Kalimat Biasa: 'Ivan masuk ke tempat yang aneh dan melihat banyak bola waktu.'",
    options: [
      {
        id: "s1-a",
        text: "Lorong itu diselimuti kabut keperakan, sementara puluhan bola kristal berpendar merah delima dan biru safir melayang di udara.",
        isRichSensory: true,
        feedback:
          "Keren! Pembaca jadi ikut membayangkan warna kabut dan cahaya bolanya.",
      },
      {
        id: "s1-b",
        text: "Ivan masuk ke sebuah ruangan yang sangat aneh sekali dan di sana terdapat banyak bola waktu yang bagus.",
        isRichSensory: false,
        feedback:
          "Kata 'aneh sekali' dan 'bagus' masih belum menggambarkan warna atau cahaya yang terlihat mata.",
      },
    ],
  },
  {
    id: "sens-2",
    senseBadge: "Pendengaran & Suara",
    flatSentence: "Kalimat Biasa: 'Raksasa datang mengejar Emas dengan suara yang keras.'",
    options: [
      {
        id: "s2-a",
        text: "Raksasa itu berlari sangat cepat dan mengeluarkan suara yang amat keras sehingga Emas takut.",
        isRichSensory: false,
        feedback: "Coba pilih kalimat yang menyebutkan bunyi langkah dan geramannya dengan lebih jelas!",
      },
      {
        id: "s2-b",
        text: "Dentuman langkah kaki Raksasa menggetarkan tanah hutan, disusul geraman berat yang merontokkan dedaunan kering.",
        isRichSensory: true,
        feedback:
          "Mantap! Kata 'dentuman langkah' dan 'geraman berat' membuat suasananya terdengar nyata.",
      },
    ],
  },
  {
    id: "sens-3",
    senseBadge: "Penciuman & Perabaan",
    flatSentence: "Kalimat Biasa: 'Mao menyihir buah-buahan yang enak di ruang kelas peri.'",
    options: [
      {
        id: "s3-a",
        text: "Harum manis stroberi segar dan lelehan cokelat hangat seketika memenuhi udara kelas yang semula dingin menegangkan.",
        isRichSensory: true,
        feedback:
          "Tepat! Ada wangi stroberi (penciuman) serta rasa hangat dan dingin (perabaan).",
      },
      {
        id: "s3-b",
        text: "Buah-buahan hasil sihir Mao terlihat sangat enak dan membuat semua peri di kelas senang.",
        isRichSensory: false,
        feedback: "Kalimat ini belum menceritakan wangi makanan atau suhu ruangannya.",
      },
    ],
  },
];

// ============================================================================
// MISI 3 (BABAK III): SEGEL ALKIMIA BAHASA (PERUMPAMAAN & DIALOG — Hlm. 63 & 69–70)
// ============================================================================

export interface MajasAsosiasiItem {
  readonly id: string;
  readonly contextSentence: string;
  readonly blankPrompt: string;
  readonly correctConnector: string;
  readonly correctComparison: string;
  readonly connectorChoices: readonly string[];
  readonly comparisonChoices: readonly string[];
  readonly explanation: string;
}

export const MAJAS_ASOSIASI_CHALLENGES: readonly MajasAsosiasiItem[] = [
  {
    id: "majas-1",
    contextSentence: "Sifat Mao yang ramah dan sifat Yari yang angkuh sangat sulit disatukan.",
    blankPrompt: "Kami berdua sulit menyatu [Kata Pembanding] [Perumpamaan].",
    correctConnector: "bagaikan",
    correctComparison: "minyak dan air",
    connectorChoices: ["bagaikan", "daripada", "karena"],
    comparisonChoices: ["minyak dan air", "bintang kejora", "anak panah"],
    explanation:
      "Cocok! Dua sifat yang tidak bisa bersatu diumpamakan 'bagaikan minyak dan air'.",
  },
  {
    id: "majas-2",
    contextSentence: "Pertolongan Piru memberi semangat baru bagi Mao yang sedang sedih.",
    blankPrompt: "Kebaikan sahabatnya terasa menyejukkan hati [Kata Pembanding] [Perumpamaan].",
    correctConnector: "laksana",
    correctComparison: "oase di padang pasir",
    connectorChoices: ["laksana", "sehingga", "meskipun"],
    comparisonChoices: ["oase di padang pasir", "benang kusut", "bara api"],
    explanation:
      "Tepat! 'Laksana oase di padang pasir' artinya memberi kesejukan di saat sulit.",
  },
  {
    id: "majas-3",
    contextSentence: "Saat kantong terakhir dilempar, Emas berlari sangat cepat.",
    blankPrompt: "Tubuh kecil Emas melesat cepat menembus kabut [Kata Pembanding] [Perumpamaan].",
    correctConnector: "seperti",
    correctComparison: "anak panah",
    connectorChoices: ["seperti", "supaya", "tetapi"],
    comparisonChoices: ["anak panah", "oase di padang pasir", "minyak dan air"],
    explanation:
      "Benar! Gerakan lari yang sangat cepat diumpamakan 'seperti anak panah'.",
  },
];

export interface DialogueTransmutationItem {
  readonly id: string;
  readonly speaker: string;
  readonly sourceStory: string;
  readonly directSpeech: string;
  readonly options: readonly {
    readonly id: string;
    readonly text: string;
    readonly isCorrect: boolean;
    readonly ruleExplanation: string;
  }[];
}

export const DIALOGUE_TRANSMUTATION_CHALLENGES: readonly DialogueTransmutationItem[] = [
  {
    id: "dlg-1",
    speaker: "Raksasa kepada Emas",
    sourceStory: "Komik 'Keberanian Emas'",
    directSpeech:
      'Raksasa berseru, "Berani-beraninya kau melukaiku! Akan kutangkap dan kumakan habis kau, Emas!"',
    options: [
      {
        id: "dlg-1-a",
        text: 'Raksasa mengatakan bahwa "Berani-beraninya kau melukaiku dan akan kutangkap kau, Emas!"',
        isCorrect: false,
        ruleExplanation:
          "Masih kurang tepat: kalimat tak langsung tidak boleh memakai tanda petik (\"...\") lagi.",
      },
      {
        id: "dlg-1-b",
        text: "Raksasa tak menyangka Emas berani melukainya dan mengancam akan menangkap serta memakan habis Emas.",
        isCorrect: true,
        ruleExplanation:
          "Tepat sekali! Tanda petik dilepas, kata '-ku' diganti '-nya', dan 'kau' diganti 'Emas'.",
      },
      {
        id: "dlg-1-c",
        text: "Emas berseru bahwa ia akan menangkap dan memakan habis Raksasa yang telah melukainya.",
        isCorrect: false,
        ruleExplanation:
          "Tokohnya terbalik! Yang mengancam di kalimat itu adalah Raksasa kepada Emas.",
      },
    ],
  },
  {
    id: "dlg-2",
    speaker: "Piru kepada Mao",
    sourceStory: "Komik 'Sihir Unik Mao'",
    directSpeech: 'Piru berkata dengan lembut, "Jangan menyerah, Mao! Aku yakin sihir makananmu sangat berguna."',
    options: [
      {
        id: "dlg-2-a",
        text: "Piru menyemangati Mao agar tidak menyerah dan meyakinkan bahwa sihir makanan sahabatnya itu sangat berguna.",
        isCorrect: true,
        ruleExplanation:
          "Hebat! Tanda petik dihapus dan kata 'Aku' serta 'makananmu' sudah berubah dengan rapi.",
      },
      {
        id: "dlg-2-b",
        text: "Piru berkata jangan menyerah Mao, aku yakin sihir makananmu sangat berguna.",
        isCorrect: false,
        ruleExplanation:
          "Kata ganti 'aku' dan '-mu' belum diubah. Yuk, pilih kalimat yang menceritakan ulang ucapan Piru!",
      },
    ],
  },
];

// ============================================================================
// KAMUS KATA FANTASI & PANCA INDERA
// ============================================================================

export interface FantasyLexiconCategory {
  readonly id: string;
  readonly category: string;
  readonly subtitle: string;
  readonly entries: readonly {
    readonly word: string;
    readonly type: "Denotatif" | "Konotatif" | "Kiasan / Majas";
    readonly meaning: string;
    readonly example: string;
  }[];
}

export const FANTASY_LEXICON_BANK: readonly FantasyLexiconCategory[] = [
  {
    id: "lex-cahaya",
    category: "Cahaya & Suasana Ajaib",
    subtitle: "Kata-kata seru untuk menggambarkan tempat ceritamu",
    entries: [
      {
        word: "Berpendar",
        type: "Denotatif",
        meaning: "Memancarkan cahaya lembut yang berkilau di tempat gelap.",
        example: "Huruf emas di sampul pustaka itu berpendar saat disentuh.",
      },
      {
        word: "Temaram",
        type: "Denotatif",
        meaning: "Remang-remang atau agak gelap.",
        example: "Di bawah cahaya lentera yang temaram, bayangan jubahnya memanjang.",
      },
      {
        word: "Bak bintang kejora",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk benda yang bersinar sangat terang dan indah.",
        example: "Permata kompas itu berkilau indah bak bintang kejora.",
      },
    ],
  },
  {
    id: "lex-gerak",
    category: "Gerakan & Aksi Menegangkan",
    subtitle: "Kata-kata untuk membuat adegan masalah makin seru",
    entries: [
      {
        word: "Melesat",
        type: "Denotatif",
        meaning: "Meluncur atau berlari dengan sangat cepat.",
        example: "Panah cahaya itu melesat menembus kabut hitam.",
      },
      {
        word: "Membeku",
        type: "Konotatif",
        meaning: "Terpaku diam tak bergerak karena kaget atau takut.",
        example: "Langkah Ivan membeku ketika membaca nama di batu nisan itu.",
      },
      {
        word: "Bagaikan bara api",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk semangat atau keberanian yang menyala-nyala.",
        example: "Semangat Emas untuk selamat menyala bagaikan bara api.",
      },
    ],
  },
];

// ============================================================================
// 3 KUIS BONUS DI PETA PETUALANGAN
// ============================================================================

export interface SideQuestItem {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly targetCompetency: string;
  readonly scenario: string;
  readonly question: string;
  readonly options: readonly {
    readonly id: string;
    readonly text: string;
    readonly isCorrect: boolean;
    readonly feedback: string;
  }[];
}

export const ASTROLABE_SIDE_QUESTS: readonly SideQuestItem[] = [
  {
    id: "quest-ide",
    code: "KUIS BONUS 1 · CARI IDE SERU",
    title: "Bikin Ide Cerita yang Tidak Membosankan!",
    targetCompetency: "Mencari ide cerita yang segar & punya aturan keajaiban",
    scenario:
      "Raka ingin mengarang cerita fantasi, tapi idenya cuma: 'Seorang anak menemukan pedang sakti lalu langsung mengalahkan raja monster.' Cerita seperti ini terlalu biasa dan cepat selesai.",
    question: "Ide mana di bawah ini yang lebih seru dan bikin pembaca penasaran?",
    options: [
      {
        id: "q1-a",
        text: "Seorang siswa yang sering terlambat sekolah menemukan jam saku tua milik kakeknya yang bisa memutar waktu 10 menit, tapi setiap dipakai satu benda kesayangannya berubah jadi batu.",
        isCorrect: true,
        feedback:
          "Keren banget! Ceritanya dekat dengan kehidupan kita di sekolah, dan jam ajaibnya punya aturan/risiko yang bikin tegang!",
      },
      {
        id: "q1-b",
        text: "Seorang pangeran dari negeri awan punya kekuatan paling hebat di dunia dan mengalahkan semua musuhnya dengan sekali pukul tanpa kesulitan.",
        isCorrect: false,
        feedback:
          "Kalau jagoannya terlalu sempurna dan menang gampang, pembaca jadi tidak ikut deg-degan. Yuk pilih ide yang punya tantangan!",
      },
    ],
  },
  {
    id: "quest-logika",
    code: "KUIS BONUS 2 · LOGIKA CERITA",
    title: "Jangan Sampai Jalan Ceritamu Bolong!",
    targetCompetency: "Menjaga kejadian cerita tetap masuk akal sesuai aturan keajaibannya",
    scenario:
      "Di paragraf awal cerita Dinda tertulis: 'Kantong ajaib Aruna HANYA BISA menyala kalau terkena sinar matahari.' Tapi saat di dalam gua bawah tanah yang gelap gulita, tiba-tiba kantong Aruna langsung menyala terang tanpa alasan.",
    question: "Kenapa cerita Dinda terasa janggal, dan bagaimana cara memperbaikinya?",
    options: [
      {
        id: "q2-a",
        text: "Karena melanggar aturan yang dibuat sendiri di awal! Solusinya: Aruna harus memecahkan celah atap gua dulu supaya sinar matahari masuk menyentuh kantongnya.",
        isCorrect: true,
        feedback:
          "Tepat sekali! Walaupun cerita khayalan, cara tokoh menyelesaikan masalah harus tetap sesuai dengan aturan keajaiban yang kamu buat.",
      },
      {
        id: "q2-b",
        text: "Tidak apa-apa, karena di cerita fantasi semua hal boleh terjadi begitu saja tanpa alasan.",
        isCorrect: false,
        feedback:
          "Kurang tepat. Kalau aturan keajaiban dilanggar begitu saja, pembaca akan merasa ceritanya curang.",
      },
    ],
  },
  {
    id: "quest-eyd",
    code: "KUIS BONUS 3 · CEK EJAAN & DIALOG",
    title: "Merapikan Kata Depan 'di' & Tanda Petik Dialog",
    targetCompetency: "Menulis ejaan dan dialog tokoh yang rapi",
    scenario:
      "Perhatikan kalimat ini: Diperpustakaan tua itu, Aruna berbisik \"jangan sentuh segel emas yang ada diatas meja!\"",
    question: "Penulisan manakah yang paling rapi dan benar?",
    options: [
      {
        id: "q3-a",
        text: 'Di perpustakaan tua itu, Aruna berbisik, "Jangan sentuh segel emas yang ada di atas meja!"',
        isCorrect: true,
        feedback:
          "Sempurna! Kata tempat ('di perpustakaan', 'di atas') ditulis dipisah, setelah kata 'berbisik' diberi koma, dan awal kalimat di dalam tanda petik memakai huruf besar.",
      },
      {
        id: "q3-b",
        text: 'Diperpustakaan tua itu, Aruna berbisik "Jangan sentuh segel emas yang ada di atas meja".',
        isCorrect: false,
        feedback:
          "Hampir benar! Tapi ingat: kata tempat 'Di perpustakaan' harus dipisah, dan tanda titik/seru diletakkan DI DALAM sebelum tanda petik penutup.",
      },
    ],
  },
];
