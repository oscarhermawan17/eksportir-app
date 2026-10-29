# ARCHITECTURE — BaliTrade MVP

Dokumen teknis MVP. Konteks bisnis: `BRAINSTORMING.md`. Acuan desain: `UI_PROMPT.md` + `design-ui/google-stitch/` (sumber kebenaran visual: `01-v4.html`).

Status: disetujui garis besar 2026-10-22 (MVP 1.0 / 1.1, NestJS, tanpa email notifikasi). Detail di bawah = usulan awal, boleh disederhanakan saat coding.

## 1. Prinsip

- **Sederhana dulu.** Tujuan MVP: memindahkan transaksi dari WA/Telegram ke app yang terstruktur. Fitur yang terasa berlebihan saat coding → buang.
- **Mudah pindah environment.** Semua konfigurasi lewat `.env`; Docker Compose; langkah deploy terdokumentasi.
- **Uang = harus tercatat.** Verifikasi pembayaran, refund, pencairan ke penjual selalu menyimpan siapa & kapan (audit log).

## 2. Stack

| Bagian | Pilihan |
|---|---|
| Frontend | Next.js 16.4 (App Router, Turbopack) + React 19.3 + TypeScript 6.0 + Tailwind 4.3; i18n `next-intl` (en, id, ru) |
| Backend | NestJS 12.2 (ESM, Vitest, oxlint) + TypeScript 6.0 (REST API + WebSocket gateway Socket.IO) |
| Database | PostgreSQL 18 + Prisma 7.10 (driver adapter `@prisma/adapter-pg`, client di `src/generated/prisma`) |
| Storage media | Cloudflare R2 (S3-compatible), upload langsung via presigned URL |
| Email | Resend — hanya untuk lupa password (sender noreply) |
| Deploy | Build image di **GitHub Actions** → push ke GHCR → VPS menjalankan **Docker Compose**. Reverse proxy + HTTPS: **Caddy** (usulan, karena HTTPS otomatis) atau Nginx + Certbot jika owner lebih terbiasa |

Tidak dipakai di MVP: Golang, Kubernetes, Firebase, Xendit, layanan antrian (queue).

## 3. Struktur repo (monorepo, pnpm workspaces)

```
balitrade/
├── apps/
│   ├── web/          # Next.js
│   └── api/          # NestJS (+ prisma/schema.prisma)
├── packages/
│   └── shared/       # enum & tipe bersama (status order, role, dll.)
├── docker/
│   └── Caddyfile
├── docker-compose.yml        # dev: postgres
├── docker-compose.prod.yml   # prod: web, api, postgres, caddy
├── .env.example
└── docs/
    └── DEPLOY.md
```

Modul NestJS: `auth`, `users`, `sellers`, `products`, `media`, `chat` (gateway), `orders`, `payments`, `qc`, `shipping`, `fx`, `notifications`, `admin`, `audit`.

## 4. Role & RBAC

| Role | Bisa |
|---|---|
| BUYER | belanja, chat, bayar, approve QC, konfirmasi terima |
| SELLER | kelola listing, respons order (accept/decline/propose change), chat |
| ADMIN_OWNER | semua + kelola admin, konfirmasi kurs, catat pencairan ke penjual |
| ADMIN_FINANCE | verifikasi/tolak pembayaran, refund |
| ADMIN_OPS | approve penjual & listing (+ terjemahan), QC, tagihan ongkir, tracking, ikut semua chat |

