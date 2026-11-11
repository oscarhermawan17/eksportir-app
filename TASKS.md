# TASKS — BaliTrade MVP 1.0

Daftar tugas coding. Konteks: `docs/BRAINSTORMING.md` (bisnis), `docs/ARCHITECTURE.md` (teknis), `docs/DESIGN.md` (desain + catatan implementasi).

Cara pakai:
- Kerjakan berurutan. Satu sesi AI = satu atau beberapa task; centang `[x]` saat selesai **dan** sudah dicek (build/test jalan).
- Di sesi baru cukup bilang: **"Lanjutkan task berikutnya di TASKS.md"** (atau pakai skill `/next-task`).
- Target 31 Okt 2026 sudah lewat; pemilik setuju mundur (belum ada tanggal baru). Yang tidak mendesak pindah ke bagian **MVP 1.1**.
- Prioritas: alur order end-to-end (sampai pembayaran, QC, ongkir, pencairan) > yang lain.
- **Aturan:** selesai satu task → centang → commit (kode lalu dokumen, tanpa `Co-authored-by`) sebelum task berikutnya.

**Status singkat (2026-11-11):** 23 dari 29 task selesai (T01–T17, T13b, T16b, T16c, T17b, T22, T23). Environment testing **live** di https://projectbali.my.id (lihat `docs/DEPLOY.md`). Berikutnya: **T24 backup** (paling berharga — database sekotak dengan aplikasi), lalu T18 QC, T19–T21, T25. Rincian dan keadaan lingkungan dev ada di `AGENTS.md` bagian "Current status".

Legenda: **DoD** = Definition of Done (syarat task dianggap selesai).

---

## Fase 0 — Fondasi (23 Okt)

- [x] **T01 Monorepo** — pnpm workspaces: `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared`; TypeScript strict; ESLint (web) / oxlint (api, default NestJS 12) + Prettier; `.gitignore`, `.env.example`, `.nvmrc`.
  DoD: `pnpm dev` menjalankan web & api bersamaan; `pnpm lint` dan `pnpm build` lulus. ✅ 2026-10-23
- [x] **T02 Database lokal** — `docker-compose.yml` berisi PostgreSQL; Prisma di `apps/api`; schema v1 (User + role saja dulu); migrasi pertama; seed akun admin.
  DoD: `pnpm db:migrate` & `pnpm db:seed` jalan; tabel terlihat di DB. ✅ 2026-10-23 (+ `GET /api/health` & e2e test)
- [x] **T03 Auth API** — register, login, logout, me; hash password; JWT di cookie httpOnly; throttling login; DTO validation.
  DoD: test e2e register → login → me → logout lulus. ✅ 2026-10-23 (`test/auth.e2e-spec.ts`, 7 test)
- [x] **T04 RBAC** — enum role (BUYER, SELLER, ADMIN_OWNER, ADMIN_FINANCE, ADMIN_OPS) di `packages/shared`; `@Roles()` decorator + guard.
  DoD: endpoint contoh admin-only menolak buyer (403), menerima admin. ✅ 2026-10-23 (`GET /api/admin/ping`, `test/rbac.e2e-spec.ts`)

## Fase 1 — Kerangka UI & penjual (24 Okt)

- [x] **T05 Layout web** — token warna/font/radius dari design system `01-v4.html` ke Tailwind; navbar & footer standar (sesuai catatan implementasi); halaman login/daftar (+ checkbox persetujuan "admin ikut di semua chat").
  DoD: login/daftar dari web berfungsi; tampilan sesuai token. ✅ 2026-10-23 (diuji di browser headless: daftar → navbar tampil nama → reload tetap login → logout → login; teks masih hardcode English, dipindah ke next-intl di T06)
- [x] **T06 i18n UI** — next-intl, `/en` `/id` `/ru`, file messages, language switcher, simpan pilihan (cookie + `User.locale`).
  DoD: ganti bahasa mengubah semua teks navbar/footer/form auth. ✅ 2026-10-23 (diuji di browser: ganti EN→RU→ID, cookie `NEXT_LOCALE`, tersimpan ke akun via `PATCH /api/auth/me`, login mengarah ke bahasa akun)
