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
    title: "Menghidupkan Tokoh & Suasana Pancaindra",
    description:
      "Mengembangkan cerita dengan sifat tokoh yang terlihat dari aksinya dan gambaran tempat yang melibatkan pancaindra.",
    targetIssue: "Tokoh terasa datar dan gambaran tempat masih terlalu singkat.",
    mediaRole: "Tebak Bukti Sifat Mao & Emas serta latihan kalimat pancaindra.",
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

export const PEMBUKA_PUSTAKA_AUDIO_SCRIPT =
  "Selamat datang di Pustaka Aksaraloka! Sebelum mengarang ceritamu sendiri di Studio Tulis, yuk kumpulkan tiga Segel Rahasia lewat tiga kisah seru: Bola-Bola Waktu, Sihir Unik Mao, dan Keberanian Emas. Cerita fantasi adalah cerita yang berisi khayalan dan hal-hal ajaib, seperti benda yang memiliki kekuatan, makhluk ajaib, atau perjalanan waktu. Meskipun tidak terjadi di dunia nyata, cerita fantasi memiliki jalan cerita yang jelas dan dapat mengandung pesan yang ingin disampaikan penulis. Ingat tiga kuncinya ya: pertama, keajaiban memiliki aturan. Kedua, sifat tokoh terlihat dari aksinya. Dan ketiga, hidupkan ceritamu dengan pancaindra serta perumpamaan.";

export const BOLA_WAKTU_AUDIO_SCRIPT =
  "Kisah Bola-Bola Waktu karya Fauzia A. Setiap pukul empat pagi, Ivan harus membantu ibunya membuat kue basah untuk dititipkan di kantin sekolah. Ivan merasa malu karena Fiam sering mengejeknya sebagai tukang kue. Suatu sore, pria berkerudung hitam memberinya bola-bola waktu bercahaya. Ivan memilih bola merah untuk melompat ke tahun 2022 agar tidak perlu lagi berjualan kue. Di masa depan itu, Ivan memang menjadi bintang basket populer, tetapi ia terkejut mendapati makam ayahnya yang wafat karena kelelahan bekerja seorang diri. Ivan menangis menyesal, lalu terbangun kembali di masa kini. Ia memeluk kedua orang tuanya dan bertekad bangga membantu ibunya sambil tetap giat berlatih basket.";

export const MAO_EMAS_AUDIO_SCRIPT =
  "Dua kisah inspirasi Misi Kedua: Sihir Unik Mao dan Keberanian Emas. Di Sekolah Peri Juara, Mao sering lupa dan gagal merapal mantra sihir sehingga diejek oleh Yari yang sombong. Namun Mao pantang menyerah berlatih bersama sahabatnya Piru, hingga berhasil menyihir makanan manis yang meredakan marah Yari. Sementara pada kisah Keberanian Emas, Emas melarikan diri dari kejaran Raksasa dengan melemparkan empat kantong ajaib secara berurutan dari bahaya awal sampai puncak klimaks: pertama biji timun menjadi kebun lebat, kedua jarum menjadi hutan bambu tajam, ketiga garam menjadi lautan luas, dan keempat terasi menjadi lautan lumpur mendidih yang mengalahkan Raksasa.";

export const MISI_BAHASA_AUDIO_SCRIPT =
  "Selamat datang di Misi Ketiga: Gaya Bahasa Cerita Fantasi. Agar ceritamu terasa indah dan nyata, gunakan kata-kata khas dunia fantasi yang menggambarkan cahaya, suara, aroma, dan gerak tokoh. Untuk membandingkan dua hal yang berbeda, kamu bisa memakai majas asosiasi atau perumpamaan dengan kata penghubung seperti, bagaikan, atau laksana. Jangan lupa pula membedakan kalimat langsung yang memakai tanda petik untuk ucapan tokoh, dengan kalimat tak langsung yang menceritakan kembali ucapan tersebut tanpa tanda petik.";

