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
| Frontend | Next.js (App Router) + TypeScript + Tailwind; i18n `next-intl` (en, id, ru) |
| Backend | NestJS + TypeScript (REST API + WebSocket gateway Socket.IO) |
| Database | PostgreSQL + Prisma (migrasi) |
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

- Satu user boleh punya beberapa role (kolom `roles` array). Cek akses via NestJS Guard + decorator `@Roles()`.
- "BaliTrade Store" (BaliTrade sebagai penjual) = **akun SELLER terpisah** dari akun admin.

## 5. Model data inti (MVP 1.0)

- **User**: email, passwordHash, name, phone, locale, roles[]
- **SellerProfile**: userId, displayName, regency, about, status (PENDING / APPROVED / REJECTED), qcZoneId
- **QcZone**: name (mis. Badung, Gianyar), feeUsd
- **Product**: sellerId, type (READY_STOCK / MADE_TO_ORDER), category, unit, priceIdr, moq, stockQty, leadTimeDays, sourceLocale, status (DRAFT / PENDING_REVIEW / APPROVED / REJECTED / ARCHIVED)
- **ProductTranslation**: productId, locale (en/id/ru), title, description, isAuto
- **ProductMedia**: productId, r2Key, type (IMAGE / VIDEO), sort
- **ExchangeRate**: date, suggestedRate, confirmedRate, confirmedBy, source
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

- **Auth**: email + password (hash argon2/bcrypt), JWT di cookie httpOnly, rate limit login (`@nestjs/throttler`). Lupa password: token sekali pakai (disimpan hash, kedaluwarsa singkat) dikirim via Resend. Saat pindah domain production → verifikasi ulang domain di Resend.
- **Chat realtime**: Socket.IO gateway di NestJS; room per conversation; pesan juga disimpan di DB; lampiran via R2. Admin (ADMIN_OPS) otomatis jadi peserta semua conversation. Banner "Admin ikut dalam percakapan" + persetujuan saat daftar (UU PDP).
- **Media (R2)**: frontend minta presigned URL ke API → upload langsung ke R2 → simpan key. Batas: foto 10 MB, video 50 MB. Bukti pembayaran di bucket/prefix privat, dibuka via presigned GET berumur pendek.
- **i18n UI**: `next-intl`, file `messages/en.json`, `id.json`, `ru.json`; locale di URL (`/en`, `/id`, `/ru`) + cookie + `User.locale`.
- **i18n konten produk**: penjual menulis EN atau ID (`sourceLocale`). MVP 1.0: admin mengisi/merapikan terjemahan saat approval listing. MVP 1.1: tombol/otomatis terjemah via API (mis. DeepL), `isAuto = true`, tetap direview admin. Fallback: tampilkan bahasa sumber + label.
- **Kurs**: MVP 1.0 admin input manual. MVP 1.1: job harian ambil kurs dari API gratis → `suggestedRate` → wajib dikonfirmasi ADMIN_OWNER; peringatan jika selisih > 3% dari kurs terakhir. Harga disimpan IDR, tampil USD; order menyimpan snapshot kurs.
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
