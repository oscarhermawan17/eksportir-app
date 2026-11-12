# ARCHITECTURE — BaliTrade MVP

Dokumen teknis MVP. Konteks bisnis: `docs/BRAINSTORMING.md`. Acuan desain: `docs/DESIGN.md` + `design-ui/google-stitch/` (sumber kebenaran visual: `01-v4.html`).

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
- **Product**: sellerId, type (READY_STOCK / MADE_TO_ORDER), categorySlug, unit, priceIdr, moq, stockQty, leadTimeDays, sourceLocale, status (DRAFT / PENDING_REVIEW / APPROVED / REJECTED / ARCHIVED)
- **ProductCategory** (T26): slug (kunci stabil, dipakai `Product.categorySlug`), nameEn/nameId/nameRu, active, archivedAt, sortOrder.
  Dikelola OWNER di `/admin/categories`. Kolom `products.category` tidak berubah nama saat kategori jadi data — foreign key-nya ke `slug`,
  `ON DELETE RESTRICT`, jadi tidak ada satu baris produk pun yang dipindah dan hard delete mustahil selama masih dipakai.
- Aturan produk (T09): penjual APPROVED membuat produk (status DRAFT) → `submit` (butuh ≥1 foto) → PENDING_REVIEW. Mengedit produk APPROVED mengirimnya kembali ke PENDING_REVIEW; mengedit DRAFT/REJECTED tidak mengubah status (harus `submit` lagi). ARCHIVED tidak bisa diedit/diajukan, hanya dipulihkan ke DRAFT. Semua perubahan status lewat `nextStatus()` (`apps/api/src/products/product-status.ts`). `stockQty` hanya untuk READY_STOCK, `leadTimeDays` hanya untuk MADE_TO_ORDER. Harga disimpan IDR utuh (`Int`); penjual menulis dalam EN atau ID (`sourceLocale`), terjemahan lain ditambah admin di T10. Satuan = daftar tetap di `packages/shared/src/product.ts`.
  **Kategori = data sejak T26**, bukan konstanta: tabel `ProductCategory`, dikelola OWNER di `/admin/categories` (buat, ubah label en/id/ru,
  urutkan, centang `active`, arsipkan). Yang membuat uncheck bekerja di seluruh toko sekaligus adalah satu konstanta `visibleToBuyers`
  di `apps/api/src/products/catalog.service.ts`, yang dipakai katalog, detail produk dan halaman penjual: menambahkan `category: { active: true,
  archivedAt: null }` di situ membuat produknya hilang dari daftar **dan** membuat `/products/:id` menjawab 404. `ProductStatus` **tidak** diubah
  saat kategori dimatikan, jadi mencentang ulang memulihkan semuanya tanpa menyentuh baris produk; penjual tetap melihat produknya dengan badge
  "kategori dinonaktifkan". Order yang sedang jalan tidak terpengaruh (`OrderItem` menyimpan snapshot, `productId` nullable). Slug divalidasi
  terhadap database (`CategoriesService.assertSelectable()`), bukan terhadap daftar di kode; filter katalog dengan slug tak dikenal menjawab
  200 + daftar kosong, bukan 400, supaya URL filter yang di-bookmark tetap jalan setelah sebuah kategori dimatikan.
