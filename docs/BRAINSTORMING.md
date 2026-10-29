# BRAINSTORMING — BaliTrade

Dokumen konteks hasil diskusi ide (belum masuk arsitektur). AI/sesi berikutnya wajib membaca ini dulu.
Spesifikasi dan catatan implementasi desain UI (Google Stitch) ada di `docs/DESIGN.md`.

Status: tahap pematangan ide + desain UI **selesai (2026-10-22)**. Berikutnya: tahap arsitektur/teknis.

---

## 1. Latar belakang

- Bisnis ekspor barang **hanya ekspor**, tujuan utama **Rusia & negara CIS**.
- Barang sementara berasal dari **Bali**.
- Bisnis **sudah berjalan offline**: via WhatsApp, broadcast Telegram/grup untuk mencari supplier (mis. "cari kaos kaki", "cari topi"). Sudah ada transaksi & **repeat order**.
- Owner (user) bertugas **mendigitalisasi** ide temannya ke platform online.
- Skala **usaha kecil**, tujuan test market. PT dibangun nanti jika digitalisasi berhasil. Untuk awal cukup NIB perorangan (OSS).
- Nama app: **BaliTrade** (placeholder, logo menyusul).

## 2. Model bisnis

- **Marketplace B2B + owner juga penjual** (owner punya akun penjual sendiri).
- Platform (owner + crew) berperan sebagai: konsultasi, QC, packing, pengiriman cargo udara ke Rusia/CIS, dan secara operasional sebagai **eksportir**.
- Bukan seperti Tokopedia/Shopee: ada proses **diskusi** sebelum order/shipping → bagian diskusi harus kuat.
- Kategori: **apa saja yang diminta pembeli, selama legal**. Catatan: legal di Indonesia ≠ otomatis boleh diekspor (mis. produk kayu tertentu, satwa) atau boleh masuk Rusia/EAEU (makanan & kosmetik butuh sertifikasi EAC). Perlu daftar kategori terlarang.
- Nilai transaksi kecil: umumnya **< Rp10 juta**, bahkan ada Rp1 juta.
- Pendapatan potensial: komisi, fee QC, sourcing, margin logistik, selisih kurs.

## 3. Pihak / Role

| Role | Keterangan |
|---|---|
| Buyer | Pembeli dari Rusia/CIS (sebagian orang Rusia yang tinggal di Bali) |
| Seller | Penjual/UMKM Bali. **Daftar sendiri**, tapi **listing harus disetujui admin** (cegah penjual bodong) |
| Admin | Owner & crew. Ikut di semua chat, QC, update tracking, konfirmasi pembayaran manual |
| Mitra di negara tujuan | Orang yang membantu memantau barang. **Saat ini tidak punya role di app**; admin yang update status secara manual |

## 4. Jenis listing

1. **Ready stock** — tampil di halaman, bisa langsung dibeli.
2. **Made to order** — penjual sanggup produksi, ada lead time.
3. **Request (sourcing)** — tombol "Request" di app: pembeli tidak menemukan barang → isi form → **admin membalas manual**. Ini digitalisasi dari broadcast WA/Telegram yang sudah dilakukan. Data request = riset pasar (barang yang sering diminta bisa dijadikan ready stock).

## 5. Flow (garis besar, disepakati)

**Jalur Ready stock (lama: bayar dulu — DIGANTI 2026-10-21, lihat bagian 5a: keranjang → order request → konfirmasi penjual → baru bayar):**
Checkout & bayar → QC + dokumentasi (foto/video) → pembeli approve → kirim → sampai → masa inspeksi singkat → dana ke penjual.

**Jalur Made to order / Request:**
Request/diskusi → penawaran (quotation, ada masa berlaku) → deal → bayar/DP → produksi → QC + dokumentasi → pembeli approve → pelunasan → kirim → sampai → dana ke penjual.

