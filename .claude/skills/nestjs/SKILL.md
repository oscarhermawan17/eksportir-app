---
name: nestjs
description: Konvensi NestJS untuk apps/api BaliTrade (modul, DTO, guard RBAC, Prisma, WebSocket gateway). Gunakan saat menulis atau mereview kode backend.
---

# Konvensi NestJS — apps/api

Struktur
- Satu folder per modul fitur: `src/<feature>/{<feature>.module.ts, .controller.ts, .service.ts, dto/, <feature>.gateway.ts?}`.
- Controller tipis (routing, DTO, guard). Logika bisnis di service. Akses DB hanya lewat `PrismaService`.
- Enum & tipe yang dipakai web juga → `packages/shared`.

Validasi & error
- `ValidationPipe` global dengan `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Semua input lewat DTO (`class-validator`). Jangan percaya data dari client (harga, status, role) — hitung/cek di server.
- Lempar exception Nest bawaan (`BadRequestException`, `ForbiddenException`, `NotFoundException`). Jangan bocorkan stack trace/pesan internal ke client.

Auth & RBAC
- JWT di cookie httpOnly, `secure` di production, `sameSite: 'lax'`.
- `@Roles(...)` + `RolesGuard`; cek kepemilikan resource di service (mis. seller hanya boleh ubah produknya sendiri).
- Aksi uang (verifikasi pembayaran, refund, payout) wajib menulis `AuditLog`.

Status order
- Transisi status lewat satu fungsi/service terpusat yang memvalidasi transisi yang diizinkan (ARCHITECTURE bagian 6). Pakai transaksi Prisma (`$transaction`) bila mengubah beberapa tabel.

WebSocket
- `@WebSocketGateway` Socket.IO; autentikasi saat `handleConnection` dari cookie JWT; room = `conversation:<id>`; cek user adalah peserta sebelum join/kirim.

Konfigurasi
- `@nestjs/config` dengan validasi env saat startup; tidak ada secret di kode.

Testing
- Unit test service penting (transisi status, kalkulasi harga). E2E test untuk auth & alur order utama.

Pola yang sudah dipakai di project ini
- Guard berlapis untuk endpoint penjual: `@UseGuards(JwtAuthGuard, RolesGuard, ApprovedSellerGuard)` + `@Roles('SELLER')`. Endpoint admin: `@Roles('ADMIN_OPS', 'ADMIN_OWNER')` (peran tidak mewarisi; sebutkan eksplisit atau pakai `ADMIN_ROLES`).
- Resource milik user lain dijawab 404 (bukan 403) agar id tidak bisa ditebak. Cek kepemilikan di service.
- Perubahan status lewat satu fungsi murni (`nextStatus()` di `products/product-status.ts`) + unit test; service memanggilnya, controller tidak pernah menerima `status` dari client.
- Pipeline validasi dipasang lewat `configureApp()` (`src/app.setup.ts`) dan dipakai `main.ts` serta e2e test.
- Upload media: API hanya membuat presigned URL (`media` module); file tidak lewat API. Key divalidasi dengan regex yang memuat id pemilik.
- Env opsional (mis. R2) divalidasi di `config/env.ts`: boleh kosong di development, wajib di production, dan konfigurasi setengah-terisi ditolak.

Testing e2e (Vitest + supertest)
- Login dibatasi 5/menit per instance app → login sekali per user dan pakai ulang `request.agent`.
- Tiap file spec membuat user dengan prefix email unik (`sellers-e2e-`, `products-e2e-`, ...) dan menghapusnya di `afterAll`; jangan pakai prefix yang sama di dua file (file berjalan paralel).
- Butuh `pnpm db:up` dan `pnpm db:seed` (zona QC). R2 diuji dengan env palsu karena presign dihitung lokal.
- `pnpm dev` (nest --watch) bisa mati setelah `pnpm build`; ubah file kecil di `apps/api/src` lalu kembalikan untuk memicu restart.