- [x] **T07 Onboarding penjual** — user daftar sebagai penjual → SellerProfile (PENDING); admin melihat daftar & approve/reject; QcZone (seed 9 kabupaten + fee).
  Aturan: role SELLER dari pendaftaran publik hanya "calon penjual"; hak jualan = `SellerProfile.status = APPROVED` (guard `ApprovedSellerGuard`, hanya admin yang bisa approve). Pendaftar SELLER otomatis mendapat SellerProfile PENDING.
  DoD: penjual baru tidak bisa listing sebelum di-approve. ✅ 2026-10-23 (`test/sellers.e2e-spec.ts`, 11 test; UI: `/seller` dan `/admin/sellers` diuji di browser, 3 bahasa)

## Fase 2 — Produk (25–26 Okt)

- [x] **T08 Upload media R2** — endpoint presigned PUT (validasi tipe & ukuran: foto ≤10 MB, video ≤50 MB); presigned GET untuk file privat.
  DoD: upload foto & video dari web sampai ke R2 dan bisa ditampilkan.
  ✅ 2026-10-27: kode teruji (presign, aturan akses, batas ukuran/tipe, UI `/dev/upload`; unit + e2e lulus) dan diuji ke R2 asli dari browser: foto (.webp) dan video (MP4 19 MB) terunggah, foto tampil lewat URL `r2.dev`. Sementara satu bucket (`eksportir-testing`) dipakai untuk publik & privat; **pisahkan bucket privat sebelum ada data nyata** (bukti bayar, QC; T17+).
- [x] **T09 CRUD produk penjual** — form produk (type, kategori, unit, harga IDR, MOQ, stok/lead time, bahasa sumber EN/ID, judul & deskripsi, media); submit → PENDING_REVIEW.
  DoD: penjual bisa buat/edit/arsipkan produk. ✅ 2026-10-23 (`test/products.e2e-spec.ts` 9 test + unit transisi status; UI `/seller/products` diuji di browser; upload foto di form teruji ke R2 asli 2026-10-27 dan listing di-approve admin lewat UI)
- [x] **T10 Approval listing + terjemahan manual** — halaman admin: review produk, isi/rapikan terjemahan en/id/ru, approve/reject dengan alasan.
  DoD: hanya produk APPROVED tampil di katalog. ✅ 2026-10-23 (`test/admin-products.e2e-spec.ts` 8 test; UI `/admin/products` diuji di browser; daftar publik minimal `GET /api/products` sudah ada, T12 memperluasnya dengan pencarian, filter, detail & harga USD)
- [x] **T11 Kurs manual** — admin OWNER input kurs USD/IDR harian; harga tampil USD (IDR ÷ kurs, dibulatkan).
  DoD: ubah kurs → harga USD di katalog berubah; riwayat kurs tersimpan. ✅ 2026-10-27 (`test/fx.e2e-spec.ts` 5 test + `fx-math.spec.ts` 5 test; UI `/admin/exchange-rate` diuji di browser, 3 bahasa; `priceUsd` ada di `GET /api/products`, `null` sampai owner mengisi kurs pertama. Belum ada buffer kurs 2–3%, lihat DECISIONS)
- [x] **T12 Katalog & detail produk** — list + search + filter sederhana (kategori, tipe listing); detail produk (galeri, harga, MOQ, stok, label "Auto-translated/Original"); profil penjual sederhana.
  DoD: pengunjung bisa browse; tombol beli/tanya mengarah ke login jika belum login. ✅ 2026-10-29 (`test/catalog.e2e-spec.ts` 11 test; UI `/products`, `/products/[id]`, `/sellers/[id]` diuji di browser sebagai tamu dan user login, 3 bahasa. Tombol order/tanya untuk user login masih nonaktif sampai T13/T15. Tanpa pagination (maks. 48 produk) dan tanpa biaya QC di detail, lihat DECISIONS)

## Fase 3 — Chat (27 Okt)