- Review listing (T10): ADMIN_OPS/OWNER membuka antrean `/admin/products` (tanpa DRAFT), menulis/merapikan terjemahan en/id/ru secara manual (`PUT /admin/products/:id/translations`, `isAuto=false`), lalu approve atau reject (alasan wajib; penjual melihat alasannya, `submit` ulang menghapusnya). **Approve butuh teks en, id, dan ru terisi** dan hanya berlaku untuk PENDING_REVIEW. Katalog publik `GET /api/products?locale=` hanya menampilkan produk APPROVED milik penjual APPROVED; bila terjemahan bahasa itu tidak ada, jatuh ke bahasa penjual. Terjemahan bahasa lain tidak dihapus saat penjual mengedit (admin memeriksanya ulang saat review berikutnya).
- Katalog publik (T12, tanpa login): `GET /api/products?locale=&q=&category=&type=` (maks. 48 produk, terbaru dulu; belum ada pagination), `GET /api/products/:id?locale=` dan `GET /api/public/sellers/:id?locale=` (profil penjual: nama toko, deskripsi, kabupaten, bergabung sejak, produknya; tanpa email/kontak/rating). Hanya produk APPROVED milik penjual APPROVED; selain itu **404** (draft, penjual belum disetujui, id acak). Pencarian: tiap kata harus muncul (AND) di judul/deskripsi pada bahasa mana pun, tidak peka huruf besar-kecil; `%` dan `_` di-escape agar dicari apa adanya. Web: `/products` (filter di URL: `?q=&category=&type=`, bisa di-bookmark), `/products/[id]`, `/sellers/[id]`. Tombol "Request to order" / "Ask the seller & BaliTrade": tamu → `/login`; user login → nonaktif dengan keterangan "segera dibuka" sampai T13 (chat) dan T15 (order). Biaya QC belum ditampilkan di detail karena tarif zona masih placeholder.
- **ProductTranslation**: productId, locale (en/id/ru), title, description, isAuto
- **ProductMedia**: productId, r2Key, type (IMAGE / VIDEO), sort
- **ExchangeRate** (T11): rate `Decimal(12,4)` = IDR per 1 USD, setById, createdAt. Hanya-tambah (append-only): baris terbaru = kurs berlaku, baris lama = riwayat (siapa & kapan). MVP 1.1 menambah kolom `suggestedRate`/`source` untuk kurs dari API.
- **Order** (T15): `number` (urut otomatis; kode tampil `OR-<1000+number>`), buyerId, sellerId (MVP 1.0: 1 penjual per order), status (semua status §6 sudah ada di enum), deliveryAddress (json: fullName, phone, country, address), fxRate (snapshot), itemsUsd, qcFeeUsd (snapshot tarif zona penjual saat itu). `shippingUsd` dan `awbNumber` menyusul di T19.
- **OrderItem** (T15): orderId, productId? (SetNull bila produk dihapus), snapshot `title`/`unit`/`unitPriceIdr`/`unitPriceUsd`, qty, note, sellerResponse (PENDING / ACCEPTED / DECLINED / CHANGE_PROPOSED), proposedQty
  - Aturan order request (T15, `POST /api/orders`): hanya role BUYER, bukan untuk produknya sendiri (403), hanya produk yang tampil di katalog (selain itu 404); qty bulat ≥ MOQ dan, untuk READY_STOCK, ≤ stok (400); **ditolak 409 bila kurs belum diisi**. Harga satuan USD dibulatkan ke sen dulu (yang dilihat pembeli), total = qty × harga satuan itu. Harga, kurs dan biaya QC **disalin** ke order sehingga perubahan berikutnya tidak memengaruhinya. Maks. 20 request per pembeli per jam (429). Dalam satu transaksi dibuat juga chat ORDER (buyer + penjual + admin, `productId` kosong, terhubung lewat `orderId`) dengan pesan sistem pertama, lalu penjual dinotifikasi `ORDER_REQUESTED`.
  - Aksi order (T16, `POST /api/orders/:id/{accept,decline,propose-change,accept-change,cancel}`): penjual menjawab permintaan (**accept** → langsung `AWAITING_PAYMENT`; **decline**; **propose-change** hanya ke jumlah *lebih rendah*), pembeli menerima perubahan (kuantitas dan total mengikuti, harga satuan dan kurs tetap) atau **cancel** (sampai membayar). Penjual boleh merevisi atau menarik usulannya. Satu-satunya sumber aturan transisi adalah `nextOrderStatus()` di `packages/shared/src/orders.ts` (diuji unit; task berikutnya menambah transisi pembayaran/QC/pengiriman di situ); `OrderView.actions` memberi daftar aksi untuk pembaca. Peran salah → 403 (admin membaca tapi tidak beraksi), bukan peserta → 404, status tidak cocok atau berubah bersamaan → **409** (pembaruan `updateMany` bersyarat status, jadi dua jawaban bersamaan hanya satu yang menang). Tiap aksi menulis pesan sistem di chat order dalam transaksi yang sama (alasan opsional ikut ditulis) dan menotifikasi pihak lawan (`ORDER_STATUS`). `ACCEPTED` tidak disinggahi: dengan satu item per order, accept langsung ke `AWAITING_PAYMENT`; nilai enum disimpan untuk keranjang MVP 1.1.
  - Akses: buyer, penjual order itu, dan **semua peran admin** (termasuk FINANCE) melihat order; yang lain 404. **Alamat pengiriman tidak dikirim ke penjual** (BaliTrade yang mengirim). Pesan sistem (`MessageKind.SYSTEM`, tanpa pengirim) tidak menimbulkan notifikasi chat.
