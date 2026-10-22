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