- [x] **T13 Chat realtime** — Socket.IO gateway (auth via cookie), Conversation PRODUCT_INQUIRY & ORDER, peserta otomatis buyer + seller + admin, simpan pesan, lampiran via R2, banner admin, hint "write in English".
  DoD: 3 browser (buyer, seller, admin) saling menerima pesan tanpa refresh.
  Dipecah (2026-10-30): **langkah 1 selesai** — tabel `Conversation`/`Message` + REST `/api/conversations` (mulai dari produk, daftar, baca, kirim) dengan aturan akses dan 12 test e2e (`test/chat.e2e-spec.ts`). **Langkah 3 (UI) selesai dengan polling** — laci chat di detail produk (tombol "Ask the seller & BaliTrade" untuk pembeli), kotak masuk `/messages` (pembeli, penjual, admin melihat semua), banner admin, hint English, pesan baru muncul otomatis tiap 4 detik; diuji di browser dengan 3 peran + tampilan mobile. **Langkah 2 selesai (2026-10-31)** — Socket.IO gateway: pesan sampai seketika (±0,1 detik lokal, tanpa polling), otentikasi cookie + cek Origin, room hanya untuk peserta, batas 20 pesan/menit per user, 9 test e2e (`test/chat-realtime.e2e-spec.ts`) + uji browser 3 peran. ✅ 2026-10-31: DoD terpenuhi. Lampiran foto/video di chat dipindah ke MVP 1.1 (daftar di bawah); persetujuan "admin ikut chat" yang belum tersimpan di DB menjadi T13b.
- [x] **T13b Simpan persetujuan "admin ikut chat"** (ditambahkan 2026-10-31) — checkbox saat daftar saat ini hanya divalidasi di form; simpan waktu persetujuan di `User` (dan bukti versi teks) agar sesuai keterbukaan yang disebut di `docs/BRAINSTORMING.md` §7 (UU PDP).
  DoD: daftar tanpa centang ditolak oleh API (bukan hanya form); `consentedAt` tersimpan; teruji e2e. ✅ 2026-10-31 (`User.adminChatConsentAt` + `adminChatConsentVersion`; test di `auth.e2e-spec.ts`; form web diuji di browser: tanpa centang tidak terkirim, API menolak permintaan langsung tanpa persetujuan dengan 400). Akun lama dan akun seed tidak punya catatan persetujuan.
- [x] **T14 Notifikasi in-app** — tabel Notification, badge lonceng, push via socket, tandai dibaca.
  DoD: pesan/status baru memunculkan notifikasi ke pihak terkait. ✅ 2026-10-31 untuk **pesan chat** (`test/notifications.e2e-spec.ts` 14 test + 3 unit; UI lonceng di navbar diuji di browser: lencana muncul live tanpa reload, pesan beruntun digabung jadi satu dengan hitungan, klik membuka percakapan dan menandai dibaca, sinkron antar tab, tampilan mobile). Notifikasi **status order** ditambahkan oleh task order (T15 dst.) lewat jenis `NotificationType` baru; admin tidak menerima notifikasi chat (memakai kotak masuk).

## Fase 4 — Order (28–30 Okt)

- [x] **T15 Order request** — dari detail produk: qty + note → Order (REQUESTED, 1 penjual), snapshot harga & kurs, alamat pengiriman; chat order otomatis dibuat.
  DoD: order muncul di halaman pembeli, penjual, admin. ✅ 2026-11-02 (`test/orders.e2e-spec.ts` 19 test; UI diuji di browser sebagai pembeli, penjual dan admin: dialog pesan di detail produk dengan ringkasan harga, halaman `/orders` dan `/orders/[id]`, notifikasi live ke penjual, chat order dengan pesan sistem, alamat hanya untuk pembeli dan admin, tampilan mobile). Halaman admin sementara memakai `/orders` yang sama; layout admin terpisah ada di T17b. Biaya QC memakai tarif zona yang masih placeholder.
- [x] **T16 Respons penjual & pembeli** — penjual Accept / Decline / Propose change (qty); pembeli terima perubahan / batalkan → AWAITING_PAYMENT.
  DoD: semua transisi status sesuai ARCHITECTURE bagian 6; pesan sistem muncul di chat. ✅ 2026-11-02 (`src/orders/order-status.spec.ts` 7 unit test untuk aturan transisi; `test/order-actions.e2e-spec.ts` 15 test: peran 403/404, status salah 409, balapan dua jawaban, pesan sistem, notifikasi; UI diuji di browser: panel jawab penjual, usulan perubahan dan totalnya, pembeli menerima atau membatalkan, penolakan dengan alasan di chat, halaman yang sudah basi, admin tanpa aksi, mobile). Transisi pembayaran, QC dan pengiriman ditambahkan task-nya masing-masing. Belum ada batas waktu jawab penjual dan stok tidak ditahan (keputusan terbuka).