- **Payment**: orderId, kind (GOODS / SHIPPING), method (BANK_IDR / USDT / EXCHANGE), amountUsd, amountIdr, proofKey, txHash, senderName, exchangeName/exchangeRef (EXCHANGE saja), status (SUBMITTED / VERIFIED / REJECTED), verifiedBy, verifiedAt
- Metode pembayaran (diputuskan 2026-10-30, dibangun di T17/T19): `BANK_IDR` = transfer ke rekening BCA, diperiksa manual; `USDT` = kirim ke wallet Binance milik BaliTrade, dikonversi ke rupiah lewat Binance; `EXCHANGE` = pembeli hanya punya rubel, membayar ke exchange mitra di Indonesia yang mengirim rupiah ke BaliTrade secara manual. Semua diverifikasi manual oleh ADMIN_FINANCE (+ audit log); tidak ada integrasi otomatis. Detail rekening, wallet, jaringan USDT dan petunjuk exchange datang dari konfigurasi (bukan kode); pencairan ke penjual tetap IDR manual (T20).
- **QcReport** (+ media): orderId, checklist (json), comment, status (READY / APPROVED / ISSUE), createdBy
- **TrackingEvent**: orderId, milestone, note, photoKey, createdBy, at
- **Conversation** (T13): type (PRODUCT_INQUIRY / ORDER), productId?, buyerId, sellerId (SellerProfile), lastMessageAt · **Message**: conversationId, senderId, body (≤ 2000 karakter; lampiran menyusul). **Tidak ada tabel Participant**: peserta = buyer + penjual percakapan itu, dan admin `ADMIN_OPS`/`ADMIN_OWNER` ikut di semua percakapan lewat peran (admin baru otomatis ikut). `ADMIN_FINANCE` tidak ikut. Satu percakapan per pembeli per produk (unik `buyerId+productId`); pesan sistem dan `orderId` menyusul di T15/T16.
  - Aturan (T13 langkah 1, REST `/api/conversations`): hanya pembeli (role BUYER) yang bisa memulai, tidak untuk produknya sendiri (403) dan hanya untuk produk yang terlihat pembeli (selain itu 404); bukan peserta → 404; pengirim selalu user yang login; label pengirim BUYER/SELLER/ADMIN (penjual tampil dengan nama toko); pembeli hanya terlihat id dan namanya (tanpa email/telepon). Daftar pesan: 50 terbaru, urut lama→baru, halaman lebih lama lewat `?before=`.
  - UI (T13 langkah 3): komponen `ChatPanel` (`apps/web/src/components/chat/`) dipakai oleh laci chat di `/products/[id]` (`ChatDrawer`, elemen `<dialog>` bawaan) dan oleh `/messages?c=<id>` (daftar kiri, chat kanan; di layar kecil salah satunya). Pesan baru datang lewat **Socket.IO** (lihat "Realtime" di `docs/API.md`); polling tetap ada sebagai cadangan: 30 detik saat socket tersambung (daftar percakapan 60 detik), 4 detik (daftar 8 detik) saat tidak, hanya selagi tab terlihat, plus segar seketika saat tab kembali terlihat atau socket tersambung ulang. Teks pesan ditampilkan sebagai teks biasa (React meng-escape; tidak ada HTML).
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
- **Chat realtime** (T13, selesai di sisi teks): Socket.IO gateway di NestJS (`apps/api/src/chat/chat.gateway.ts`). Pesan **ditulis hanya lewat REST** (divalidasi, maks. 20 pesan/menit per user), socket hanya mengantar. Autentikasi di middleware handshake: cookie `bt_session` + `Origin` harus sama dengan `WEB_ORIGIN` (mencegah pembajakan WebSocket lintas-situs). Room `conversation:<id>` hanya bisa dimasuki peserta (aturan akses sama dengan REST); sinyal `conversation:updated` (hanya id) ke buyer, penjual dan moderator. Keanggotaan room dicek saat `join`; bila peran seseorang dicabut, ia baru kehilangan akses room saat sambungannya putus. Rencana awal: room per conversation; pesan juga disimpan di DB; lampiran via R2. Admin (ADMIN_OPS) otomatis jadi peserta semua conversation. Banner "Admin ikut dalam percakapan" + persetujuan saat daftar (UU PDP).
- **Media (R2)**: frontend minta presigned URL ke API → upload langsung ke R2 → simpan key. Bukti pembayaran di bucket/prefix privat,
  dibuka via presigned GET berumur pendek. **Batas sejak 2026-11-12: foto 500 KB, video 100 MB** (sebelumnya 10 MB / 50 MB).
  500 KB jauh di bawah hasil kamera HP (2–5 MB), jadi itu hanya bisa dipakai karena **browser memperkecil dan meng-encode ulang
  dulu** (`apps/web/src/lib/image-compress.ts`: sisi terpanjang 2000/1600/1280 px × kualitas 0,85/0,78/0,7 → WebP, hasil pertama
  yang muat menang). Ukuran yang ditandatangani adalah ukuran **setelah** kompresi; aslinya tidak pernah dikirim ke mana pun.
  **Dimensi selalu dinormalkan ke 2000 px**, bahkan untuk berkas yang sudah ringan — web memakai `<img>` biasa tanpa thumbnail dan
  tanpa `srcset`, jadi satu berkas melayani kartu katalog sekaligus halaman detail; foto 4000 px yang lolos tanpa diperkecil akan
  dikirim utuh ke kartu selebar 300 px. Itu juga alasan batasnya 500 KB dan bukan 1 MB: grid 12 produk = ~6 MB, bukan ~12 MB.
  Menaikkannya lagi baru masuk akal bersamaan dengan menyimpan thumbnail terpisah.
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
- **Web ↔ API auth**: browser memanggil API langsung (`NEXT_PUBLIC_API_URL`, default `http://localhost:4000/api`) dengan `credentials: 'include'`; sesi dibaca client lewat `GET /auth/me` di `AuthProvider`. Cookie berfungsi karena web dan API satu *site* (localhost; di production pakai subdomain dari domain yang sama, mis. `app.` dan `api.`). Persetujuan "admin ikut di semua chat" (T13b): `POST /auth/register` **wajib** memuat `acceptAdminInChat: true` (ditolak 400 bila tidak; bukan hanya divalidasi di form), dan menyimpan `User.adminChatConsentAt` + `adminChatConsentVersion` (konstanta `ADMIN_CHAT_CONSENT_VERSION` di `packages/shared`, naikkan bila teks berubah). Akun dari seed/admin tidak memilikinya; akun lama sebelum T13b bernilai null.
- **i18n UI**: `next-intl`, file `messages/en.json`, `id.json`, `ru.json`; locale di URL (`/en`, `/id`, `/ru`) + cookie + `User.locale`.
  - Implementasi (T06): rute `src/app/[locale]/...`, `src/proxy.ts` (next-intl; Next 16 memakai `proxy`, bukan `middleware`) mengarahkan `/` ke bahasa dari cookie `NEXT_LOCALE` → header Accept-Language → `en`. Link/redirect memakai `@/i18n/navigation`, bukan `next/link`.
  - Semua teks UI ada di `apps/web/messages/*.json` (3 file harus punya key yang sama). Pesan error API (selalu Inggris) dipetakan ke key `Auth.errors.*` lewat status HTTP — UI tidak menampilkan teks mentah dari API.
  - Language switcher di navbar & footer mengganti URL; bila login juga memanggil `PATCH /api/auth/me {locale}` → `User.locale`. Setelah login, user diarahkan ke bahasa tersimpan di akunnya. Daftar baru menyimpan bahasa halaman saat itu.
  - Teks terjemahan ID/RU di `messages` ditulis oleh AI — minta penutur asli untuk memeriksa sebelum rilis.