- Satu user boleh punya beberapa role (kolom `roles` array). Cek akses via NestJS Guard + decorator `@Roles()`. Pola: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` (cocok bila salah satu role terpenuhi; tanpa token → 401, role kurang → 403). Role tidak otomatis mewarisi: ADMIN_OWNER harus disebut eksplisit di `@Roles()` (pakai `ADMIN_ROLES` dari `packages/shared` untuk "semua admin").
- Alur onboarding penjual (T07): daftar sebagai SELLER (atau user yang sudah ada mengajukan lewat `POST /sellers/apply`, yang menambah role SELLER) → `SellerProfile` PENDING → penjual melengkapi nama toko & lokasi di `/seller` → ADMIN_OPS/OWNER approve/reject di `/admin/sellers`. Approve butuh lokasi terisi. Reject wajib beralasan; penjual ditolak yang mengedit profilnya otomatis diajukan ulang (PENDING). Admin bisa mencabut persetujuan (reject dari APPROVED). Penjual APPROVED tidak bisa mengganti lokasi sendiri (menentukan biaya QC). Endpoint khusus penjual wajib memakai `@UseGuards(JwtAuthGuard, RolesGuard, ApprovedSellerGuard)` + `@Roles('SELLER')`.
- Pendaftaran publik boleh memilih BUYER atau SELLER, tetapi **role SELLER saja belum berarti boleh jualan**: hak jualan ditentukan oleh `SellerProfile.status = APPROVED`, yang hanya bisa diset admin (ADMIN_OPS/OWNER). Selama PENDING/REJECTED, seller tidak bisa membuat/submit listing (guard `ApprovedSellerGuard` di T07). Role admin tidak pernah bisa dipilih saat daftar; akun admin dibuat via seed (owner pertama) dan nanti oleh owner dari dashboard admin.
- "BaliTrade Store" (BaliTrade sebagai penjual) = **akun SELLER terpisah** dari akun admin.

## 5. Model data inti (MVP 1.0)

- **User**: email, passwordHash, name, phone, locale, roles[]
- **SellerProfile**: userId, displayName, about, status (PENDING / APPROVED / REJECTED), rejectionReason, reviewedBy/At, qcZoneId (= kabupaten/kota penjual; tidak ada kolom `regency` terpisah)
- **QcZone**: name (9 kabupaten/kota Bali, di-seed), feeUsd (`Decimal(12,2)`; **nilai seed = placeholder**, tarif asli belum diputuskan)
- **Product**: sellerId, type (READY_STOCK / MADE_TO_ORDER), category, unit, priceIdr, moq, stockQty, leadTimeDays, sourceLocale, status (DRAFT / PENDING_REVIEW / APPROVED / REJECTED / ARCHIVED)
- Aturan produk (T09): penjual APPROVED membuat produk (status DRAFT) → `submit` (butuh ≥1 foto) → PENDING_REVIEW. Mengedit produk APPROVED mengirimnya kembali ke PENDING_REVIEW; mengedit DRAFT/REJECTED tidak mengubah status (harus `submit` lagi). ARCHIVED tidak bisa diedit/diajukan, hanya dipulihkan ke DRAFT. Semua perubahan status lewat `nextStatus()` (`apps/api/src/products/product-status.ts`). `stockQty` hanya untuk READY_STOCK, `leadTimeDays` hanya untuk MADE_TO_ORDER. Harga disimpan IDR utuh (`Int`); penjual menulis dalam EN atau ID (`sourceLocale`), terjemahan lain ditambah admin di T10. Kategori & satuan = daftar tetap di `packages/shared/src/product.ts` (daftar kategori final & kategori terlarang masih keputusan terbuka).
- Review listing (T10): ADMIN_OPS/OWNER membuka antrean `/admin/products` (tanpa DRAFT), menulis/merapikan terjemahan en/id/ru secara manual (`PUT /admin/products/:id/translations`, `isAuto=false`), lalu approve atau reject (alasan wajib; penjual melihat alasannya, `submit` ulang menghapusnya). **Approve butuh teks en, id, dan ru terisi** dan hanya berlaku untuk PENDING_REVIEW. Katalog publik `GET /api/products?locale=` hanya menampilkan produk APPROVED milik penjual APPROVED; bila terjemahan bahasa itu tidak ada, jatuh ke bahasa penjual. Terjemahan bahasa lain tidak dihapus saat penjual mengedit (admin memeriksanya ulang saat review berikutnya).
- Katalog publik (T12, tanpa login): `GET /api/products?locale=&q=&category=&type=` (maks. 48 produk, terbaru dulu; belum ada pagination), `GET /api/products/:id?locale=` dan `GET /api/public/sellers/:id?locale=` (profil penjual: nama toko, deskripsi, kabupaten, bergabung sejak, produknya; tanpa email/kontak/rating). Hanya produk APPROVED milik penjual APPROVED; selain itu **404** (draft, penjual belum disetujui, id acak). Pencarian: tiap kata harus muncul (AND) di judul/deskripsi pada bahasa mana pun, tidak peka huruf besar-kecil; `%` dan `_` di-escape agar dicari apa adanya. Web: `/products` (filter di URL: `?q=&category=&type=`, bisa di-bookmark), `/products/[id]`, `/sellers/[id]`. Tombol "Request to order" / "Ask the seller & BaliTrade": tamu → `/login`; user login → nonaktif dengan keterangan "segera dibuka" sampai T13 (chat) dan T15 (order). Biaya QC belum ditampilkan di detail karena tarif zona masih placeholder.
- **ProductTranslation**: productId, locale (en/id/ru), title, description, isAuto
- **ProductMedia**: productId, r2Key, type (IMAGE / VIDEO), sort
- **ExchangeRate** (T11): rate `Decimal(12,4)` = IDR per 1 USD, setById, createdAt. Hanya-tambah (append-only): baris terbaru = kurs berlaku, baris lama = riwayat (siapa & kapan). MVP 1.1 menambah kolom `suggestedRate`/`source` untuk kurs dari API.
- **Order**: code (OR-xxxx), buyerId, sellerId (MVP 1.0: 1 penjual per order), status, deliveryAddress (json), fxRate (snapshot), itemsUsd, qcFeeUsd, shippingUsd, awbNumber
- **OrderItem**: orderId, productId, qty, unitPriceUsd (snapshot), note, sellerResponse (PENDING / ACCEPTED / DECLINED / CHANGE_PROPOSED), proposedQty
- **Payment**: orderId, kind (GOODS / SHIPPING), method (BANK_IDR / USDT), amountUsd, amountIdr, proofKey, txHash, senderName, status (SUBMITTED / VERIFIED / REJECTED), verifiedBy, verifiedAt
- **QcReport** (+ media): orderId, checklist (json), comment, status (READY / APPROVED / ISSUE), createdBy
- **TrackingEvent**: orderId, milestone, note, photoKey, createdBy, at
- **Conversation**: type (PRODUCT_INQUIRY / ORDER), productId?, orderId? · **Participant** · **Message** (body, attachments[])
- **Notification**: userId, type, payload, readAt
- **Payout**: orderId, sellerId, amountIdr, status, paidBy, paidAt (dicatat manual)
- **AuditLog**: actorId, action, entity, entityId, data

## 6. Alur status order (MVP 1.0)

```
REQUESTED ──seller──> ACCEPTED ─────────────┐
    │                CHANGE_PROPOSED ─buyer─┤ (terima perubahan)
    └──seller──> DECLINED (selesai)         │
                                            ▼
