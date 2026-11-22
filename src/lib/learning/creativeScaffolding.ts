/**
 * Lapisan 1 (Offline-First Creative Scaffolding Engine) untuk E-Aksaraloka.
 *
 * Memberikan:
 * 1. Mesin Acak Ramuan Ide Fantasi Kombinatorial (100.000+ premis orisinal offline).
 * 2. Pustaka Kerangka Kalimat Multi-Pola (rumpang [...] anti-ghostwriting).
 * 3. Pemantik Diksi & Majas Offline Adaptif Tema (juga menjadi fallback luring bagi AI Coach).
 */

export interface FantasyIdeaRecipe {
  readonly themeLabel: string;
  readonly protagonistName: string;
  readonly protagonistRole: string;
  readonly protagonistTraitAction: string;
  readonly magicArtifact: string;
  readonly settingPlace: string;
  readonly worldRule: string;
  readonly antagonistName: string;
  readonly antagonistConflictTrigger: string;
  readonly sensoryHint: {
    readonly sight: string;
    readonly sound: string;
    readonly smellTouch: string;
  };
}

const PROTAGONIST_SEEDS = [
  {
    name: "Nala",
    role: "siswa piket perpustakaan sekolah",
    trait: "Tekun dan jujur: memilih menepati janji daripada mengambil jalan pintas.",
  },
  {
    name: "Bima",
    role: "anak penjual jamu tradisional yang pemalu",
    trait: "Peduli dan berani: rela menolong teman yang pernah mengejeknya.",
  },
  {
    name: "Sora",
    role: "pelukis sketsa di buku catatan kelas",
    trait: "Kreatif dan sabar: mencari akal cerdik saat kekuatannya terbatas.",
  },
  {
    name: "Rafi",
    role: "perawat kucing jalanan di sekitar sekolah",
    trait: "Penyayang dan setia kawan: tidak pernah meninggalkan sahabat di saat genting.",
  },
  {
    name: "Tara",
    role: "anak tukang reparasi jam dinding kuno",
    trait: "Teliti dan bertanggung jawab: berani mengakui kesalahan sebelum terlambat.",
  },
  {
    name: "Lintang",
    role: "penabuh gamelan muda di sanggar desa",
    trait: "Rendah hati dan gigih: terus berlatih walau awalnya sering diremehkan.",
  },
  {
    name: "Kala",
    role: "pengumpul perangko tua dari loteng nenek",
    trait: "Ingin tahu dan jujur: patuh pada aturan pusaka meski sedang terdesak.",
  },
  {
    name: "Ayu",
    role: "penjaga kebun tanaman obat di halaman belakang",
    trait: "Tulus dan tangguh: melindungi alam dari keserakahan tanpa kekerasan.",
  },
  {
    name: "Fajar",
    role: "pengantar roti subuh yang suka mengamati bintang",
    trait: "Pantang menyerah dan suka berbagi meski hidupnya sederhana.",
  },
  {
    name: "Dira",
    role: "murid pendiam yang pandai membaca peta lama",
    trait: "Cerdik dan tenang: mengambil keputusan bijak di puncak bahaya.",
  },
] as const;

const ARTIFACT_SEEDS = [
  "Kompas Jarum Perak yang menunjuk rahasia tersembunyi",
  "Botol Tinta Bercahaya yang menghidupkan gambar sejenak",
  "Seruling Bambu Tua yang menenangkan badai dan makhluk liar",
  "Kacamata Lensa Kabut yang memperlihatkan jejak masa lalu",
  "Lentera Kunang-Kunang yang membelah kegelapan pekat",
  "Kunci Kuningan Bernada yang membuka pintu ruang rahasia",
  "Tiket Bus Nomor 00 menuju stasiun lintas dimensi",
  "Payung Kertas Hujan yang memperlambat gerak waktu",
  "Jam Pasir Garam Laut yang memutar ulang lima menit terakhir",
  "Buku Catatan Kosong yang membalas pertanyaan dengan petunjuk teka-teki",
] as const;