- **i18n konten produk**: penjual menulis EN atau ID (`sourceLocale`). MVP 1.0: admin mengisi/merapikan terjemahan saat approval listing. MVP 1.1: tombol/otomatis terjemah via API (mis. DeepL), `isAuto = true`, tetap direview admin. Fallback: tampilkan bahasa sumber + label.
- **Kurs**: MVP 1.0 admin input manual. MVP 1.1: job harian ambil kurs dari API gratis → `suggestedRate` → wajib dikonfirmasi ADMIN_OWNER; peringatan jika selisih > 3% dari kurs terakhir. Harga disimpan IDR, tampil USD; order menyimpan snapshot kurs.
  - Implementasi (T11): hanya `ADMIN_OWNER` yang mengisi kurs (`POST /api/admin/exchange-rates`, riwayat via `GET` yang sama; halaman `/admin/exchange-rate`). Batas wajar 1.000–100.000 IDR/USD (penangkap salah ketik, `FX_LIMITS` di `packages/shared`), maksimal 4 desimal. Kurs berlaku dibaca publik lewat `GET /api/fx/current`. Katalog publik menambah `priceUsd` = `priceIdr ÷ kurs`, dibulatkan half-up ke sen dengan aritmetika Decimal (`fx/fx-math.ts`), berupa string (`"6.80"`); `null` selama kurs belum diisi. Satu kurs dipakai untuk seluruh respons daftar. **Belum ada buffer kurs 2–3%** (keputusan terbuka, BRAINSTORMING §10): harga USD = kurs apa adanya.
