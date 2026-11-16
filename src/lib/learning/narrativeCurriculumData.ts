/**
 * Kurikulum Bahasa Indonesia Kelas VII SMP (Fase D) — Bab II: Berkelana di Dunia Imajinasi
 * Bagian B & C: Elemen dan Keterampilan Menulis Teks Naratif / Cerita Fantasi (Halaman 52–70)
 *
 * Selaras dengan:
 * 1. Buku Siswa Bahasa Indonesia Kelas VII Revisi (hlm. 52–70)
 * 2. Lembar Analisis Project Media Pembelajaran Kelompok 6 (5 TP, 5 Masalah Siswa, 5 Peluang Peran Media)
 * 3. Pedoman PjBL Media Pembelajaran Inovatif & Audit Sumber Otoritatif (EYD V / KBBI VI)
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
    title: "Identifikasi Unsur & Struktur Cerita Fantasi",
    description:
      "Mengidentifikasi unsur intrinsik (tokoh, latar, watak, amanat) dan struktur alur (orientasi, komplikasi, klimaks, resolusi) berdasarkan teks model.",
    targetIssue: "Struktur cerita belum lengkap & belum mampu menyampaikan amanat.",
    mediaRole: "Teks model multi-modal (teks, ilustrasi SVG, audio narasi) & rekonstruksi Peta Gunung Alur.",
    targetDestination: "alur",
  },
  {
    id: "tp-2",
    code: "TP 2",
    title: "Menentukan Ide & Menyusun Kerangka Runtut",
    description:
      "Menemukan ide cerita fantasi yang orisinal dan menyusun kerangka cerita secara logis tanpa alur melompat-lompat.",
    targetIssue: "Ide sulit muncul (mirip cerita lama) & alur melompat-lompat/berlubang.",
    mediaRole: "Bank Ide Fantasi, Pengingat Aturan Dunia Fantasi, dan Template Kerangka Bertahap.",
    targetDestination: "studio",
  },
  {
    id: "tp-3",
    code: "TP 3",
    title: "Mengembangkan Kerangka & Detail Sensori",
    description:
      "Mengembangkan kerangka menjadi teks cerita fantasi yang utuh dengan pengenalan tokoh mendalam, latar berdetail lima indera, dan eskalasi konflik.",
    targetIssue: "Pengenalan tokoh dangkal, latar terlalu umum, dan deskripsi minim detail sensori.",
    mediaRole: "Peta Lima Indera, Bedah Bukti Watak Mao & Emas, serta Latihan Kalimat Deskriptif.",
    targetDestination: "watak",
  },
  {
    id: "tp-4",
    code: "TP 4",
    title: "Kosakata Kiasan, Majas Asosiasi, & Dialog",
    description:
      "Menggunakan kosakata denotatif, konotatif, majas asosiasi, serta variasi kalimat langsung dan tak langsung secara tepat.",
    targetIssue: "Kosakata deskriptif terbatas, kalimat belum efektif, dan penggunaan majas belum tepat.",
    mediaRole: "Bank Kata Fantasi, Kawah Peracik Majas Asosiasi, dan Mesin Transmutasi Dialog EYD V.",
    targetDestination: "bahasa",
  },
  {
    id: "tp-5",
    code: "TP 5",
    title: "Meninjau & Memperbaiki Tulisan (Revisi)",
    description:
      "Meninjau kembali dan menyunting draf cerita fantasi berdasarkan kelengkapan isi, keruntutan logika alur, dan kaidah bahasa EYD V.",
    targetIssue: "Siswa cenderung terburu-buru menulis tanpa proses telaah dan revisi.",
    mediaRole: "Daftar Periksa Revisi Mandiri & Pemindai Sastra Real-Time di Meja Studio Tulis.",
    targetDestination: "studio",
  },
];

// ============================================================================
// BABAK I: SEGEL KOMPAS WAKTU (ALUR & STRUKTUR TEKS NARATIF — Hlm. 52–58 & 68)
// ============================================================================

export interface PlotBeatItem {
  readonly id: string;
  readonly stageLabel: string;
  readonly stagePosition: "Orientasi (Awal)" | "Pemantik Masalah" | "Komplikasi (Tengah)" | "Klimaks (Puncak)" | "Resolusi (Akhir)";
  readonly correctOrder: number;
  readonly summary: string;
  readonly logicNote: string;
}

export const BOLA_WAKTU_AUDIO_SCRIPT =
  "Kisah Bola-Bola Waktu karya Fauzia A. Setiap pukul empat pagi, Ivan harus membantu ibunya membuat kue basah untuk dititipkan di kantin sekolah. Ivan merasa malu karena Fiam sering mengejeknya sebagai tukang kue. Suatu sore, pria berkerudung hitam memberinya bola-bola waktu bercahaya. Ivan memilih bola merah untuk melompat ke tahun 2022 agar tidak perlu lagi berjualan kue. Di masa depan itu, Ivan memang menjadi bintang basket populer, tetapi ia terkejut mendapati makam ayahnya yang wafat karena kelelahan bekerja seorang diri. Ivan menangis menyesal, lalu terbangun kembali di masa kini. Ia memeluk kedua orang tuanya dan bertekad bangga membantu ibunya sambil tetap giat berlatih basket.";

export const BOLA_WAKTU_PLOT_BEATS: readonly PlotBeatItem[] = [
  {
    id: "beat-orientasi",
    stageLabel: "Titik 1 · Awal (Orientasi)",
    stagePosition: "Orientasi (Awal)",
    correctOrder: 1,
    summary:
      "Ivan bangun pukul 04.00 pagi membantu ibunya membuat kue basah, namun ia merasa malu membawanya ke sekolah.",
    logicNote: "Memperkenalkan tokoh utama (Ivan), latar waktu/keluarga, dan benih keresahan batin.",
  },
  {
    id: "beat-pemantik",
    stageLabel: "Titik 2 · Munculnya Konflik",
    stagePosition: "Pemantik Masalah",
    correctOrder: 2,
    summary:
      "Fiam dan teman-teman mengejek Ivan sebagai 'tukang kue', memicu keinginan kuat Ivan untuk lari dari kenyataan hidupnya.",
    logicNote: "Peristiwa pemicu (inciting incident) yang mendorong tokoh mengambil keputusan berisiko.",
  },
  {
    id: "beat-komplikasi",
    stageLabel: "Titik 3 · Tengah (Komplikasi Magis)",
    stagePosition: "Komplikasi (Tengah)",
    correctOrder: 3,
    summary:
      "Ivan bertemu pria misterius berkerudung hitam pemilik bola waktu dan memilih bola merah menuju tahun 2022.",
    logicNote: "Anomali fantasi masuk ke cerita; aturan dunia fantasi ditetapkan lewat bola waktu.",
  },
  {
    id: "beat-klimaks",
    stageLabel: "Titik 4 · Puncak (Klimaks)",
    stagePosition: "Klimaks (Puncak)",
    correctOrder: 4,
    summary:
      "Di tahun 2022 Ivan populer sebagai atlet basket, tetapi ia terpukul saat mendapati Ayahnya telah wafat karena kelelahan bekerja tanpa bantuannya.",
    logicNote: "Titik ketegangan tertinggi: keinginan semu tokoh berbenturan dengan harga mahal yang harus dibayar.",
  },
  {
    id: "beat-resolusi",
    stageLabel: "Titik 5 · Akhir (Resolusi & Amanat)",
    stagePosition: "Resolusi (Akhir)",
    correctOrder: 5,
    summary:
      "Ivan terbangun kembali di masa kini, memeluk Ayah-Ibunya dengan syukur, dan bangga berjualan kue sambil berlatih basket.",
    logicNote: "Penyelesaian masalah yang menampilkan transformasi watak tokoh dan pesan moral cerita.",
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
    text: "Jangan pernah menerima benda ajaib dari orang asing yang ditemui di jalan.",
    isCorrect: false,
    feedback:
      "Kurang tepat. Bola waktu hanyalah sarana imajinatif (komplikasi fantasi); inti perubahan Ivan terletak pada sikapnya terhadap keluarga.",
  },
  {
    id: "amanat-b",
    text: "Syukurilah keberadaan orang tua dan jangan gengsi membantu keluarga demi mengejar pengakuan semu dari teman.",
    isCorrect: true,
    feedback:
      "Tepat sekali. Klimaks tahun 2022 menyadarkan Ivan bahwa kasih sayang dan kerja keras bersama orang tua jauh lebih berharga daripada gengsi.",
  },
  {
    id: "amanat-c",
    text: "Berhentilah bermain basket agar seluruh waktu dapat dipakai untuk berjualan kue basah.",
    isCorrect: false,
    feedback:
      "Kurang tepat. Pada bagian Resolusi, Ivan tetap giat berlatih basket sekaligus bangga membantu orang tuanya.",
  },
];

// ============================================================================
// BABAK II: SEGEL CERMIN WATAK & LENSA LIMA INDERA (Hlm. 59–67 & Peluang #4)
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
    characterName: "Mao (Sihir Unik Mao, hlm. 59–62)",
    storySource: "Komik 'Sihir Unik Mao'",
    roleBadge: "Protagonis",
    traitClaim: "Pantang menyerah dan membalas ejekan dengan kebaikan kreatif",
    options: [
      {
        id: "mao-opt-1",
        quote:
          "Walau sering lupa mantra umum dan ditertawakan, Mao terus berlatih bersama Piru hingga menemukan bakat menyihir stroberi dan cokelat lezat untuk meredakan amarah Yari.",
        isValidEvidence: true,
        explanation:
          "Bukti tindakan konkret: Mao tidak membalas Yari dengan kutukan jahat, melainkan mengasah keunikan dirinya untuk mendamaikan suasana.",
      },
      {
        id: "mao-opt-2",
        quote: "Mao adalah murid di Sekolah Peri Juara yang mengenakan jubah peri berwarna cerah.",
        isValidEvidence: false,
        explanation:
          "Kalimat ini hanya menjelaskan status dan penampilan luar, belum membuktikan watak pantang menyerah melalui tindakan.",
      },
    ],
  },
  {
    id: "char-yari",
    characterName: "Yari (Sihir Unik Mao, hlm. 59–62)",
    storySource: "Komik 'Sihir Unik Mao'",
    roleBadge: "Antagonis",
    traitClaim: "Tinggi hati dan gemar meremehkan kemampuan teman yang berbeda",
    options: [
      {
        id: "yari-opt-1",
        quote: "Yari menguasai mantra terbang dan sihir dasar dengan cepat di kelas.",
        isValidEvidence: false,
        explanation: "Kepandaian akademik bukan bukti sifat antagonis; watak antagonis dibuktikan dari caranya memperlakukan tokoh lain.",
      },
      {
        id: "yari-opt-2",
        quote:
          "Yari menunjuk Mao sambil mencibir, 'Kau peri paling payah di sekolah ini! Mantra mudah saja selalu gagal!'",
        isValidEvidence: true,
        explanation:
          "Bukti dialog dan tindakan langsung yang menunjukkan kesombongan serta perannya sebagai pemicu konflik batin Mao.",
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
    transformation: "Menjelma ladang mentimun lebat yang melilit langkah dan menggoda Raksasa untuk makan.",
    tensionLevel: "Ketegangan Awal (35%) — Menghambat laju kejaran pertama.",
  },
  {
    order: 2,
    pouchId: "jarum",
    itemName: "Kantong Jarum",
    transformation: "Tumbuh seketika menjadi hutan pohon bambu rapat dan berduri tajam yang melukai kaki Raksasa.",
    tensionLevel: "Ketegangan Meningkat (60%) — Raksasa terluka dan semakin murka.",
  },
  {
    order: 3,
    pouchId: "garam",
    itemName: "Kantong Garam",
    transformation: "Membentang menjadi lautan luas berombak ganas yang hampir menenggelamkan Raksasa.",
    tensionLevel: "Menjelang Puncak (85%) — Rintangan berskala alam besar, namun Raksasa masih sanggup berenang.",
  },
  {
    order: 4,
    pouchId: "terasi",
    itemName: "Kantong Terasi (Klimaks)",
    transformation: "Meledak menjadi lautan lumpur mendidih yang akhirnya menelan Raksasa dan menyelamatkan Emas.",
    tensionLevel: "Klimaks Puncak (100%) — Titik balik penentu kemenangan protagonis.",
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
    flatSentence: "Latar Umum (Lemah): 'Ivan masuk ke tempat yang aneh dan melihat banyak bola waktu.'",
    options: [
      {
        id: "s1-a",
        text: "Lorong itu diselimuti kabut keperakan, sementara puluhan bola kristal berpendar merah delima dan biru safir melayang di udara.",
        isRichSensory: true,
        feedback:
          "Kuat secara visual: pembaca dapat membayangkan warna kabut ('keperakan') dan pendar cahaya ('merah delima', 'biru safir').",
      },
      {
        id: "s1-b",
        text: "Ivan masuk ke sebuah ruangan yang sangat aneh sekali dan di sana terdapat banyak bola waktu yang bagus.",
        isRichSensory: false,
        feedback:
          "Masih abstrak: kata 'sangat aneh sekali' dan 'bagus' tidak memberi gambaran visual konkret di mata pembaca.",
      },
    ],
  },
  {
    id: "sens-2",
    senseBadge: "Pendengaran & Suara",
    flatSentence: "Latar Umum (Lemah): 'Raksasa datang mengejar Emas dengan suara yang keras.'",
    options: [
      {
        id: "s2-a",
        text: "Raksasa itu berlari sangat cepat dan mengeluarkan suara yang amat keras sehingga Emas takut.",
        isRichSensory: false,
        feedback: "Kurang detail pendengaran: belum melukiskan bunyi spesifik yang terdengar telinga.",
      },
      {
        id: "s2-b",
        text: "Dentuman langkah kaki Raksasa menggetarkan tanah hutan, disusul geraman berat yang merontokkan dedaunan kering.",
        isRichSensory: true,
        feedback:
          "Kuat secara auditori & kinestetik: kata 'dentuman langkah', 'menggetarkan tanah', dan 'geraman berat' menghidupkan suasana genting.",
      },
    ],
  },
  {
    id: "sens-3",
    senseBadge: "Penciuman & Perabaan",
    flatSentence: "Latar Umum (Lemah): 'Mao menyihir buah-buahan yang enak di ruang kelas peri.'",
    options: [
      {
        id: "s3-a",
        text: "Harum manis stroberi segar dan lelehan cokelat hangat seketika memenuhi udara kelas yang semula dingin menegangkan.",
        isRichSensory: true,
        feedback:
          "Kuat secara penciuman & perabaan: memadukan aroma ('harum manis stroberi') dan suhu ('cokelat hangat' vs 'udara dingin').",
      },
      {
        id: "s3-b",
        text: "Buah-buahan hasil sihir Mao terlihat sangat enak dan membuat semua peri di kelas senang.",
        isRichSensory: false,
        feedback: "Hanya menyebutkan kesimpulan ('terlihat enak'), belum melibatkan indera penciuman atau perabaan.",
      },
    ],
  },
];

// ============================================================================
// BABAK III: SEGEL ALKIMIA BAHASA (MAJAS ASOSIASI & DIALOG — Hlm. 63 & 69–70)
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
    blankPrompt: "Kami berdua sulit menyatu [Penanda] [Perumpamaan]. (Buku Paket hlm. 63)",
    correctConnector: "bagaikan",
    correctComparison: "minyak dan air",
    connectorChoices: ["bagaikan", "daripada", "karena"],
    comparisonChoices: ["minyak dan air", "bintang kejora", "anak panah"],
    explanation:
      "Majas asosiasi membandingkan dua sifat bertolak belakang dengan benda nyata yang tidak bisa bercampur ('bagaikan minyak dan air').",
  },
  {
    id: "majas-2",
    contextSentence: "Pertolongan Piru yang tulus memberi harapan baru bagi Mao yang sedang putus asa.",
    blankPrompt: "Kebaikan sahabatnya terasa menyejukkan hati [Penanda] [Perumpamaan]. (Buku Paket hlm. 63)",
    correctConnector: "laksana",
    correctComparison: "oase di padang pasir",
    connectorChoices: ["laksana", "sehingga", "meskipun"],
    comparisonChoices: ["oase di padang pasir", "benang kusut", "bara api"],
    explanation:
      "Kata 'laksana' merupakan penanda majas asosiasi puitis, dan 'oase di padang pasir' melambangkan penyejuk di tengah kesulitan.",
  },
  {
    id: "majas-3",
    contextSentence: "Saat kantong terakhir dilempar, Emas berlari sangat kencang meninggalkan tebing.",
    blankPrompt: "Tubuh kecil Emas melesat cepat menembus kabut [Penanda] [Perumpamaan]. (Buku Paket hlm. 63)",
    correctConnector: "seperti",
    correctComparison: "anak panah",
    connectorChoices: ["seperti", "supaya", "tetapi"],
    comparisonChoices: ["anak panah", "oase di padang pasir", "minyak dan air"],
    explanation:
      "Kecepatan gerak tokoh dibandingkan dengan 'anak panah' yang meluncur dari busur menggunakan kata pembanding 'seperti'.",
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
    speaker: "Raksasa kepada Emas (Buku Paket hlm. 69–70)",
    sourceStory: "Komik 'Keberanian Emas'",
    directSpeech:
      'Raksasa berseru, "Berani-beraninya kau melukaiku! Akan kutangkap dan kumakan habis kau, Emas!"',
    options: [
      {
        id: "dlg-1-a",
        text: 'Raksasa mengatakan bahwa "Berani-beraninya kau melukaiku dan akan kutangkap kau, Emas!"',
        isCorrect: false,
        ruleExplanation:
          "Masih salah menurut kaidah EYD V: kalimat tak langsung wajib menghilangkan tanda petik (\"...\") dan mengubah kata ganti 'kau/-ku'.",
      },
      {
        id: "dlg-1-b",
        text: "Raksasa tak menyangka Emas berani melukainya dan mengancam akan menangkap serta memakan habis Emas.",
        isCorrect: true,
        ruleExplanation:
          "Benar sesuai Buku Paket hlm. 69: tanda petik dilepas, kata ganti '-ku' berubah menjadi '-nya' (Raksasa), dan 'kau' menjadi 'Emas'.",
      },
      {
        id: "dlg-1-c",
        text: "Emas berseru bahwa ia akan menangkap dan memakan habis Raksasa yang telah melukainya.",
        isCorrect: false,
        ruleExplanation:
          "Subjek pelaku terbalik: yang mengucapkan ancaman adalah Raksasa kepada Emas, bukan sebaliknya.",
      },
    ],
  },
  {
    id: "dlg-2",
    speaker: "Piru kepada Mao (Buku Paket hlm. 69)",
    sourceStory: "Komik 'Sihir Unik Mao'",
    directSpeech: 'Piru berkata dengan lembut, "Jangan menyerah, Mao! Aku yakin sihir makananmu sangat berguna."',
    options: [
      {
        id: "dlg-2-a",
        text: "Piru menyemangati Mao agar tidak menyerah dan meyakinkan bahwa sihir makanan sahabatnya itu sangat berguna.",
        isCorrect: true,
        ruleExplanation:
          "Benar: tanda petik dihapus, pronomina 'Aku' melebur ke subjek Piru, dan sapaan 'Mao' menjadi objek yang disemangati.",
      },
      {
        id: "dlg-2-b",
        text: "Piru berkata jangan menyerah Mao, aku yakin sihir makananmu sangat berguna.",
        isCorrect: false,
        ruleExplanation:
          "Masih salah: kata ganti 'aku' dan '-mu' belum disesuaikan menjadi sudut pandang orang ketiga.",
      },
    ],
  },
];

// ============================================================================
// BANK KATA FANTASI & PETA LIMA INDERA (Pendukung CP Fase D & Peluang #4)
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
    category: "Cahaya & Atmosfer Magis",
    subtitle: "Memperkaya latar tempat agar tidak datar",
    entries: [
      {
        word: "Berpendar",
        type: "Denotatif",
        meaning: "Memancarkan cahaya lembut yang tampak berkilau di kegelapan.",
        example: "Runa emas di sampul kitab itu berpendar saat disentuh.",
      },
      {
        word: "Temaram",
        type: "Denotatif",
        meaning: "Remang-remang atau setengah terang setengah gelap.",
        example: "Di bawah cahaya lentera yang temaram, bayangan jubahnya memanjang.",
      },
      {
        word: "Bak bintang kejora",
        type: "Kiasan / Majas",
        meaning: "Sangat indah dan bersinar terang di tengah kegelapan.",
        example: "Permata kompas itu berkilau indah bak bintang kejora.",
      },
    ],
  },
  {
    id: "lex-gerak",
    category: "Gerak & Ketegangan Konflik",
    subtitle: "Menghidupkan adegan komplikasi dan klimaks",
    entries: [
      {
        word: "Melesat",
        type: "Denotatif",
        meaning: "Meluncur dengan sangat cepat ke satu arah.",
        example: "Anak panah cahaya itu melesat menembus kabut hitam.",
      },
      {
        word: "Membeku",
        type: "Konotatif",
        meaning: "Terpaku diam tak bergerak karena terkejut atau ketakutan.",
        example: "Langkah Ivan membeku ketika membaca nama di batu nisan itu.",
      },
      {
        word: "Bagaikan bara api",
        type: "Kiasan / Majas",
        meaning: "Semangat atau tekad yang menyala-nyala dan tak mudah padam.",
        example: "Tekad Emas untuk selamat menyala bagaikan bara api.",
      },
    ],
  },
];

// ============================================================================
// SIDE-QUESTS DI ASTROLAB PETA PEMBELAJARAN (Menjawab Masalah Prioritas Siswa)
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
    code: "QUEST 01 · PEMANTIK IDE",
    title: "Menemukan Ide Fantasi yang Tidak Klise",
    targetCompetency: "Mengatasi masalah ide cerita yang terlalu umum/meniru cerita lama",
    scenario:
      "Raka ingin menulis cerita fantasi, tetapi idenya hanya: 'Seorang anak menemukan pedang sakti lalu mengalahkan raja iblis.' Ide ini terlalu umum.",
    question: "Kombinasi ide manakah yang paling segar, dekat dengan kehidupan siswa, namun memiliki anomali fantasi yang kuat?",
    options: [
      {
        id: "q1-a",
        text: "Seorang siswa yang sering terlambat sekolah menemukan jam saku tua milik kakeknya yang bisa mengulang waktu 10 menit, namun setiap dipakai satu kenangan berharganya ikut terhapus.",
        isCorrect: true,
        feedback:
          "Sangat kuat! Menggabungkan latar keseharian siswa (seperti 'Bola-Bola Waktu') dengan aturan dunia fantasi yang jelas (konsekuensi kehilangan kenangan).",
      },
      {
        id: "q1-b",
        text: "Seorang pangeran dari kerajaan awan memiliki kekuatan terkuat di dunia dan mengalahkan semua musuhnya dengan satu pukulan tanpa kesulitan.",
        isCorrect: false,
        feedback:
          "Kurang efektif: jika tokoh terlalu sempurna tanpa kelemahan atau aturan batas kekuatan, cerita kehilangan konflik dan komplikasi.",
      },
    ],
  },
  {
    id: "quest-logika",
    code: "QUEST 02 · LOGIKA ALUR",
    title: "Menambal Lubang Logika Dunia Fantasi",
    targetCompetency: "Mengatasi masalah alur melompat-lompat dan cerita tidak logis",
    scenario:
      "Dalam draf cerita Dinda: 'Di Orientasi dijelaskan bahwa kantong sihir Aruna hanya berfungsi jika terkena sinar matahari. Namun saat Klimaks di dalam gua bawah tanah yang gelap gulita, Aruna membuka kantong itu dan langsung mengeluarkan cahaya matahari raksasa tanpa penjelasan.'",
    question: "Mengapa alur cerita Dinda terasa berlubang, dan bagaimana cara memperbaikinya?",
    options: [
      {
        id: "q2-a",
        text: "Melanggar aturan dunia fantasi yang dibuat sendiri di Orientasi. Solusinya: Aruna harus memecahkan celah langit-langit gua lebih dulu agar seberkas cahaya matahari masuk menyentuh kantongnya.",
        isCorrect: true,
        feedback:
          "Tepat! Walaupun cerita fantasi bersifat imajinatif, sebab-akibat di dalamnya wajib konsisten dengan aturan dunia yang sudah ditetapkan penulis.",
      },
      {
        id: "q2-b",
        text: "Tidak ada masalah karena di dalam cerita fantasi semua hal boleh terjadi secara tiba-tiba tanpa perlu alasan sebab-akibat.",
        isCorrect: false,
        feedback:
          "Keliru. Cerita fantasi yang baik tetap menuntut logika internal (sebab-akibat) agar penyelesaian di Klimaks tidak terasa curang.",
      },
    ],
  },
  {
    id: "quest-eyd",
    code: "QUEST 03 · PENYUNTINGAN EYD V",
    title: "Ketelitian Kata Depan & Tanda Baca Dialog",
    targetCompetency: "Meninjau dan memperbaiki penggunaan bahasa (TP 5 & Kaidah EYD V)",
    scenario:
      "Perhatikan kalimat draf berikut: Diperpustakaan kuno itu, Aruna berbisik \"jangan sentuh segel emas yang ada diatas meja!\"",
    question: "Perbaikan manakah yang paling tepat sesuai kaidah EYD Edisi V?",
    options: [
      {
        id: "q3-a",
        text: 'Di perpustakaan kuno itu, Aruna berbisik, "Jangan sentuh segel emas yang ada di atas meja!"',
        isCorrect: true,
        feedback:
          "Sempurna! Kata depan penunjuk tempat ('di perpustakaan', 'di atas') wajib ditulis terpisah, sebelum petikan langsung diberi tanda koma, dan huruf awal petikan menggunakan huruf kapital.",
      },
      {
        id: "q3-b",
        text: 'Diperpustakaan kuno itu, Aruna berbisik "Jangan sentuh segel emas yang ada di atas meja".',
        isCorrect: false,
        feedback:
          "Masih belum tepat: 'Diperpustakaan' seharusnya dipisah ('Di perpustakaan') karena menunjukkan tempat, dan setelah kata 'berbisik' wajib diberi tanda koma.",
      },
    ],
  },
];