Aturan penting:
- **Dana ditahan platform** selama proses; penjual menerima setelah barang sampai.
- **Uang muka ke penjual (mis. 50%)** untuk biaya produksi/operasional diperbolehkan, **dengan persetujuan eksplisit pembeli** (checkbox saat order).
- Harus ada aturan **jika QC gagal**: pembeli pilih refund penuh atau ganti barang.
- **Ongkir cargo** baru pasti setelah ditimbang/packing: opsi bayar estimasi lalu disesuaikan, atau ongkir ditagih terpisah sebelum kirim. (Belum diputuskan final.)
- Ide **konsolidasi pengiriman**: gabung order beberapa pembeli, kirim berkala (mis. mingguan) agar ongkir per pembeli murah — penting karena nilai transaksi kecil.
- Aturan fee/deposit sourcing & refund harus tertulis jelas sejak awal (opsi yang dibahas: sourcing fee kecil yang dipotongkan ke invoice jika deal; deposit 20–30% untuk made to order). Belum final.

## 5a. Keranjang & pengiriman gabungan (diputuskan 2026-10-21)

- Pembeli bisa memasukkan produk dari **beberapa penjual** ke **satu keranjang** → **1 checkout, 1 pembayaran, 1 pengiriman gabungan** (ongkir dihitung sekali untuk paket gabungan setelah ditimbang).
- Di keranjang & order, item **dikelompokkan per penjual**. Tiap kelompok punya: **QC sendiri**, **biaya QC sendiri** (tarif zona lokasi penjual), **laporan QC & approval sendiri**, dan **chat bertiga sendiri** (buyer + penjual itu + admin).
- Dana diteruskan ke **masing-masing penjual** setelah barang sampai.
- **Tanpa fitur varian di MVP**: tiap item di keranjang punya kolom **"Note to seller"** (mis. "Size: 50 M, 50 L; color: navy"), detail dibahas di chat. Penjual juga bisa membuat listing terpisah untuk varian penting.
- Usulan aturan MVP — **DIKONFIRMASI owner 2026-10-21**:
  - Keranjang **hanya untuk ready stock**; made to order / pre-order & request lewat alur tawar-menawar (quotation).
  - **Pengiriman: pembeli memilih saat checkout** → (a) **"Ship together"**: tunggu semua kelompok lolos QC & di-approve, 1 ongkir; atau (b) **"Ship separately"**: tiap kelompok dikirim saat siap, ongkir per kiriman (lebih mahal). Default: ship together.
  - Jika QC satu penjual gagal → **BaliTrade mengutamakan solusi pengganti**: mencarikan barang pengganti/produk lain untuk kelompok itu. **Refund tetap tersedia** jika pembeli akhirnya memilih refund (kelompok itu saja; kelompok lain tetap jalan). Kebijakan ini harus tertulis jelas di ToS/FAQ sejak awal.
- **Note to seller & penjual boleh menolak** (DIKONFIRMASI): karena B2B/tawar-menawar, penjual bisa **accept / decline / propose change** atas item+note, **tanpa penalti rating** (beda dengan Shopee/Tokopedia).
- Pertanyaan terbuka: konfirmasi penjual terjadi **sebelum** pembayaran (usulan, agar penolakan tidak memicu refund) atau **sesudah** pembayaran (sesuai keputusan awal "bayar dulu")?
- **DIPUTUSKAN 2026-10-21: konfirmasi penjual SEBELUM pembayaran.** Alur keranjang (menggantikan "bayar dulu" untuk ready stock):
  1. Pembeli isi keranjang (ready stock, + note per item) → pilih Ship together/separately → isi alamat → **"Send order request"**.
  2. Tiap penjual merespons kelompoknya: **Accept / Decline / Propose change** (tanpa penalti rating). Admin ikut memantau.
  3. Pembeli meninjau: terima perubahan / hapus item yang ditolak / minta admin carikan pengganti.
  4. Setelah semua kelompok final → **pembeli membayar** (items + QC fee) → upload bukti → admin verifikasi.
  5. QC per penjual → approval pembeli per kelompok → kirim (together/separately) → sampai → dana ke tiap penjual.
  - Ongkir: di desain ditampilkan "dihitung setelah packing & penimbangan, ditagih sebelum pengiriman" (asumsi sementara; mekanisme ongkir di bagian 15 masih terbuka).
  - Batas waktu respons penjual: belum diputuskan (TBA).