- **Notifikasi**: in-app saja (tabel Notification + push via Socket.IO). Tanpa email/WA/Telegram.
  - Implementasi (T14): `notifications` module. Pesan chat baru → notifikasi `CHAT_MESSAGE` untuk sisi lain percakapan (pembeli dan penjual kecuali pengirim; pesan admin menotifikasi keduanya; admin sendiri tidak). Pesan belum dibaca di percakapan yang sama **digabung** jadi satu baris dengan `count` (`subject` = `conversation:<id>`); setelah dibaca, pesan berikutnya membuat baris baru. Judul produk disimpan dalam bahasa penerima. REST: `GET /api/notifications` (30 terbaru + jumlah belum dibaca), `POST /api/notifications/:id/read`, `/read-all`, `/conversations/:id/read` (dipanggil panel chat saat percakapan dibaca). Push: `notification:new` {item, unreadCount} dan `notification:count` (sinkron antar tab) ke room pribadi `user:<id>`. Notifikasi order menambah nilai `NotificationType` di T15+.

## 8. Environment & deploy

- `.env.example` berisi semua variabel (DATABASE_URL, JWT_SECRET, R2_*, RESEND_API_KEY, APP_URL, dll.). Tidak ada secret di repo.
- Dev: VPS sumopod (2 GB) atau lokal; Postgres via Docker.
- **Satu VPS untuk semuanya, database ikut di dalamnya (keputusan 2026-11-10).** Supabase/Neon dipertimbangkan dan ditunda, alasannya
  ada di `docs/DECISIONS.md`. Singkatnya: free tier memberi kerumitannya (pooler Prisma, project tidur, latensi jaringan) tanpa
  keunggulan utamanya (backup terkelola), sedangkan VPS 4 GB sangat jauh dari kewalahan di skala MVP. **Pindah ke Postgres terkelola
  saat uang sungguhan mulai mengalir** — pemicunya ada di bagian "Kapan memisahkan database" di bawah.