- [x] **T16b Navbar & halaman depan sederhana** (ditambahkan 2026-11-06 atas permintaan pemilik) — navbar lama memuat sampai 9 tautan teks dan pecah jadi 2–3 baris untuk admin dan di bahasa Rusia. Navbar baru: logo + kolom pencarian + language switcher + lonceng + avatar bulat; semua halaman pribadi dan admin pindah ke menu avatar, jadi tidak ada tautan teks permanen. Halaman depan `/` menjadi katalog (chip kategori, filter tipe, grid); `/products` dihapus (`/products/[id]` tetap). Bagian penjelasan pindah ke halaman baru `/how-it-works` (cara kerja, kartu kepercayaan, metode bayar, pengiriman, FAQ, ajakan jadi penjual) yang sekaligus menutup 3 tautan footer yang tadinya 404.
  DoD: navbar satu baris di 3 bahasa dan semua peran; `/` menampilkan katalog; `/how-it-works` memuat bagian yang dipindah; lint/typecheck/build/test lulus. ✅ 2026-11-06 (diuji di Chrome: navbar tamu dan admin, menu avatar, chip kategori, pencarian dari navbar `/?q=`, `/en/products` → 404, `/products/[id]` tetap 200, 3 bahasa; lebar ponsel diuji dengan emulasi viewport: header jadi 2 baris, satu kolom pencarian, tanpa luberan horizontal). Tautan "Request a Product" dihapus dari navbar (halamannya MVP 1.1).

- [x] **T16c Halaman depan per peran** (ditambahkan 2026-11-06 atas permintaan pemilik) — login selalu mendarat di `/` (katalog pembeli), padahal penjual dan admin tidak membeli. `homePathFor()` menentukan per peran: penjual → `/seller`, admin → area admin (T17b menggantinya dengan `/admin`), pembeli → `/`; logo mengikuti aturan yang sama, dan penjual/admin mendapat "Lihat toko" di menu avatar. `/seller` menjadi dasbor (status penjual, pesanan menunggu jawaban, produk tayang, produk menunggu ditinjau/menunggu penjual, tombol tambah & kelola produk); formulir akun penjual pindah ke `/seller/account`. Menu avatar akun admin tidak lagi menampilkan "Pesanan saya" dan "Jual di BaliTrade" — akun admin khusus admin; daftar pesanan pindah ke grup Admin (sekaligus memperbaiki admin FINANCE yang tadinya tidak punya tautan ke pesanan).
  DoD: tiap peran mendarat di tempat kerjanya; dasbor penjual menampilkan angka yang benar; menu admin bersih dari item pembeli/penjual; lint/typecheck/build/test lulus. ✅ 2026-11-06 (diuji di Chrome dengan akun penjual uji sementara yang dibuat lalu dihapus: login penjual mendarat di dasbor dengan angka 0 / 1 / 2 yang cocok dengan datanya, cabang PENDING menampilkan status + tautan akun tanpa kartu angka, menu avatar penjual benar; login admin mendarat di `/admin/sellers` dan menunya hanya Pesan · Lihat toko · grup Admin · Keluar).