## 6. QC

- QC **default** (bukan opsional) — menurut teman owner, pembeli justru suka ada QC karena ini soal **TRUST**.
- QC **dikenakan biaya**, karena lokasi penjual bisa jauh (mis. Karangasem) sementara tim di Canggu, Badung. Usulan: **tarif per zona** (Badung/Denpasar murah, Karangasem/Buleleng lebih mahal), transparan di checkout.

## 7. Diskusi / Chat

- **Semua chat wajib bertiga**: buyer + seller + admin. Dimulai sejak **bertanya di halaman produk** (sebelum beli), juga di order/request.
- **Tidak dianonimkan** (keputusan awal; anonimisasi dipertimbangkan nanti jika perlu). Pembeli **bisa melihat profil penjual** (trust); penjual **tidak bisa mencari/melihat profil pembeli**. Risiko bypass platform diterima untuk tahap awal.
- Chat mendukung **foto & video** (pengguna < 200, aman; perlu batas ukuran video).
- **Bahasa chat: wajib English** untuk buyer, seller, dan admin (lihat bagian 9).
- **Legalitas admin ikut chat**: legal jika transparan (UU PDP 27/2022) → sebut di ToS & Privacy Policy, checkbox persetujuan saat daftar, dan **banner di setiap chat**: "Admin BaliTrade ikut dalam percakapan ini untuk menjaga keamanan transaksi."
- Notifikasi **hanya di dalam app** (tidak ada integrasi WhatsApp/Telegram untuk saat ini).

## 8. Profil penjual

Tampilkan: lokasi (kabupaten), produk, rating/ulasan, jumlah transaksi, badge "Terverifikasi"/"QC passed". Jika belum ada penjualan/rating → **dikosongkan/empty state**.

## 9. Bahasa (i18n)

- 3 bahasa: **English (default)**, **Indonesia**, **Rusia**.
- UI (tombol, navbar, footer, tabs, warning, error, flow) → diterjemahkan di level frontend.
- Pilihan bahasa: disimpan di **localStorage** untuk guest; untuk user login juga disimpan di **profil** (ikut lintas perangkat).
- Konten dari penjual (deskripsi produk, dari DB) ditulis dalam bahasa Indonesia. Rekomendasi:
  - **Halaman produk**: terjemahan otomatis saat produk disimpan (EN & RU), label "Diterjemahkan otomatis · Lihat asli", admin bisa koreksi.
  - **Chat**: **wajib bahasa Inggris** untuk semua pihak (keputusan 2026-10-17), **tanpa fitur terjemahan**. Ada hint di kolom chat: "Please write in English so everyone can understand." Admin bisa membantu menjembatani jika ada penjual/pembeli yang kesulitan. (Fitur terjemahan bisa ditambah nanti jika ternyata dibutuhkan.)
  - Detail teknis dibahas saat arsitektur.

## 10. Harga & mata uang

- Harga ditampilkan dalam **USD**.
- Penjual input harga (pertanyaan terbuka: IDR atau USD). **Rekomendasi**: penjual input **IDR** (mereka berpikir & dibayar dalam IDR) → sistem tampilkan USD pakai **kurs harian + buffer kecil (±2–3%)** untuk risiko kurs → **harga USD dikunci saat checkout/quotation** (berlaku mis. 24 jam / sesuai masa berlaku quotation). Payout ke penjual tetap IDR sesuai harga listing. **Menunggu keputusan owner.**
- Sumber kurs **tidak harus berbayar**: kurs diambil **1× per hari** lalu disimpan (±30 request/bulan, masuk free tier). Opsi: API gratis (mis. Frankfurter — data ECB, tanpa API key, termasuk IDR; tidak update akhir pekan/libur), input manual admin, atau **gabungan (rekomendasi): API gratis harian + admin bisa override + buffer**. Cek ulang ketentuan free tier saat tahap arsitektur.