- **Lokasi: Singapura.** Penjual, admin dan QC bekerja harian dari Bali (~30 ms); pembeli Rusia/CIS datang sesekali (~170–200 ms).
  Yang menentukan rasa cepat adalah jarak browser→API, bukan browser→halaman — jadi memindahkan frontend ke CDN Eropa (Vercel) tidak
  memperbaiki bagian yang penting. **Tidak memakai Vercel** (2026-11-10): tidak menyelesaikan latensi yang sebenarnya, paket gratisnya
  melarang penggunaan komersial, dan web berjalan di VPS yang sama dengan biaya ±300 MB RAM dan satu domain saja.
- Build image Docker di GitHub Actions (build Next.js di VPS 2 GB berisiko kehabisan RAM), VPS hanya menjalankan. **CI otomatis, CD manual** (keputusan 2026-10-31): push ke GitHub menjalankan lint/typecheck/test/build dan mendorong image ke GHCR; pemilik men-deploy sendiri lewat SSH dengan `docker compose pull && docker compose up -d`. VPS Ubuntu 22.04/24.04. **PostgreSQL dipasang manual di host VPS (bukan kontainer)**; hanya web dan API yang berjalan sebagai kontainer dan menyambung ke Postgres host (`host.docker.internal` dengan `extra_hosts: host-gateway`, atau IP gateway Docker). Postgres mendengarkan localhost dan jaringan Docker saja (`listen_addresses`, `pg_hba.conf`), tanpa membuka port 5432 ke internet; dikelola dengan `psql` dan `pg_dump`. Docker untuk Postgres hanya dipakai di laptop pengembangan (`docker-compose.yml`).
- Syarat agar sesi login dan chat (WebSocket) berjalan di produksi: HTTPS; web dan API satu *site* (subdomain dari domain yang sama, mis. `app.` dan `api.`); `WEB_ORIGIN` di API = alamat web; `NEXT_PUBLIC_API_URL` ditanam saat build image web
  (**konsekuensi:** image web testing tidak bisa dipakai ulang untuk produksi — perlu satu image per environment. Alternatif yang
  dipertimbangkan untuk T23: Caddy mem-proxy API di domain yang sama pada path `/api` sehingga URL-nya relatif, satu image jalan di
  mana saja dan cookie menjadi same-origin; konsekuensinya rencana `app.`+`api.` berubah — **belum diputuskan**); reverse proxy (**nginx**) meneruskan WebSocket ke API (`Upgrade`/`Connection` + `proxy_read_timeout 3600s`).
- **Reverse proxy: nginx, bukan Caddy (diubah 2026-11-11).** Rencana awal memakai Caddy karena sertifikatnya otomatis, tetapi VPS sudah
  menjalankan nginx dalam container yang memegang port 80/443 untuk proyek lain; dua reverse proxy tidak bisa berbagi port itu. Sertifikat
  memakai certbot mode `standalone` di host, dengan hook `docker stop nginx` / `docker start nginx` — artinya **semua situs di VPS mati
  ±30 detik tiap perpanjangan**. Mode `webroot` bisa nol downtime; belum dikerjakan agar tidak mengubah setup yang sudah bekerja.
