# TASKS — BaliTrade MVP 1.0

Daftar tugas coding. Konteks: `BRAINSTORMING.md` (bisnis), `ARCHITECTURE.md` (teknis), `UI_PROMPT.md` (desain + catatan implementasi).

Cara pakai:
- Kerjakan berurutan. Satu sesi AI = satu atau beberapa task; centang `[x]` saat selesai **dan** sudah dicek (build/test jalan).
- Di sesi baru cukup bilang: **"Lanjutkan task berikutnya di TASKS.md"** (atau pakai skill `/next-task`).
- Task yang tidak selesai sampai 31 Okt → pindah ke bagian **MVP 1.1**.
- Prioritas jika waktu mepet: alur order end-to-end + chat > yang lain.

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

- [ ] **T13 Chat realtime** — Socket.IO gateway (auth via cookie), Conversation PRODUCT_INQUIRY & ORDER, peserta otomatis buyer + seller + admin, simpan pesan, lampiran via R2, banner admin, hint "write in English".
  DoD: 3 browser (buyer, seller, admin) saling menerima pesan tanpa refresh.
- [ ] **T14 Notifikasi in-app** — tabel Notification, badge lonceng, push via socket, tandai dibaca.
  DoD: pesan/status baru memunculkan notifikasi ke pihak terkait.

## Fase 4 — Order (28–30 Okt)

- [ ] **T15 Order request** — dari detail produk: qty + note → Order (REQUESTED, 1 penjual), snapshot harga & kurs, alamat pengiriman; chat order otomatis dibuat.
  DoD: order muncul di halaman pembeli, penjual, admin.
- [ ] **T16 Respons penjual & pembeli** — penjual Accept / Decline / Propose change (qty); pembeli terima perubahan / batalkan → AWAITING_PAYMENT.
  DoD: semua transisi status sesuai ARCHITECTURE bagian 6; pesan sistem muncul di chat.
- [ ] **T17 Pembayaran barang** — halaman bayar (IDR: nominal IDR dari kurs terkunci + placeholder rekening dari config; USDT: nominal + wallet dari config), upload bukti, sender name/tx hash; admin FINANCE verifikasi/tolak (+ audit log).
  DoD: verifikasi → PAYMENT_VERIFIED → IN_QC.
- [ ] **T18 QC** — admin OPS upload laporan QC (foto/video, checklist, komentar) → QC_READY; pembeli Approve atau Report problem (→ ISSUE, diselesaikan lewat chat/admin).
  DoD: approve → AWAITING_SHIPPING_PAYMENT.
- [ ] **T19 Ongkir & tracking** — admin buat tagihan ongkir (berat, jumlah karton, nominal); pembeli bayar & upload bukti; admin verifikasi; admin tambah TrackingEvent (milestone, catatan, foto, AWB).
  DoD: timeline tracking tampil di halaman order pembeli.
- [ ] **T20 Selesai & pencairan** — pembeli "Confirm received" → COMPLETED; admin OWNER catat Payout ke penjual (+ audit log).
  DoD: satu order bisa dijalankan dari REQUESTED sampai COMPLETED.
- [ ] **T21 Lupa password** — Resend (noreply), token sekali pakai berkedaluwarsa.
  DoD: reset password berhasil via email.

## Fase 5 — Rilis (31 Okt)

- [ ] **T22 CI/CD** — GitHub Actions: lint + build → build image Docker web & api → push ke GHCR; VPS `docker compose pull && up -d`.
  DoD: push ke branch main men-deploy versi baru ke VPS dev.
- [ ] **T23 Deploy VPS** — `docker-compose.prod.yml` (web, api, postgres, reverse proxy + HTTPS), domain `.my.id`, migrasi otomatis saat deploy.
  DoD: app bisa diakses via HTTPS di domain.
- [ ] **T24 Backup & dokumentasi** — `pg_dump` harian ke R2; `docs/DEPLOY.md` (setup VPS, env, deploy, pindah domain, restore backup); README.
  DoD: restore backup ke DB kosong berhasil dicoba sekali.
- [ ] **T25 Uji end-to-end** — jalankan alur lengkap dengan 3 akun (buyer, seller, admin) di 3 bahasa; catat bug.
  DoD: tidak ada bug penghalang (blocker) di alur utama.

---

## MVP 1.1 (setelah 31 Okt)

- [ ] Keranjang multi-penjual (dikelompokkan per penjual) + Ship together / Ship separately
- [ ] Form Request terstruktur + quotation
- [ ] Terjemahan otomatis konten produk (API, mis. DeepL) + review admin
- [ ] Kurs dari API harian + konfirmasi admin + peringatan selisih > 3%
- [ ] Rating & ulasan per penjual
- [ ] Halaman How It Works + FAQ lengkap
- [ ] Audit log lengkap + halaman riwayat aksi admin
- [ ] (pindahan dari MVP 1.0 jika tidak sempat)