AWAITING_PAYMENT → PAYMENT_SUBMITTED → PAYMENT_VERIFIED (ditolak → AWAITING_PAYMENT)
→ IN_QC → QC_READY → QC_APPROVED (ISSUE → diselesaikan admin: pengganti / refund)
→ AWAITING_SHIPPING_PAYMENT → SHIPPING_PAID → SHIPPED → ARRIVED → COMPLETED
→ pencairan ke penjual dicatat (Payout)
Status lain: CANCELLED, REFUNDED
```

Setiap perubahan status → notifikasi in-app ke pihak terkait + pesan sistem di chat order.

## 7. Komponen teknis

- **Auth**: email + password (hash scrypt bawaan Node), JWT di cookie httpOnly `bt_session` (payload hanya `sub`; user & role dibaca ulang dari DB di setiap request; `sameSite=lax`, `secure` di production), rate limit login 5/menit & register 10/menit per IP (`@nestjs/throttler`, in-memory — pindah ke Redis bila API di-scale ke >1 instance). Register hanya boleh role BUYER/SELLER; role admin hanya via seed/owner. Logout = hapus cookie (JWT stateless, tidak ada revocation). Lupa password: token sekali pakai (disimpan hash, kedaluwarsa singkat) dikirim via Resend. Saat pindah domain production → verifikasi ulang domain di Resend.
- **Chat realtime**: Socket.IO gateway di NestJS; room per conversation; pesan juga disimpan di DB; lampiran via R2. Admin (ADMIN_OPS) otomatis jadi peserta semua conversation. Banner "Admin ikut dalam percakapan" + persetujuan saat daftar (UU PDP).
- **Media (R2)**: frontend minta presigned URL ke API → upload langsung ke R2 → simpan key. Batas: foto 10 MB, video 50 MB. Bukti pembayaran di bucket/prefix privat, dibuka via presigned GET berumur pendek.
  - Implementasi (T08): modul `media`. `POST /api/media/presign-upload {purpose, contentType, size}` → `{key, uploadUrl, headers, publicUrl}`; browser `PUT` ke `uploadUrl`. Tipe (JPG/PNG/WebP; MP4/WebM/MOV) dan ukuran persis ikut ditandatangani, jadi R2 menolak file lain. Ekstensi key berasal dari tipe, bukan nama file dari client.
  - **Dua bucket**: publik (`R2_PUBLIC_BUCKET`, foto/video produk, key `products/<userId>/<uuid>.<ext>`, dibaca lewat `R2_PUBLIC_BASE_URL`) dan privat (`R2_PRIVATE_BUCKET`, key `private/<userId>/<uuid>.<ext>`, dibaca lewat `GET /api/media/download-url?key=` → presigned GET 5 menit). Hanya pengunggah atau admin yang boleh membuka file privat; task bukti bayar/QC/chat (T13, T17, T18) menambah peserta order/percakapan.
  - `purpose`: `PRODUCT_MEDIA` (hanya seller APPROVED) dan `PRIVATE_FILE` (user login mana pun). Tanpa pengaturan R2 di development, endpoint menjawab 503 dan sisa aplikasi tetap jalan; di production semua pengaturan R2 wajib (aplikasi menolak start).
  - Komponen web `MediaUploader` dipakai ulang oleh form produk (T09); halaman uji `/{locale}/dev/upload` hanya ada saat development.

### Cloudflare R2 setup

1. Cloudflare dashboard → **R2** → buat 2 bucket, mis. `balitrade-public` dan `balitrade-private`.
2. Bucket publik → **Settings → Public access** → aktifkan `r2.dev subdomain` (cukup untuk dev/uji; production pakai custom domain). Salin URL `https://pub-xxxx.r2.dev` → `R2_PUBLIC_BASE_URL`.
3. **CORS** di kedua bucket (Settings → CORS policy), ganti origin saat production:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["Content-Type"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
   ```
4. R2 → **Manage API tokens** → buat token dengan izin **Object Read & Write** untuk kedua bucket → salin *Access Key ID* dan *Secret Access Key* (hanya tampil sekali). *Account ID* ada di halaman overview R2.
5. Isi `apps/api/.env`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` (jangan commit).
- **Web ↔ API auth**: browser memanggil API langsung (`NEXT_PUBLIC_API_URL`, default `http://localhost:4000/api`) dengan `credentials: 'include'`; sesi dibaca client lewat `GET /auth/me` di `AuthProvider`. Cookie berfungsi karena web dan API satu *site* (localhost; di production pakai subdomain dari domain yang sama, mis. `app.` dan `api.`). Checkbox persetujuan "admin ikut di semua chat" saat ini hanya wajib dicentang di form (belum disimpan di DB).
- **i18n UI**: `next-intl`, file `messages/en.json`, `id.json`, `ru.json`; locale di URL (`/en`, `/id`, `/ru`) + cookie + `User.locale`.
  - Implementasi (T06): rute `src/app/[locale]/...`, `src/proxy.ts` (next-intl; Next 16 memakai `proxy`, bukan `middleware`) mengarahkan `/` ke bahasa dari cookie `NEXT_LOCALE` → header Accept-Language → `en`. Link/redirect memakai `@/i18n/navigation`, bukan `next/link`.
  - Semua teks UI ada di `apps/web/messages/*.json` (3 file harus punya key yang sama). Pesan error API (selalu Inggris) dipetakan ke key `Auth.errors.*` lewat status HTTP — UI tidak menampilkan teks mentah dari API.
  - Language switcher di navbar & footer mengganti URL; bila login juga memanggil `PATCH /api/auth/me {locale}` → `User.locale`. Setelah login, user diarahkan ke bahasa tersimpan di akunnya. Daftar baru menyimpan bahasa halaman saat itu.
  - Teks terjemahan ID/RU di `messages` ditulis oleh AI — minta penutur asli untuk memeriksa sebelum rilis.
- **i18n konten produk**: penjual menulis EN atau ID (`sourceLocale`). MVP 1.0: admin mengisi/merapikan terjemahan saat approval listing. MVP 1.1: tombol/otomatis terjemah via API (mis. DeepL), `isAuto = true`, tetap direview admin. Fallback: tampilkan bahasa sumber + label.
- **Kurs**: MVP 1.0 admin input manual. MVP 1.1: job harian ambil kurs dari API gratis → `suggestedRate` → wajib dikonfirmasi ADMIN_OWNER; peringatan jika selisih > 3% dari kurs terakhir. Harga disimpan IDR, tampil USD; order menyimpan snapshot kurs.
  - Implementasi (T11): hanya `ADMIN_OWNER` yang mengisi kurs (`POST /api/admin/exchange-rates`, riwayat via `GET` yang sama; halaman `/admin/exchange-rate`). Batas wajar 1.000–100.000 IDR/USD (penangkap salah ketik, `FX_LIMITS` di `packages/shared`), maksimal 4 desimal. Kurs berlaku dibaca publik lewat `GET /api/fx/current`. Katalog publik menambah `priceUsd` = `priceIdr ÷ kurs`, dibulatkan half-up ke sen dengan aritmetika Decimal (`fx/fx-math.ts`), berupa string (`"6.80"`); `null` selama kurs belum diisi. Satu kurs dipakai untuk seluruh respons daftar. **Belum ada buffer kurs 2–3%** (keputusan terbuka, BRAINSTORMING §10): harga USD = kurs apa adanya.
- **Notifikasi**: in-app saja (tabel Notification + push via Socket.IO). Tanpa email/WA/Telegram.

## 8. Environment & deploy

- `.env.example` berisi semua variabel (DATABASE_URL, JWT_SECRET, R2_*, RESEND_API_KEY, APP_URL, dll.). Tidak ada secret di repo.
- Dev: VPS sumopod (2 GB) atau lokal; Postgres via Docker.
- Build image Docker di laptop/GitHub Actions (build Next.js di VPS 2 GB berisiko kehabisan RAM), VPS hanya menjalankan.
- Prod: `docker-compose.prod.yml` (web, api, postgres, caddy) di VPS ±$10; domain sementara `.my.id`.
- Backup: `pg_dump` harian ke R2.
- `docs/DEPLOY.md`: langkah setup VPS → deploy → pindah domain.

## 9. Scope

**MVP 1.0 (target 31 Okt 2026):** auth + role; penjual daftar & di-approve; listing + approval admin (+ terjemahan manual); katalog, detail produk, profil penjual sederhana; chat bertiga realtime + foto/video; order 1 penjual (request → respons penjual → bayar → verifikasi); QC report → approve; tagihan ongkir; tracking manual; konfirmasi terima; catat pencairan; kurs manual; UI 3 bahasa; lupa password.

**MVP 1.1:** keranjang multi-penjual + ship together/separately; form Request terstruktur (di 1.0 via chat); terjemahan otomatis; kurs dari API + konfirmasi; rating & ulasan; halaman How It Works; audit log lengkap.

## 10. Rencana kerja MVP 1.0 (23–31 Okt)

Daftar tugas rinci (dengan Definition of Done) ada di **`TASKS.md`**. Ringkasan per hari:

| Hari | Target |
|---|---|
| 23 Okt | Monorepo, Docker Postgres, skeleton Nest + Next, Prisma schema v1, register/login/logout, guard role |
| 24 Okt | Layout (navbar/footer, token design system), next-intl 3 bahasa, onboarding penjual + approval admin |
| 25 Okt | CRUD produk penjual, upload R2, approval listing + terjemahan manual |
| 26 Okt | Katalog, detail produk, profil penjual |
| 27 Okt | Chat realtime (gateway, conversation produk & order, lampiran) + notifikasi in-app |
| 28 Okt | Order request + respons penjual + respons pembeli; kurs manual |
| 29 Okt | Upload bukti bayar + verifikasi admin; laporan QC + approve pembeli |
| 30 Okt | Tagihan ongkir + bayar, tracking, konfirmasi terima, catat pencairan; lupa password (Resend) |
| 31 Okt | Deploy VPS (Caddy + domain), backup, uji alur end-to-end, README/DEPLOY |

Jadwal ini ketat. Yang belum selesai di 31 Okt otomatis pindah ke MVP 1.1 — prioritas utama: alur order end-to-end + chat.