- **Susunan di VPS (2026-11-11), satu folder per tanggung jawab, satu jaringan Docker bersama bernama `edge`** (`docker network create edge`):
  `/home/ubuntu/infra` nginx global + `conf.d/` satu berkas per proyek · `/home/ubuntu/project` API toko online milik pemilik ·
  `/home/ubuntu/balitrade` web + api BaliTrade. Pemisahan ini penting: sebelumnya nginx ikut di compose proyek lain, sehingga
  `docker compose down` di sana akan menjatuhkan seluruh situs di mesin itu. Container BaliTrade **tidak membuka port ke host** sama
  sekali; nginx menjangkaunya lewat nama container di jaringan `edge`. Salinan berkasnya ada di `deploy/` di repo ini.
- **Container menjangkau PostgreSQL host** lewat gateway jaringan Docker (`172.19.0.1`), bukan `host.docker.internal`. Tiga setelan yang
  membuatnya jalan, dan ketiganya perlu ada: `listen_addresses` memuat alamat bridge Docker (tidak pernah alamat publik), satu baris
  `pg_hba.conf` `host balitrade balitrade 172.16.0.0/12 scram-sha-256`, dan aturan ufw `allow from 172.16.0.0/12 to any port 5432`.
  Tanpa aturan ufw koneksi **timeout**, bukan ditolak — gejala yang mudah disalahartikan sebagai Postgres mati.
- Swap **2 GB wajib** dibuat sejak hari pertama: melindungi dari OOM kill saat lonjakan sesaat.
- Backup: `pg_dump` harian ke R2. **Ini satu-satunya jaring pengaman data** selama database tinggal di VPS yang sama dengan aplikasi,
  jadi restore-nya wajib pernah dicoba (DoD T24) — backup yang belum pernah di-restore bukan backup.
- **Kapan memisahkan database ke layanan terkelola** (bukan karena performa, tapi supaya catatan pesanan dan bukti bayar tidak mati
  bersama satu kotak): saat ada pesanan dengan uang sungguhan, atau RAM/CPU bertahan di atas 80%/70%, atau database tumbuh beberapa GB.
  Perpindahannya murah — bagi aplikasi ini semua Postgres hanya `DATABASE_URL`, jadi `pg_dump` + `pg_restore` + ganti satu variabel.
  Jebakan yang menunggu di sana dicatat di "Kalau nanti pindah ke Postgres terkelola" di bawah.
- **Kalau nanti pindah ke Postgres terkelola (Supabase/Neon):** (1) Prisma 7 + `adapter-pg` memakai prepared statement yang bentrok
  dengan *transaction pooler* — gejalanya `prepared statement "s0" already exists`, muncul setelah app jalan beberapa menit, bukan
  langsung; pakai session mode atau parameter pooler. (2) `prisma migrate deploy` butuh koneksi langsung/session, bukan transaction
  pooler, jadi kemungkinan perlu `DIRECT_URL` di samping `DATABASE_URL` (belum ada di kode). (3) Koneksi langsung Supabase hanya IPv6.
  (4) Free tier menidurkan project setelah ±1 minggu nganggur dan praktis tanpa backup yang bisa di-restore sendiri.
- **Banyak ISP rumah di Indonesia memblokir port keluar 5432** (dipastikan 2026-11-10; lewat Telkomsel seluler bisa). Ini tidak
  menyentuh alur kerja yang sesungguhnya: pengembangan lokal memakai Postgres Docker di laptop, migrasi produksi dijalankan **dari VPS**,
  dan untuk mengintip data produksi pakai `ssh` lalu `psql` di sana (port 22, tidak diblokir). Laptop tidak pernah perlu menyambung
  langsung ke database produksi.
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
