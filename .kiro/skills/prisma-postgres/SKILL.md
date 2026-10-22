---
name: prisma-postgres
description: Konvensi PostgreSQL + Prisma untuk BaliTrade — penamaan, migrasi, uang & kurs, transaksi, seed, backup. Gunakan saat mengubah schema.prisma atau query database.
---

# Konvensi PostgreSQL + Prisma

Schema
- Model PascalCase tunggal (`Order`), field camelCase; `@@map`/`@map` ke snake_case di DB.
- Setiap tabel: `id` (cuid/uuid), `createdAt`, `updatedAt`.
- Status & role pakai `enum` Prisma (sinkron dengan `packages/shared`).
- Index untuk kolom yang sering difilter (status, sellerId, buyerId, createdAt).

Uang & kurs
- Jangan pakai float. Simpan IDR sebagai `BigInt`/`Int` (rupiah utuh) dan USD sebagai `Decimal(12,2)`; kurs `Decimal(12,4)`.
- Order/OrderItem/Payment menyimpan **snapshot** harga & kurs saat transaksi — jangan dihitung ulang dari harga produk terkini.

Migrasi
- Selalu `prisma migrate dev --name <deskripsi>` saat development; production pakai `prisma migrate deploy` (otomatis saat deploy).
- Jangan edit migrasi yang sudah diterapkan; buat migrasi baru.

Transaksi & keamanan
- Operasi multi-tabel (ubah status + buat pesan sistem + audit log) dalam `prisma.$transaction`.
- Tidak ada raw SQL dengan string interpolation; jika perlu raw query gunakan tagged template `$queryRaw`.

Seed & backup
- `prisma/seed.ts`: akun admin awal (dari env), QcZone 9 kabupaten Bali, kategori.
- Backup harian `pg_dump` → R2; uji restore secara berkala.