export const BOLA_WAKTU_PLOT_BEATS: readonly PlotBeatItem[] = [
  {
    id: "beat-orientasi",
    stageLabel: "Tahap 1 · Awal Cerita",
    stagePosition: "Orientasi (Awal)",
    correctOrder: 1,
    summary:
      "Ivan bangun pukul 04.00 pagi membantu ibunya membuat kue basah, tetapi ia malu membawanya ke sekolah.",
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
      "Ivan bertemu pria misterius berkerudung hitam dan memilih bola waktu merah untuk melompat ke tahun 2022.",
    logicNote: "Keajaiban mulai muncul! Bola waktu membawa Ivan melompat ke masa depan.",
  },
  {
    id: "beat-klimaks",
    stageLabel: "Tahap 4 · Puncak Masalah",
    stagePosition: "Klimaks (Puncak)",
    correctOrder: 4,
    summary:
      "Pada tahun 2022, Ivan menjadi pemain basket terkenal, tetapi ia menangis sedih saat tahu ayahnya sudah tiada karena kelelahan bekerja sendirian.",
    logicNote: "Momen paling menegangkan dan mengharukan! Pilihan Ivan ternyata membawa akibat besar.",
  },
  {
    id: "beat-resolusi",
    stageLabel: "Tahap 5 · Akhir & Pesan",
    stagePosition: "Resolusi (Akhir)",
    correctOrder: 5,
    summary:
      "Ivan terbangun kembali di masa kini, memeluk ayah dan ibunya dengan bersyukur, dan tidak malu lagi membantu berjualan kue.",
    logicNote: "Masalah selesai dan sifat Ivan berubah menjadi lebih baik.",
  },
];

/** Urutan acak deterministik untuk tampilan tantangan Gunung Alur agar siswa benar-benar bernalar sebab-akibat. */
export const BOLA_WAKTU_DISPLAY_ORDER_IDS: readonly string[] = [
  "beat-komplikasi",
  "beat-orientasi",
  "beat-resolusi",
  "beat-pemantik",
  "beat-klimaks",
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
// MISI 2 (BABAK II): SEGEL CERMIN WATAK & PANCAINDRA (Hlm. 59–67)
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
    transformation: "Berubah menjadi kebun timun lebat yang menghambat langkah Raksasa.",
    tensionLevel: "Bahaya Awal (35%) — Raksasa melambat karena asyik makan timun.",
  },
  {
    order: 2,
    pouchId: "jarum",
    itemName: "Kantong Jarum",
    transformation: "Tumbuh cepat menjadi hutan bambu tajam dan rapat yang melukai kaki Raksasa.",
    tensionLevel: "Bahaya Naik (60%) — Raksasa kesakitan dan makin marah!",
  },
  {
    order: 3,
    pouchId: "garam",
    itemName: "Kantong Garam",
    transformation: "Berubah menjadi lautan luas berombak besar yang hampir menenggelamkan Raksasa.",
    tensionLevel: "Hampir Puncak (85%) — Rintangan makin besar, tetapi Raksasa masih bisa berenang.",
  },
  {
    order: 4,
    pouchId: "terasi",
    itemName: "Kantong Terasi",
    transformation: "Meledak menjadi lautan lumpur mendidih yang mengalahkan Raksasa dan menyelamatkan Emas.",
    tensionLevel: "Puncak Klimaks (100%) — Momen penentu kemenangan Emas!",
  },
];

