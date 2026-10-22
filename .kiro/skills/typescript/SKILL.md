---
name: typescript
description: Aturan TypeScript bersama untuk monorepo BaliTrade (web, api, shared). Gunakan saat menulis kode TypeScript apa pun di project ini.
---

# Aturan TypeScript

- `strict: true`. Tidak ada `any` — gunakan `unknown` lalu persempit, atau tipe yang tepat.
- Tipe/enum yang dipakai lintas app (role, status order, locale, metode bayar) didefinisikan sekali di `packages/shared`.
- Prefer `const`, fungsi kecil dan jelas, nama deskriptif dalam bahasa Inggris.
- Tangani error secara eksplisit; jangan menelan error tanpa log.
- Komentar hanya untuk logika yang tidak jelas (mis. aturan bisnis kurs/ongkir), bukan untuk menjelaskan kode yang sudah jelas.
- Dependency baru: versi di-pin (tanpa `^`/`~` untuk dependency langsung), paket populer & aktif dirawat; sebutkan ke user saat menambah.
- Format & lint: Prettier + ESLint wajib lulus sebelum task dianggap selesai.
