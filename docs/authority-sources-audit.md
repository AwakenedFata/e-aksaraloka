# Audit Sumber Otoritatif: KBBI dan EYD

- **Tanggal verifikasi:** 2026-10-03
- **Metode:** HTTP fetch halaman publik resmi (tanpa login, tanpa scraping isi kamus), dibaca manual.
- **Status:** Audit awal (Stage 0). Ini **bukan** opini hukum. Keputusan komersial wajib dikonfirmasi tertulis ke Badan Bahasa.

## 1. Temuan domain

| Domain lama | Status 2026-10-03 | Domain aktif |
|---|---|---|
| `kbbi.kemdikbud.go.id` | DNS tidak resolve dari lingkungan audit | `kbbi.kemendikdasmen.go.id` |
| `ejaan.kemdikbud.go.id` | DNS tidak resolve dari lingkungan audit | `ejaan.kemendikdasmen.go.id` |

Implikasi: URL sumber **tidak boleh di-hardcode**. Base URL masuk ke konfigurasi provider dan metadata provenance menyimpan URL yang benar pada saat lookup.

Catatan: halaman EYD masih memuat `<link rel=canonical href=https://ejaan.kemdikbud.go.id/>`. Artinya canonical belum diperbarui. Ini perlu dipantau.

## 2. KBBI VI Daring

**Fakta yang teramati** (sumber: `https://kbbi.kemendikdasmen.go.id/`):

- Judul laman: "KBBI VI Daring".
- Versi daring tertera: `6.1.0.0-20260421183255`.
- Pemutakhiran terakhir tertera: April 2026.
- Fitur akun ("Daftar Baru", "Masuk") tersedia. Pengumuman menyebut pendaftaran pengguna sedang terganggu dan dilayani lewat formulir.
- Footer: "Ketentuan Hukum: seluruh isi dari KBBI Daring dilindungi Hak Cipta."
- Tersedia aplikasi luring Android/iOS, tetapi itu aplikasi pengguna, bukan API.

**Halaman Ketentuan Hukum** (`/Beranda/Hukum`) mengutip UU Hak Cipta (Pasal 8, 9, 52, 113). Intinya:

- Penggandaan dan penggunaan secara komersial tanpa izin pemegang hak cipta dilarang (Pasal 9 ayat 3).
- Merusak atau menonaktifkan sarana kontrol teknologi pelindung ciptaan dilarang (Pasal 52).
- Ada ancaman pidana untuk penggunaan komersial tanpa hak (Pasal 113).

**API:**

- Tidak ditemukan dokumentasi API publik resmi di laman KBBI Daring maupun di halaman Bantuan.
- Pustaka "API KBBI" yang beredar (GitHub, PyPI, dan lainnya) adalah proyek pihak ketiga yang mem-*parse* HTML situs resmi. Itu tergolong scraping dan **tidak** berstatus resmi.

**Kesimpulan untuk Aksaraloka:**

1. **Tidak ada official API yang terverifikasi.** Aksaraloka tidak boleh mengklaim "terintegrasi dengan API KBBI".
2. **Scraping KBBI Daring tidak diizinkan dalam proyek ini.** Alasannya: spesifikasi (§7, §34) melarang scraping diam-diam, isi KBBI dilindungi hak cipta dengan larangan penggandaan komersial tanpa izin, dan Pasal 52 melarang mengakali kontrol teknologi seperti login/akun.
3. **Menyalin atau mengekspor isi KBBI ke database lokal tidak diizinkan** tanpa izin tertulis. Ini juga berlaku untuk `lexicon_cache` yang menyimpan definisi.
4. **Yang tetap sah:**
   - Menyimpan *tautan* ke entri KBBI Daring sebagai rujukan untuk dibuka pengguna sendiri, misalnya tombol "Lihat di KBBI".
   - Menyusun aturan dan daftar koreksi buatan tim sendiri, misalnya pasangan bentuk tidak baku dan baku seperti `resiko` → `risiko`, dengan provenance berupa *rujukan* ke KBBI ("bentuk baku menurut KBBI VI Daring, diverifikasi manual oleh kurator pada tanggal X"). Definisi KBBI tidak ikut disalin.
   - Mengajukan izin atau kerja sama data resmi ke Badan Bahasa (kontak di halaman Hukum: `badan.bahasa@kemdikbud.go.id`).

## 3. EYD Edisi V

**Fakta yang teramati** (sumber: `https://ejaan.kemendikdasmen.go.id/`):

- Judul "EYD V" dengan teks "Ejaan Bahasa Indonesia yang Disempurnakan, Edisi Kelima".
- Situs dokumentasi statis (MkDocs Material 9.5.33). Struktur bab: Penggunaan Huruf (A–H), Penulisan Kata (A–I), Penggunaan Tanda Baca (A–O), Penulisan Unsur Serapan (Umum, Khusus), dan Surat Keputusan.
- Footer: "© Badan Pengembangan dan Pembinaan Bahasa - Kementerian Pendidikan Dasar dan Menengah".
- Sumber sekunder menyebut dasar hukum Keputusan Kepala Badan Bahasa Nomor 0424/I/BS.00.01/2022, ditetapkan 16 Agustus 2022. Nomor ini **belum** diverifikasi langsung dari halaman "Surat Keputusan" resmi. Verifikasi dijadwalkan di Stage 2 sebelum dipakai sebagai provenance.
- Tidak ada API. Ini wajar karena EYD adalah dokumen pedoman, bukan basis data.

**Kesimpulan untuk Aksaraloka:**

1. EYD adalah **kaidah**. Kaidah dapat diimplementasikan ulang sebagai *rule engine* buatan sendiri, misalnya "kata depan *di* ditulis terpisah dari kata yang mengikutinya". Yang diimplementasikan adalah logikanya, bukan salinan teks.
2. Setiap rule menyimpan rujukan berupa bab, subbab, dan URL halaman EYD V terkait. Kutipan verbatim dibatasi pada potongan pendek yang perlu untuk penjelasan dan selalu disertai atribusi. Batas aman kutipan perlu dikonfirmasi.
3. Teks EYD tidak boleh di-*mirror* secara massal ke database.

## 4. Desain yang dihasilkan audit ini

- `LexicalProvider` dan `LanguageRuleProvider` adalah antarmuka. Implementasi awal yang diizinkan:
  - `CuratedLexiconProvider`: daftar bentuk baku/tidak baku hasil kurasi tim, dengan provenance per entri (sumber rujukan, tanggal verifikasi manual, kurator).
  - `EydRuleProvider`: aturan deterministik buatan sendiri dengan referensi bab EYD V.
  - `KbbiLinkProvider`: hanya membuat URL rujukan entri KBBI untuk pengguna, tanpa fetch.
- Status verifikasi yang jujur:
  - `authority_verified` hanya dipakai bila entri kurasi telah diverifikasi manual terhadap sumber resmi dan tanggal verifikasinya tercatat.
  - Selain itu dipakai `deterministic_rule`, `model_suggestion`, `stylistic`, atau `uncertain`.
- `OfficialKbbiProvider` **tidak dibuat** sampai ada izin atau API resmi tertulis.

## 5. Pertanyaan terbuka (perlu keputusan pemilik proyek)

1. Apakah Aksaraloka komersial? Jika ya, risiko hak cipta meningkat dan izin resmi Badan Bahasa sangat disarankan sebelum peluncuran.
2. Siapa yang menjadi kurator leksikon dan aturan? Akurasi Authority Layer bergantung pada kurasi manusia, bukan pada LLM.
3. Apakah akan mengajukan permohonan akses data resmi ke Badan Bahasa?