const SETTING_SEEDS = [
  {
    theme: "Perpustakaan Awan di Atas Menara",
    place: "Perpustakaan Awan Menara Utara",
    sight: "rak buku melayang diterpa cahaya keemasan di sela kabut putih",
    sound: "gemerisik lembaran kertas tua disusul desir angin ketinggian",
    smellTouch: "aroma kertas kuno dan udara sejuk menyentuh pipi",
  },
  {
    theme: "Pasar Malam Bawah Laut",
    place: "Pasar Lentera Karang Bawah Laut",
    sight: "lentera ubur-ubur berpendar biru safir menerangi kubah kaca laut",
    sound: "gema gelembung air dan denting lonceng kerang di kejauhan",
    smellTouch: "bau garam laut yang segar dan dinding kaca yang dingin lembap",
  },
  {
    theme: "Hutan Jamur Bercahaya",
    place: "Lembah Jamur Pendar Malam",
    sight: "payung jamur raksasa berkilau hijau zamrud di tengah gelap pekat",
    sound: "gemerisik spora jatuh dan suara jangkrik kristal yang nyaring",
    smellTouch: "aroma tanah basah sehabis hujan dan embun dingin di ujung jari",
  },
  {
    theme: "Kota Roda Gigi & Jam Raksasa",
    place: "Menara Roda Gigi Kota Jam",
    sight: "roda kuningan raksasa berkilau temaram di balik uap keperakan",
    sound: "detak jarum jam menggelegar berpadu derit besi berputar",
    smellTouch: "bau logam hangat dan getaran lantai batu di bawah sepatu",
  },
  {
    theme: "Stasiun Kereta Kaca Tengah Malam",
    place: "Peron Kaca Stasiun Bintang",
    sight: "gerbong kereta bening memantulkan cahaya ungu dan bintang kejora",
    sound: "peluit perak melengking disusul gemuruh roda di atas rel cahaya",
    smellTouch: "hawa malam yang menusuk kulit dan aroma hujan baru turun",
  },
  {
    theme: "Kerajaan Kucing Penjaga Mimpi",
    place: "Jembatan Atap Kerajaan Kucing",
    sight: "lentera kertas jingga berpendar hangat di sepanjang atap genting tua",
    sound: "denting lonceng leher dan langkah kaki halus meniti papan kayu",
    smellTouch: "harum kayu manis hangat dari kedai kecil di sudut jembatan",
  },
  {
    theme: "Kebun Kaca Musim Semi Abadi",
    place: "Kubah Kebun Kaca Pusaka",
    sight: "kelopak bunga bercahaya melayang pelan menembus sinar matahari",
    sound: "gemericik air mancur batu dan desir daun kering yang berbisik",
    smellTouch: "wangi melati semerbak berpadu hangatnya sinar di kaca kubah",
  },
  {
    theme: "Dermaga Perahu Kertas Nusantara",
    place: "Dermaga Awan Perahu Kertas",
    sight: "ratusan perahu lipat berkilau keemasan mengapung di sungai berkabut",
    sound: "riuh dayung kayu menyentuh air dan nyanyian angin lembah",
    smellTouch: "aroma pandan segar dan percikan air dingin di pergelangan tangan",
  },
  {
    theme: "Lorong Cermin Ruang Musik",
    place: "Aula Cermin Nada Sekolah Tua",
    sight: "pantulan cermin berkilau memancarkan garis cahaya mengikuti irama",
    sound: "petikan dawai menggema lembut lalu berubah cepat menegangkan",
    smellTouch: "udara ruangan yang pengap perlahan berubah sejuk saat nada tepat",
  },
  {
    theme: "Lembah Gunung Api Kristal",
    place: "Jembatan Batu Lembah Kristal",
    sight: "dinding gua berpendar merah delima dan jingga terang di kegelapan",
    sound: "gemuruh bumi dari kedalaman disusul gemerincing serpihan kristal",
    smellTouch: "hawa hangat menyengat wajah dan batu pijakan yang terasa kasar",
  },
] as const;

const WORLD_RULE_SEEDS = [
  "Kekuatan benda ajaib hanya menyala jika pemiliknya berkata jujur tanpa menyembunyikan kesalahan.",
  "Benda ajaib hanya boleh dipakai maksimal tiga kali sebelum matahari terbit, atau cahayanya padam selamanya.",
  "Keajaiban akan langsung mati bila digunakan untuk balas dendam atau merugikan orang lain.",
  "Setiap kali keajaiban diaktifkan, pemiliknya harus merelakan satu barang kesayangannya kehilangan warna.",
  "Benda pusaka hanya bekerja apabila disentuh oleh dua orang yang rela bekerja sama dan saling memaafkan.",
  "Cahaya pusaka hanya muncul saat terkena sinar alami (matahari atau bulan), bukan lampu buatan.",
  "Setiap penggunaan kekuatan meninggalkan jejak embun berkilau yang memudahkan tokoh lawan melacaknya.",
  "Mantra atau kekuatan hanya bertahan selama pemiliknya tetap tenang dan tidak panik.",
  "Keajaiban hanya bisa menolong orang lain terlebih dahulu sebelum dapat menyelamatkan diri sendiri.",
  "Jika aturan pantangan dilanggar, waktu di sekitar tempat itu melambat dan pintu pulang ikut terkunci.",
] as const;