/** Urutan acak deterministik untuk tantangan 4 Kantong Emas agar tidak membocorkan urutan eskalasi konflik. */
export const EMAS_POUCH_DISPLAY_ORDER_IDS: readonly string[] = [
  "garam",
  "biji-timun",
  "terasi",
  "jarum",
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
    connectorChoices: ["daripada", "bagaikan", "karena"],
    comparisonChoices: ["anak panah", "bintang kejora", "minyak dan air"],
    explanation:
      "Cocok! Dua sifat yang tidak bisa bersatu diumpamakan 'bagaikan minyak dan air'.",
  },
  {
    id: "majas-2",
    contextSentence: "Pertolongan Piru memberi semangat baru bagi Mao yang sedang sedih.",
    blankPrompt: "Kebaikan sahabatnya terasa menyejukkan hati [Kata Pembanding] [Perumpamaan].",
    correctConnector: "laksana",
    correctComparison: "oase di padang pasir",
    connectorChoices: ["sehingga", "meskipun", "laksana"],
    comparisonChoices: ["benang kusut", "oase di padang pasir", "bara api"],
    explanation:
      "Tepat! 'Laksana oase di padang pasir' artinya memberi kesejukan di saat sulit.",
  },
  {
    id: "majas-3",
    contextSentence: "Saat kantong terakhir dilempar, Emas berlari sangat cepat.",
    blankPrompt: "Tubuh kecil Emas melesat cepat menembus kabut [Kata Pembanding] [Perumpamaan].",
    correctConnector: "seperti",
    correctComparison: "anak panah",
    connectorChoices: ["supaya", "seperti", "tetapi"],
    comparisonChoices: ["oase di padang pasir", "minyak dan air", "anak panah"],
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
// KAMUS KATA FANTASI & PANCAINDRA
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
    category: "Penglihatan & Cahaya",
    subtitle: "Menghidupkan warna, bayangan, dan kilau dunia fantasi",
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
        meaning: "Remang-remang atau agak gelap karena cahaya redup.",
        example: "Di bawah cahaya lentera yang temaram, bayangan jubahnya memanjang.",
      },
      {
        word: "Gemerlap",
        type: "Denotatif",
        meaning: "Berkilauan cemerlang memantulkan banyak titik cahaya.",
        example: "Langit-langit gua kristal tampak gemerlap diterpa sinar pagi.",
      },
      {
        word: "Menyilaukan",
        type: "Denotatif",
        meaning: "Terlalu terang hingga membuat mata harus menyipit.",
        example: "Portal waktu terbuka dengan kilatan putih yang menyilaukan.",
      },
      {
        word: "Pekat",
        type: "Denotatif",
        meaning: "Sangat gelap atau tebal sehingga pandangan tertutup rapat.",
        example: "Kabut hitam pekat menelan ujung jembatan kayu di depan mereka.",
      },
      {
        word: "Keperakan",
        type: "Denotatif",
        meaning: "Berwarna kilau putih cerah menyerupai logam perak.",
        example: "Awan keperakan melayang rendah menyelimuti menara jam tua.",
      },
      {
        word: "Bak bintang kejora",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk benda yang bersinar sangat terang dan indah.",
        example: "Permata kompas itu berkilau indah bak bintang kejora.",
      },
      {
        word: "Laksana pelita di lorong gelap",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan bagi harapan atau penunjuk jalan di situasi sulit.",
        example: "Nasihat kakek hadir laksana pelita di lorong gelap.",
      },
    ],
  },
  {
    id: "lex-suara",
    category: "Pendengaran & Suara",
    subtitle: "Membangun ketegangan dan suasana lewat bunyi nyata",
    entries: [
      {
        word: "Menggema",
        type: "Denotatif",
        meaning: "Memantulkan suara berulang-ulang di ruang luas atau lorong.",
        example: "Detak jam perunggu menggema di seluruh aula kosong itu.",
      },
      {
        word: "Dentuman",
        type: "Denotatif",
        meaning: "Bunyi berat dan kuat seperti langkah raksasa atau ledakan jauh.",
        example: "Dentuman langkah kaki di balik pintu membuat meja ikut bergetar.",
      },
      {
        word: "Berdesir",
        type: "Denotatif",
        meaning: "Berbunyi lembut seperti angin melewati dedaunan atau pasir.",
        example: "Angin senja berdesir lirih membawa bisikan dari arah hutan.",
      },
      {
        word: "Gemerisik",
        type: "Denotatif",
        meaning: "Bunyi halus gesekan kertas tua, kain, atau daun kering.",
        example: "Terdengar gemerisik halaman buku yang membalik sendiri.",
      },
      {
        word: "Derit",
        type: "Denotatif",
        meaning: "Bunyi nyaring pelan dari engsel pintu atau papan kayu tua.",
        example: "Derit gerbang besi memecah keheningan malam di menara.",
      },
      {
        word: "Senyap",
        type: "Konotatif",
        meaning: "Sunyi sekali tanpa suara sedikit pun sehingga terasa menegangkan.",
        example: "Seketika ruang kelas berubah senyap saat cahaya biru padam.",
      },
      {
        word: "Melengking",
        type: "Denotatif",
        meaning: "Berbunyi sangat nyaring dan tinggi hingga menusuk telinga.",
        example: "Peluit perak penjaga gerbang melengking memanggil burung cahaya.",
      },
      {
        word: "Bagaikan guntur di langit senja",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk suara atau teriakan yang sangat menggelegar.",
        example: "Seruan sang penjaga terdengar bagaikan guntur di langit senja.",
      },
    ],
  },
  {
    id: "lex-Indera",
    category: "Aroma, Suhu & Sentuhan",
    subtitle: "Membuat pembaca ikut mencium bau dan merasakan suhu latar",
    entries: [
      {
        word: "Semerbak",
        type: "Denotatif",
        meaning: "Harum merata memenuhi seluruh ruangan atau udara sekitar.",
        example: "Aroma rempah hangat semerbak begitu tutup peti pusaka dibuka.",
      },
      {
        word: "Pengap",
        type: "Denotatif",
        meaning: "Udara terasa sesak, tidak segar, dan minim angin.",
        example: "Lorong bawah tanah itu terasa pengap dan berdebu tebal.",
      },
      {
        word: "Lembap",
        type: "Denotatif",
        meaning: "Agak basah dan dingin karena uap air (bentuk baku KBBI VI).",
        example: "Kertas peta kuno itu terasa lembap saat digenggam erat.",
      },
      {
        word: "Menusuk",
        type: "Konotatif",
        meaning: "Terasa sangat tajam mengenai kulit, seperti hawa dingin ekstrem.",
        example: "Hawa dingin dari balik cermin menusuk telapak tangannya.",
      },
      {
        word: "Hangat",
        type: "Konotatif",
        meaning: "Suhu nyaman atau suasana hati yang menenangkan.",
        example: "Pendar lentera memberi rasa hangat yang mengusir ketakutannya.",
      },
      {
        word: "Membeku",
        type: "Konotatif",
        meaning: "Terpaku diam tak bergerak karena sangat kaget atau takut.",
        example: "Langkah Ivan membeku ketika membaca nama di batu nisan itu.",
      },
      {
        word: "Menggigil",
        type: "Denotatif",
        meaning: "Bergetar tubuhnya karena kedinginan atau rasa cemas.",
        example: "Jarinya sedikit menggigil saat memutar kunci kuningan itu.",
      },
      {
        word: "Sedingin embun puncak gunung",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk benda atau udara yang amat dingin dan segar.",
        example: "Permukaan batu pusaka terasa sedingin embun puncak gunung.",
      },
    ],
  },
  {
    id: "lex-watak",
    category: "Watak & Emosi Tokoh",
    subtitle: "Menggambarkan karakter tokoh lewat sikap dan perasaan",
    entries: [
      {
        word: "Gigih",
        type: "Denotatif",
        meaning: "Tetap teguh berusaha dan pantang menyerah meski berkali-kali gagal.",
        example: "Mao tetap gigih berlatih mantra meski teman-temannya menertawakan.",
      },
      {
        word: "Angkuh",
        type: "Denotatif",
        meaning: "Sombong dan suka memandang rendah kemampuan orang lain.",
        example: "Dengan tatapan angkuh, Yari menolak bantuan sahabatnya.",
      },
      {
        word: "Tulus",
        type: "Denotatif",
        meaning: "Sungguh-sungguh dan bersih niatnya tanpa pamrih.",
        example: "Tinta cahaya hanya menyala jika digoreskan dengan hati tulus.",
      },
      {
        word: "Cerdik",
        type: "Denotatif",
        meaning: "Cepat mengerti keadaan dan pandai mencari akal keluar dari bahaya.",
        example: "Emas bersikap cerdik dengan memanfaatkan empat kantong secara berurutan.",
      },
      {
        word: "Gentar",
        type: "Denotatif",
        meaning: "Merasa takut atau ragu menghadapi tantangan besar.",
        example: "Meski raksasa mendekat, sorot matanya sama sekali tidak gentar.",
      },
      {
        word: "Besar kepala",
        type: "Konotatif",
        meaning: "Ungkapan untuk sikap sombong karena merasa paling hebat.",
        example: "Kemenangan kecil tidak boleh membuat penjaga aksara besar kepala.",
      },
      {
        word: "Lapang dada",
        type: "Konotatif",
        meaning: "Sabar dan ikhlas menerima kenyataan atau memaafkan kesalahan.",
        example: "Dengan lapang dada, ia memaafkan temannya yang pernah mengejek.",
      },
      {
        word: "Bagaikan minyak dan air",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk dua sifat bertolak belakang yang sulit menyatu.",
        example: "Awalnya sifat mereka bertolak belakang bagaikan minyak dan air.",
      },
    ],
  },
  {
    id: "lex-aksi",
    category: "Gerak & Aksi Menegangkan",
    subtitle: "Membuat adegan komplikasi dan klimaks terasa hidup",
    entries: [
      {
        word: "Melesat",
        type: "Denotatif",
        meaning: "Meluncur atau berlari dengan kecepatan luar biasa.",
        example: "Panah cahaya itu melesat menembus kabut hitam.",
      },
      {
        word: "Menghadang",
        type: "Denotatif",
        meaning: "Menahan atau menghalangi jalan seseorang secara tiba-tiba.",
        example: "Bayang Waktu muncul menghadang tepat di depan tangga loteng.",
      },
      {
        word: "Menyelinap",
        type: "Denotatif",
        meaning: "Masuk atau bergerak diam-diam agar tidak ketahuan.",
        example: "Ia menyelinap di balik rak buku tinggi sebelum pintu terkunci.",
      },
      {
        word: "Terpaku",
        type: "Konotatif",
        meaning: "Berhenti mendadak dan menatap sesuatu tanpa berkedip.",
        example: "Semua murid terpaku menyaksikan lukisan tinta itu hidup di udara.",
      },
      {
        word: "Bergegas",
        type: "Denotatif",
        meaning: "Segera bergerak cepat karena waktu amat mendesak.",
        example: "Sebelum fajar menyingsing, mereka bergegas menutup gerbang portal.",
      },
      {
        word: "Menerjang",
        type: "Denotatif",
        meaning: "Menyerang atau menembus rintangan dengan penuh tenaga.",
        example: "Angin pusaran menerjang dedaunan hingga membentuk dinding kabut.",
      },
      {
        word: "Seperti anak panah",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk gerakan lari atau luncuran yang sangat cepat lurus.",
        example: "Tubuhnya melesat cepat seperti anak panah lepas dari busurnya.",
      },
      {
        word: "Bagaikan bara api",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk semangat atau keberanian yang menyala-nyala.",
        example: "Semangat Emas untuk selamat menyala bagaikan bara api.",
      },
    ],
  },
  {
    id: "lex-alur",
    category: "Penghubung Alur & Kiasan",
    subtitle: "Menyambung urutan kejadian dan memperindah penutup cerita",
    entries: [
      {
        word: "Seketika",
        type: "Denotatif",
        meaning: "Langsung terjadi pada saat itu juga tanpa jeda.",
        example: "Seketika roda gigi jam berhenti berputar saat penutupnya dirapatkan.",
      },
      {
        word: "Tiba-tiba",
        type: "Denotatif",
        meaning: "Terjadi mendadak di luar dugaan tokoh.",
        example: "Tiba-tiba lantai batu bergeser membuka tangga rahasia ke bawah tanah.",
      },
      {
        word: "Tak lama kemudian",
        type: "Denotatif",
        meaning: "Penanda jeda waktu singkat sebelum peristiwa berikutnya.",
        example: "Tak lama kemudian, kabut pekat mulai terbelah oleh sinar mentari.",
      },
      {
        word: "Keesokan paginya",
        type: "Denotatif",
        meaning: "Penanda pergantian hari yang rapi menuju resolusi cerita.",
        example: "Keesokan paginya, ia berani mengakui kesalahannya dengan jujur.",
      },
      {
        word: "Sejak saat itu",
        type: "Denotatif",
        meaning: "Penanda perubahan sikap tokoh yang bertahan hingga akhir.",
        example: "Sejak saat itu, tak seorang pun lagi meremehkan bakat uniknya.",
      },
      {
        word: "Laksana oase di padang pasir",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk pertolongan yang sangat melegakan di saat genting.",
        example: "Uluran tangan sahabatnya terasa laksana oase di padang pasir.",
      },
      {
        word: "Bagaikan benang kusut",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk masalah rumit yang membingungkan.",
        example: "Pikirannya sempat kacau bagaikan benang kusut sebelum ia tenang.",
      },
      {
        word: "Seperti embun pagi",
        type: "Kiasan / Majas",
        meaning: "Perumpamaan untuk kedamaian atau kesejukan hati di akhir cerita.",
        example: "Rasa lega menyapu hatinya dengan lembut seperti embun pagi.",
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
    title: "Membuat Ide Cerita yang Tidak Membosankan!",
    targetCompetency: "Mencari ide cerita yang segar & punya aturan keajaiban",
    scenario:
      "Raka ingin mengarang cerita fantasi, tetapi idenya hanya: 'Seorang anak menemukan pedang sakti lalu langsung mengalahkan raja monster.' Cerita seperti ini terlalu biasa dan cepat selesai.",
    question: "Ide mana di bawah ini yang lebih seru dan membuat pembaca penasaran?",
    options: [
      {
        id: "q1-b",
        text: "Seorang pangeran dari negeri awan punya kekuatan paling hebat di dunia dan mengalahkan semua musuhnya dengan sekali pukul tanpa kesulitan.",
        isCorrect: false,
        feedback:
          "Kalau jagoannya terlalu sempurna dan menang mudah, pembaca menjadi tidak ikut deg-degan. Yuk, pilih ide yang punya tantangan!",
      },
      {
        id: "q1-a",
        text: "Seorang siswa yang sering terlambat sekolah menemukan jam saku tua milik kakeknya yang bisa memutar waktu 10 menit, tetapi setiap dipakai satu benda kesayangannya berubah menjadi batu.",
        isCorrect: true,
        feedback:
          "Keren sekali! Ceritanya dekat dengan kehidupan kita di sekolah, dan jam ajaibnya punya aturan/risiko yang membuat tegang!",
      },
    ],
  },
  {
    id: "quest-logika",
    code: "KUIS BONUS 2 · LOGIKA CERITA",
    title: "Jangan Sampai Jalan Ceritamu Bolong!",
    targetCompetency: "Menjaga kejadian cerita tetap masuk akal sesuai aturan keajaibannya",
    scenario:
      "Di paragraf awal cerita Dinda tertulis: 'Kantong ajaib Aruna HANYA BISA menyala kalau terkena sinar matahari.' Tetapi saat di dalam gua bawah tanah yang gelap gulita, tiba-tiba kantong Aruna langsung menyala terang tanpa alasan.",
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
        id: "q3-b",
        text: 'Diperpustakaan tua itu, Aruna berbisik "Jangan sentuh segel emas yang ada di atas meja".',
        isCorrect: false,
        feedback:
          "Hampir benar! Tetapi ingat: kata tempat 'Di perpustakaan' harus dipisah, dan tanda titik/seru diletakkan DI DALAM sebelum tanda petik penutup.",
      },
      {
        id: "q3-a",
        text: 'Di perpustakaan tua itu, Aruna berbisik, "Jangan sentuh segel emas yang ada di atas meja!"',
        isCorrect: true,
        feedback:
          "Sempurna! Kata tempat ('di perpustakaan', 'di atas') ditulis dipisah, setelah kata 'berbisik' diberi koma, dan awal kalimat di dalam tanda petik memakai huruf besar.",
      },
    ],
  },
];