## 11. Pembayaran (tanpa integrasi otomatis di tahap awal)

Konteks: Rusia terkena sanksi perbankan internasional.

1. **Transfer bank Rupiah** (CIMB, BCA; Xendit jika memungkinkan — perlu dicek ke compliance Xendit/bank karena kemungkinan membatasi transaksi terkait Rusia). Kasus umum: orang Rusia yang tinggal di Bali dan punya rekening Indonesia transfer Rupiah→Rupiah (transfer domestik biasa).
   - Catatan risiko: jika pihak tersebut menerima Rubel dari pembeli di Rusia lalu membayar IDR ke kita, itu jasa transfer uang tanpa izin (risiko utama di dia, kita bisa terseret jika dana bermasalah). Mitigasi: invoice atas nama pembeli asli, catat siapa pentransfer & hubungannya, utamakan yang sudah dikenal/repeat order.
   - Bukti: **upload foto bukti transfer**, admin konfirmasi manual.
2. **USDT** ke wallet kami (manual). Owner sadar ini area berisiko (kripto bukan alat pembayaran sah di Indonesia) dan memilih tetap jalan untuk test market. Mitigasi: KYC sederhana pembeli, cek alamat wallet pengirim, cairkan rutin via exchange terdaftar OJK, jangan timbun saldo besar, catat invoice ↔ tx hash ↔ order.
   - Bukti: **foto + tx hash**, admin konfirmasi manual.
3. Exchange pihak ketiga untuk pembeli yang hanya punya Rubel — ide awal memecah transfer (mis. 10jt jadi 4× 2,5jt). **Sudah disarankan TIDAK dilakukan**: memecah transaksi = *structuring*, ditandai PPATK/bank sebagai indikasi pencucian uang → risiko pembekuan rekening. Owner tidak menyebut opsi ini lagi di diskusi lanjutan.

Rekomendasi umum: konsultasi ke konsultan hukum perdagangan internasional/compliance soal jalur pembayaran & escrow (menahan dana pihak lain bisa masuk ranah izin BI/OJK).

Keputusan tambahan (2026-10-17):
- **Jaringan USDT: TBA** (belum diputuskan). Di desain cukup tulis "USDT" tanpa nama jaringan.
- **Pembeli tidak wajib data perusahaan** (tidak ada field Company Tax ID / registrasi), karena kebanyakan pembeli perorangan.
- **Bandara/rute tujuan ditentukan BaliTrade**, bukan pembeli. Pembeli cukup mengisi **alamat pengiriman**.

## 12. Tracking (sederhana, update manual oleh admin)

Milestone: Order dikonfirmasi → QC selesai → Dikemas → Diserahkan ke cargo (**nomor AWB**) → Berangkat dari Bali → Tiba di bandara tujuan → Proses bea cukai → Diterima mitra lokal → Diterima pembeli.
Setiap langkah: tanggal, catatan, foto (opsional). Nomor AWB bisa ditautkan ke tracking maskapai.

## 13. Lain-lain yang perlu diingat

- Regulasi tujuan: Rusia, Kazakhstan, Belarus, Armenia, Kirgizstan = Uni Ekonomi Eurasia (sertifikasi EAC untuk banyak produk). Kopi butuh phytosanitary (Karantina).
- Incoterms (FOB/CIF/DAP) perlu ditetapkan agar jelas tanggung jawab risiko saat transit.
- Konflik kepentingan: owner juga penjual → perlu aturan transparan agar penjual lain tidak merasa dianaktirikan.