const ANTAGONIST_SEEDS = [
  {
    name: "Kolektor Bayangan",
    trigger: "Berusaha mencuri benda ajaib untuk mengurung semua kenangan indah penduduk.",
  },
  {
    name: "Kabut Lupa",
    trigger: "Menyelimuti tempat itu hingga penduduk mulai melupakan nama sahabat dan keluarganya.",
  },
  {
    name: "Penjaga Jam Beku",
    trigger: "Ingin menghentikan waktu selamanya agar tidak ada perubahan yang terjadi.",
  },
  {
    name: "Raja Tinta Hitam",
    trigger: "Menelan cahaya dan warna dari dunia agar semuanya menjadi gelap dan sunyi.",
  },
  {
    name: "Pemburu Mata Air",
    trigger: "Serakah ingin menguasai sumber kehidupan desa demi keuntungan sendiri.",
  },
  {
    name: "Raksasa Gema",
    trigger: "Memperbesar rasa takut dan ejekan agar tokoh utama menyerah sebelum mencoba.",
  },
  {
    name: "Burung Besi Penjaga Gerbang",
    trigger: "Mengunci jalan pulang dan menguji apakah tokoh utama mau melanggar aturannya sendiri.",
  },
  {
    name: "Bayangan Cermin",
    trigger: "Meniru wujud tokoh utama dan membujuknya memakai keajaiban secara curang.",
  },
  {
    name: "Badai Pasir Sunyi",
    trigger: "Menghapus suara dan memisahkan tokoh utama dari sahabat pendukungnya.",
  },
  {
    name: "Pencuri Lentera",
    trigger: "Memadamkan seluruh cahaya penunjuk arah menjelang ujian penting.",
  },
] as const;

export function rollFantasyIdeaRecipe(seed?: number): FantasyIdeaRecipe {
  const pick = <T,>(arr: readonly T[], offset: number): T => {
    if (typeof seed === "number") {
      const idx = Math.abs(Math.floor(seed * 7 + offset * 3)) % arr.length;
      return arr[idx]!;
    }
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx]!;
  };

  const protag = pick(PROTAGONIST_SEEDS, 1);
  const artifact = pick(ARTIFACT_SEEDS, 2);
  const setting = pick(SETTING_SEEDS, 3);
  const rule = pick(WORLD_RULE_SEEDS, 4);
  const antag = pick(ANTAGONIST_SEEDS, 5);

  return {
    themeLabel: setting.theme,
    protagonistName: protag.name,
    protagonistRole: protag.role,
    protagonistTraitAction: protag.trait,
    magicArtifact: artifact,
    settingPlace: setting.place,
    worldRule: rule,
    antagonistName: antag.name,
    antagonistConflictTrigger: antag.trigger,
    sensoryHint: {
      sight: setting.sight,
      sound: setting.sound,
      smellTouch: setting.smellTouch,
    },
  };
}

// ============================================================================
// MULTI-PATTERN DYNAMIC SENTENCE FRAMES (ANTI-GHOSTWRITING, THEME-AWARE)
// ============================================================================

export type SentenceFrameGroupId =
  | "komplikasi_waktu"
  | "majas_asosiasi"
  | "dialog_langsung"
  | "tak_langsung_akhir";

export interface DynamicFrameContext {
  readonly protagonistName: string;
  readonly antagonistName: string;
  readonly settingPlace: string;
  readonly themeCategory: string;
}

export interface GeneratedSentenceFrame {
  readonly patternIndex: number;
  readonly totalPatterns: number;
  readonly patternLabel: string;
  readonly text: string;
}