- [x] **T17 Pembayaran barang** — halaman bayar dengan **3 metode** (diputuskan 2026-10-30): `BANK_IDR` (transfer ke rekening BCA, nominal IDR dari kurs terkunci), `USDT` (nominal + alamat wallet Binance dari config; jaringan menunggu keputusan owner) dan `EXCHANGE` (pembeli yang hanya punya rubel membayar ke exchange mitra di Indonesia, yang mengirim rupiah ke BaliTrade secara manual); detail rekening/wallet/petunjuk exchange dari config. Upload bukti, nama pengirim / tx hash / nama exchange + referensi; admin FINANCE verifikasi/tolak (+ audit log).
  Aturan yang diputuskan 2026-11-08 (rincian + alasan di `docs/BRAINSTORMING.md` §11): data BCA & alamat wallet Binance di development memakai **nilai mock dari config** (jaringan USDT masih TBA), **nominal rubel tidak ditampilkan** (UI tetap USD, exchange yang mengurus), **pembayaran sebagian diterima** dan dicatat **per percobaan — bukti lama tidak pernah diganti** (satu order punya banyak `Payment`; pembeli boleh berpindah metode selama belum diverifikasi), dan `PAYMENT_VERIFIED` adalah **penilaian admin FINANCE**, bukan rumus. **Bucket R2 privat terpisah termasuk dalam task ini** (bukti bayar memuat nomor rekening; bucket sekarang publik). **Tidak ada fitur pemecah pembayaran** untuk sekarang — uang EXCHANGE tidak pernah melewati BaliTrade, dan pembayaran bertahap ke exchange (alasan keamanan terhadap pihak exchange, lihat `BRAINSTORMING.md` §11) sudah otomatis terlihat sebagai beberapa baris `Payment`.
  DoD: verifikasi → PAYMENT_VERIFIED → IN_QC. ✅ 2026-11-10 (`test/payments.e2e-spec.ts` 18 test + 4 unit test transisi; UI diuji di Chrome dengan **akun ADMIN_FINANCE dan ADMIN_OPS terpisah** yang dibuat lalu dihapus: pembeli membayar sebagian lewat transfer bank, FINANCE memverifikasi, pembeli membayar sisanya lewat exchange, FINANCE memverifikasi lalu menekan "Pembayaran sudah cukup" → `PAYMENT_VERIFIED`, OPS menekan "Mulai pemeriksaan kualitas" → `IN_QC`; $206,91 + $206,93 = $413,84 tepat pada kurs terkunci pesanan, bukti benar-benar terunggah ke R2 dan terambil kembali lewat URL bertanda tangan, 7 pesan sistem di chat pesanan, 3 bahasa, lebar 375px tanpa luberan). Verifikasi satu pembayaran **tidak** memindahkan pesanan — tombol "Pembayaran sudah cukup" yang melakukannya, karena pembayaran sebagian diterima. Mulai QC adalah langkah OPS tersendiri, bukan otomatis, supaya data tidak mengaku "sedang QC" sebelum barangnya ada.
  **Belum teruji dengan rekening sungguhan**: data BCA/Binance/exchange masih mock dan bucket R2 privat belum dipisah dari yang publik; keduanya hanya perubahan `.env`.
  Dua bug ditemukan saat menguji peran terpisah dan langsung diperbaiki: Ringkasan admin menampilkan "Kurs belum diisi" kepada admin non-OWNER (ia membaca riwayat kurs yang khusus OWNER; sekarang membaca `/fx/current` yang publik), dan panel pembayaran menampilkan tombol lintas peran (sekarang tombol uang hanya FINANCE/OWNER, tombol QC hanya OPS/OWNER).
- [x] **T17b Layout admin terpisah** (ditambahkan 2026-10-30; **dikerjakan sebelum T17**, karena T17 terblokir menunggu data pemilik sedangkan task ini tidak bergantung apa pun) — area `/admin` memakai layout sendiri: sidebar kiri teal gelap 240px + top bar polos (judul halaman, language switcher, ikon pesan, avatar), tanpa navbar/footer toko dan **tanpa pencarian produk**. Chrome dipisah lewat route group: `[locale]/layout.tsx` hanya dokumen/terjemahan/sesi, `(shop)` memegang navbar+footer, `(admin)` memegang sidebar; URL tidak berubah. Menu mengikuti peran; halaman **Ringkasan** baru menghitung pekerjaan yang menunggu; pesanan tetap di dalam layout admin lewat `/admin/orders` (memakai ulang komponen toko dengan prop `basePath`). `homePathFor()` mengarahkan semua peran admin ke `/admin`, dan menu avatar admin menyusut jadi satu entri "Area admin". Halaman pembayaran dari T17 tinggal ditambahkan ke sidebar.
  DoD: semua halaman admin tampil di layout baru; menu hanya menampilkan halaman yang boleh diakses perannya; di layar kecil sidebar menjadi laci; lint/typecheck/build lulus dan diuji di browser. ✅ 2026-11-06 (diuji di Chrome sebagai ADMIN_OWNER: Ringkasan, Penjual, Listing, Pesanan, Kurs tampil di layout baru dengan penanda menu aktif yang ikut berpindah, dalam 3 bahasa (en/id/ru); lebar 375px diuji dengan emulasi viewport: sidebar tersembunyi, tombol menu muncul, laci 240px memuat kelima menu, tanpa luberan horizontal, tertutup oleh Escape. **Belum teruji dengan akun ADMIN_OPS dan ADMIN_FINANCE terpisah** — dev hanya punya satu akun admin yang memegang ketiga peran; aturan menunya ada di `navItemsFor()` dan Ringkasan menyembunyikan kartu yang perannya tidak boleh baca.)
  Sisa: ikon ✉ di top bar masih membuka `/messages` dengan tampilan toko; memindahkannya butuh perlakuan yang sama seperti pesanan.