## 14. Desain UI (Google Stitch)

- **Keputusan (2026-10-17): Google Stitch = alat desain utama.** Google AI Studio sempat dicoba dengan prompt yang sama (hasilnya sudah dihapus dari repo), tidak dipakai sebagai acuan; mungkin dipakai nanti untuk prototipe interaktif alur rumit (chat, checkout). Alasan: revisi lewat chat & langsung terlihat, 1 file HTML mudah dibuka/dibagikan, tidak mengunci framework sebelum tahap arsitektur.
- Hasil Stitch disimpan di `design-ui/google-stitch/` (`01.html`, `02.html`, …).
- Target: **Web**, **mobile responsive**.
- Stitch lebih baik **satu halaman per prompt** → pakai satu blok **design system** yang ditempel di awal setiap prompt.
- Gaya: profesional B2B, warna umum jual-beli, ada nuansa Bali.
- Palet: Primary deep teal `#0F4C5C`, Accent warm gold `#C9A24A`, Secondary terracotta `#B5563A`, Background off-white `#FAF7F2`, Text charcoal `#1F2937`. Font: Plus Jakarta Sans. Ornamen motif Bali sangat tipis (hero & footer).
- Urutan halaman (disetujui):
  1. Design system
  2. Landing page
  3. Katalog/pencarian produk
  4. Detail produk (dengan chat bertiga sebelum beli)
  5. Profil penjual
  6. Form Request (sourcing)
  7. Checkout & upload bukti pembayaran
  8. Detail order (timeline, approval QC, tracking)
  9. Ruang chat
  10. Dashboard penjual (listing, status approval)
  11. Dashboard admin
  12. How It Works (penjelasan lengkap: alur, QC, pembayaran, FAQ lengkap) — ditambahkan 2026-10-21
- **Keputusan 2026-10-22:** desain Stitch berhenti di halaman 8 (detail order). Halaman 9 (chat), 10 (dashboard penjual), 11 (dashboard admin), 12 (How It Works) dibuat langsung saat implementasi. Setelah halaman 8 → masuk tahap arsitektur.
- Landing page dibuat **2 versi (lengkap & ringkas) untuk dibandingkan**, lalu dipilih satu. Usulan (belum diputuskan): pengunjung baru → landing; user yang sudah login → langsung katalog/order (seperti Tokopedia).
- **Keputusan 2026-10-21:** landing pakai **versi lengkap** (`02-lengkap.html`) sebagai acuan; versi ringkas dilewati. **Stitch tidak dipakai berlebihan**: desain = acuan alur & struktur; detail teks/visual disempurnakan saat implementasi (coding). Per halaman maksimal 1× revisi, hanya jika alur salah.
- Tahap pertama: design system + landing page + detail produk.

## 15. Keputusan terbuka (belum final)

- Input harga penjual: IDR (rekomendasi) vs USD.
- Mekanisme ongkir: estimasi + penyesuaian vs ditagih terpisah.
- Besaran sourcing fee / deposit / aturan refund.
- Masa inspeksi setelah barang tiba (usulan 3–7 hari).
- Tarif QC per zona. (T07: tabel `QcZone` sudah ada dengan **angka placeholder** — Badung/Denpasar $3, Gianyar/Tabanan $5, Klungkung/Bangli $6, Karangasem/Buleleng/Jembrana $8 — ganti setelah tarif diputuskan.)
- Daftar kategori terlarang.
- Jaringan USDT (TRC-20 / ERC-20 / lainnya).
- **Keranjang (cart) vs hanya "Buy now"** — DIPUTUSKAN 2026-10-21: pakai **cart, 1 checkout = 1 pengiriman gabungan**, QC & biaya QC **per penjual** (lihat bagian 5a).
- **Varian produk** — DIPUTUSKAN 2026-10-21: **tidak ada fitur varian di MVP**. Ukuran/warna dibahas lewat chat + kolom catatan per item di cart (lihat bagian 5a).
- Sub-keputusan cart: lihat bagian 5a (dikonfirmasi 2026-10-21; tersisa pertanyaan waktu konfirmasi penjual).
- **Reservasi stok** saat order request menunggu konfirmasi penjual (stok ditahan sementara atau tidak?) — muncul dari desain 7a.
- **Pengiriman sampai mana**: diantar ke alamat pembeli (door-to-door via mitra lokal) atau diambil pembeli di bandara/gudang mitra? — muncul dari desain 7a.
- **Isi tagihan ongkir**: hanya air freight, atau ditambah biaya dokumen ekspor (phytosanitary, COO, dll.) sebagai baris terpisah? — muncul dari desain 8.
- **Masa inspeksi** setelah barang tiba sebelum dana diteruskan otomatis jika pembeli tidak konfirmasi (usulan awal 3–7 hari).