export function buildDynamicSentenceFrame(
  group: SentenceFrameGroupId,
  patternIndex: number,
  ctx: DynamicFrameContext
): GeneratedSentenceFrame {
  const protag = ctx.protagonistName.trim() || "[Nama Tokoh Utama]";
  const antag = ctx.antagonistName.trim() || "[Tokoh Lawan/Rintangan]";
  const place = ctx.settingPlace.trim() || "[Tempat Ceritamu]";
  const theme = ctx.themeCategory.trim() || "dunia fantasimu";

  const banks: Record<
    SentenceFrameGroupId,
    readonly { readonly label: string; readonly build: () => string }[]
  > = {
    komplikasi_waktu: [
      {
        label: 'Pola "Tiba-tiba..."',
        build: () =>
          ` Tiba-tiba [tulis bunyi atau kejadian mendadak] di ${place} ketika ${antag} [tulis tindakan pengganggu].`,
      },
      {
        label: 'Pola "Seketika..."',
        build: () =>
          ` Seketika suasana di ${place} berubah menegangkan karena ${antag} [tulis ancaman yang muncul].`,
      },
      {
        label: 'Pola "Tak lama kemudian..."',
        build: () =>
          ` Tak lama kemudian, [tulis tanda bahaya yang terlihat/terdengar] membuat ${protag} menyadari masalah besar sedang mendekat.`,
      },
      {
        label: 'Pola "Namun mendadak..."',
        build: () =>
          ` Namun sebelum ${protag} sempat bersiap, ${antag} menghalangi jalan di ${place} sambil [tulis aksinya].`,
      },
    ],
    majas_asosiasi: [
      {
        label: 'Perumpamaan "bagaikan"',
        build: () =>
          ` ${protag} [tulis gerak/perasaan tokoh] bagaikan [tulis benda pembanding yang cocok dengan tema ${theme}].`,
      },
      {
        label: 'Perumpamaan "laksana"',
        build: () =>
          ` Cahaya di ${place} [tulis perubahan suasana] laksana [tulis kiasan alam atau benda bercahaya].`,
      },
      {
        label: 'Perumpamaan "seperti"',
        build: () =>
          ` Langkah ${protag} melesat cepat seperti [tulis hal yang sangat cepat] demi menghadapi ${antag}.`,
      },
      {
        label: 'Perumpamaan "bak"',
        build: () =>
          ` Keberanian ${protag} menyala terang bak [tulis simbol cahaya atau semangat versimu].`,
      },
    ],
    dialog_langsung: [
      {
        label: 'Dialog "berseru"',
        build: () =>
          ` ${protag} berseru dengan lantang, "[Tulis ucapan tegas tokohmu di sini!]"`,
      },
      {
        label: 'Dialog "berbisik"',
        build: () =>
          ` ${protag} berbisik pelan, "[Tulis rencana rahasia atau peringatan tokohmu di sini.]"`,
      },
      {
        label: 'Dialog "bertanya"',
        build: () =>
          ` ${protag} bertanya dengan cemas, "[Tulis pertanyaan tokohmu saat terdesak di sini?]"`,
      },
      {
        label: 'Dialog Lawan',
        build: () =>
          ` ${antag} berkata sambil mengancam, "[Tulis tantangan tokoh lawan kepada ${protag} di sini!]"`,
      },
    ],
    tak_langsung_akhir: [
      {
        label: 'Tak Langsung "menyadari bahwa"',
        build: () =>
          ` Akhirnya ${protag} menyadari bahwa [tulis pelajaran kebaikan atau perubahan sikap di akhir cerita].`,
      },
      {
        label: 'Tak Langsung "menjelaskan bahwa"',
        build: () =>
          ` Keesokan harinya, ${protag} menjelaskan bahwa [tulis alasan jujur atau solusi yang ia pilih].`,
      },
      {
        label: 'Tak Langsung "berpesan agar"',
        build: () =>
          ` Sebelum berpisah di ${place}, ${protag} berpesan agar [tulis nasihat baik yang perlu dijaga].`,
      },
      {
        label: 'Tak Langsung "berjanji bahwa"',
        build: () =>
          ` Sejak saat itu, ${protag} berjanji bahwa ia akan [tulis tekad baik tokoh setelah masalah selesai].`,
      },
    ],
  };

  const groupEntries = banks[group];
  const safeIdx = Math.abs(patternIndex) % groupEntries.length;
  const chosen = groupEntries[safeIdx]!;

  return {
    patternIndex: safeIdx,
    totalPatterns: groupEntries.length,
    patternLabel: chosen.label,
    text: chosen.build(),
  };
}