- [ ] **T18 QC** — admin OPS upload laporan QC (foto/video, checklist, komentar) → QC_READY; pembeli Approve atau Report problem (→ ISSUE, diselesaikan lewat chat/admin).
  DoD: approve → AWAITING_SHIPPING_PAYMENT.
- [ ] **T19 Ongkir & tracking** — admin buat tagihan ongkir (berat, jumlah karton, nominal); pembeli bayar (3 metode yang sama dengan T17) & upload bukti; admin verifikasi; admin tambah TrackingEvent (milestone, catatan, foto, AWB).
  DoD: timeline tracking tampil di halaman order pembeli.
- [ ] **T20 Selesai & pencairan** — pembeli "Confirm received" → COMPLETED; admin OWNER catat Payout ke penjual (+ audit log).
  DoD: satu order bisa dijalankan dari REQUESTED sampai COMPLETED.
- [ ] **T21 Lupa password** — Resend (noreply), token sekali pakai berkedaluwarsa.
  DoD: reset password berhasil via email.

## Fase 5 — Rilis (31 Okt)

- [x] **T22 CI + image** (diputuskan 2026-10-31: **CI otomatis, CD manual**) — GitHub Actions: lint + typecheck + test (+ e2e dengan service Postgres) + build → build image Docker web & api → push ke GHCR. Image web dibangun dengan `NEXT_PUBLIC_API_URL` alamat API produksi (nilai itu ditanam saat build). **Deploy dilakukan manual** lewat SSH: `docker compose pull` (menarik image dari GHCR) lalu `docker compose up -d`.
  **DoD diperbarui 2026-11-11** agar cocok dengan keputusan "CI otomatis, CD manual" (DoD lama menyebut deploy otomatis, yang bertentangan):
  push ke `main` menjalankan lint/typecheck/test/e2e dan mendorong image web & api ke GHCR; deploy tetap dijalankan pemilik lewat SSH.
  ✅ 2026-11-11 (run #4 hijau seluruhnya; kedua image terdorong ke GHCR dan berhasil ditarik serta dijalankan di VPS).
  **Tiga run pertama gagal, semuanya karena hal yang sama:** checkout bersih tidak punya `packages/shared/dist`, klien Prisma, maupun `.next`,
  dan `pnpm install` tidak membuat satu pun. Sekarang ada `pnpm codegen`, dan `build`/`typecheck`/`test` memanggilnya. Run ketiga gagal karena
  `R2_*` dipasang di level job sehingga merusak unit test yang justru menguji kondisi "R2 belum dikonfigurasi" — variabel itu kini hanya ada di
  langkah e2e, dan test-nya memakai stub alih-alih `ConfigService` asli yang jatuh ke `process.env`.
  Rinciannya: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.github/workflows/ci.yml`,
  `.dockerignore`, `output: 'standalone'` di `next.config.ts`, dan `scripts/check-messages.py` (pemeriksa paritas kunci terjemahan yang selama ini
  ad-hoc). Kedua image **dibangun dan dijalankan lokal sampai terbukti**: API menjawab `/api/health` `{"status":"ok","database":"up"}`, web
  menyajikan `/id`, `/en/how-it-works`, `/id/admin`, dan container web berhasil mengambil 14 produk dari container API. Ukuran image 440 MB (api)
  dan 315 MB (web) setelah install difilter per app — tanpa filter, image api ikut membawa Next.js dan React dan membengkak jadi 966 MB.
  Belum terverifikasi: jalannya workflow di GitHub Actions dan push ke GHCR. **Sebelum push pertama**, set repository variable `NEXT_PUBLIC_API_URL`
  (Settings → Secrets and variables → Actions → Variables); tanpa itu job image sengaja gagal dengan pesan yang jelas, karena alamat API ditanam
  ke dalam bundel saat build.
- [x] **T23 Deploy VPS** — VPS Ubuntu 22.04/24.04; `docker-compose.prod.yml` (web, api, Caddy + HTTPS) dan **PostgreSQL dipasang manual di VPS (bukan kontainer)**: kontainer API menyambung ke Postgres host (`host.docker.internal` / gateway Docker), Postgres hanya mendengarkan localhost dan jaringan Docker, tidak terbuka ke internet. Web dan API di subdomain satu domain (mis. `app.` dan `api.`, wajib agar cookie dan chat jalan), domain `.my.id`, migrasi `prisma migrate deploy` dijalankan manual saat deploy. Backup dan administrasi database lewat `psql` / `pg_dump` langsung di host.
  Ditegaskan 2026-11-10 (alasan lengkap di `docs/DECISIONS.md` dan `ARCHITECTURE.md` §8): **satu VPS untuk semuanya, database ikut di dalamnya**;
  Supabase/Neon ditunda sampai ada uang sungguhan. **VPS di Singapura**, **tanpa Vercel** (web ikut di VPS). **Swap 2 GB dibuat sejak awal.**
  **Migrasi dijalankan dari VPS, bukan dari laptop** — banyak ISP rumah di Indonesia memblokir port keluar 5432; untuk melihat data produksi pakai
  `ssh` lalu `psql` di sana.
  Belum diputuskan: `NEXT_PUBLIC_API_URL` ditanam saat build, jadi image web testing **tidak bisa** dipakai ulang untuk produksi. Pilih salah satu saat
  mengerjakan task ini — (a) satu image per environment, atau (b) Caddy mem-proxy API di domain yang sama pada path `/api` sehingga URL jadi relatif,
  satu image jalan di mana saja dan cookie menjadi same-origin (konsekuensinya rencana `app.`+`api.` berubah).
  Sudah tertulis duluan saat T22 (belum pernah dijalankan di VPS sungguhan): `docker-compose.prod.yml`, `Caddyfile`, `.env.prod.example`.
  DoD: app bisa diakses via HTTPS di domain; swap aktif; `docker image prune` tercatat di `DEPLOY.md` sebagai perawatan rutin.
  ✅ 2026-11-11 — **https://projectbali.my.id** (web, 3 bahasa 200) dan **https://api.projectbali.my.id/api/health** (`database: up`).
  Berbeda dari rencana: **nginx, bukan Caddy** (VPS sudah menjalankan nginx untuk proyek lain di port 80/443), nginx dipindah ke
  `/home/ubuntu/infra` sebagai infrastruktur bersama dengan jaringan `edge`, dan PostgreSQL 16 host dijangkau lewat gateway Docker
  (`listen_addresses` + `pg_hba` + aturan ufw — tanpa yang terakhir koneksi **timeout**, bukan ditolak). Swap sudah aktif dari awal.
  Seluruh cara kerjanya ada di **`docs/DEPLOY.md`**. Sisa: bucket R2 privat belum dipisah, dan `pg_dump` terjadwal masuk T24.
- [ ] **T24 Backup & dokumentasi** — `pg_dump` harian ke R2; `docs/DEPLOY.md` (setup VPS, env, deploy, pindah domain, restore backup); README.
  **Prioritasnya naik sejak keputusan 2026-11-10**: selama database tinggal di VPS yang sama dengan aplikasi, ini **satu-satunya** jaring pengaman
  terhadap kehilangan catatan pesanan dan bukti pembayaran. DoD-nya tidak boleh dilonggarkan — backup yang belum pernah di-restore bukan backup.
  Tambahkan juga pemantauan sederhana: RAM, disk, dan apakah backup semalam benar-benar jadi.
  DoD: restore backup ke DB kosong berhasil dicoba sekali.
- [ ] **T25 Uji end-to-end** — jalankan alur lengkap dengan 3 akun (buyer, seller, admin) di 3 bahasa; catat bug.
  DoD: tidak ada bug penghalang (blocker) di alur utama.

---

## MVP 1.1 (setelah 31 Okt)

- [ ] Lampiran foto/video di chat (unggah ke bucket privat R2, izin baca untuk peserta percakapan)
- [ ] Keranjang multi-penjual (dikelompokkan per penjual) + Ship together / Ship separately
- [ ] Form Request terstruktur + quotation
- [ ] Terjemahan otomatis konten produk (API, mis. DeepL) + review admin
- [ ] Kurs dari API harian + konfirmasi admin + peringatan selisih > 3%
- [ ] Rating & ulasan per penjual
- [ ] Halaman How It Works + FAQ lengkap
- [ ] Audit log lengkap + halaman riwayat aksi admin
- [ ] (pindahan dari MVP 1.0 jika tidak sempat)