## 16. Tahap teknis — jawaban owner & usulan (2026-10-22)

**Keputusan owner (2026-10-22):** MVP dibagi **1.0 (target 31 Okt 2026)** dan **1.1**; backend **NestJS**; **tanpa notifikasi email** (cukup in-app), email hanya untuk **lupa password via Resend** (sender "noreply", paket gratis). Detail teknis → `docs/ARCHITECTURE.md`.

Jawaban owner:
- Dikerjakan **sendiri dibantu AI**. Menguasai JS/TS: Next.js, React, Express. Sedang/akan belajar NestJS, Golang, PostgreSQL, Docker, Kubernetes, AWS (SAA/DVA) — project ini juga untuk portofolio cari kerja.
- Hosting: **VPS dev** via sumopod.com (Tencent, 2 GB RAM, 60 GB disk, ±Rp70rb/bln); **production** VPS ±$10 (Alibaba/Hostinger/dll). Terbiasa setup VPS Linux kosongan.
- Domain: sementara domain murah **.my.id**, pindah saat production → kode harus mudah pindah environment & terdokumentasi.
- Target: **MVP 1 selesai akhir Oktober 2026** (setelah itu fokus belajar).
- Login: **email + password** saja.
- Chat: ingin **realtime**.
- Media: **foto + video** (QC butuh video); storage **Cloudflare R2**.
- Bahasa: UI langsung **3 bahasa (EN default, ID, RU)**; konten produk dari penjual perlu solusi terjemahan.
- Admin: **2–5 orang** → perlu **role/RBAC** admin.
- Kurs: **API harian + validasi manual admin** (tidak full otomatis; pengalaman kurs Google pernah error).
- BaliTrade sebagai penjual = **akun penjual terpisah** ("BaliTrade Store"), beda dari akun admin.

Usulan teknis (belum dikonfirmasi):
- Stack: **Next.js (frontend) + NestJS (REST API + WebSocket gateway Socket.IO) + PostgreSQL + Prisma**, Docker Compose di VPS, reverse proxy Caddy (HTTPS otomatis). Golang & Kubernetes tidak dipakai di MVP.
- Realtime chat: Socket.IO di NestJS (bukan Firebase).
- Media: upload langsung dari browser ke R2 via presigned URL; bucket privat untuk bukti bayar.
- i18n UI: next-intl, file pesan en/id/ru, locale di URL + cookie (+ profil user).
- i18n konten: tabel terjemahan per produk (locale, title, description, is_auto); penjual menulis EN atau ID; terjemahan otomatis via API (mis. DeepL) dan **direview admin saat approval listing**.
- RBAC admin: role OWNER / FINANCE / OPERATIONS + audit log aksi admin.
- Kurs: API gratis harian → "suggested rate" → wajib dikonfirmasi admin; peringatan jika selisih besar; setiap order menyimpan snapshot kurs.
- Scope dibagi **MVP 1 (akhir Oktober)** dan **MVP 1.1** — lihat diskusi.
