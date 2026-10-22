---
name: nextjs
description: Konvensi Next.js (App Router) untuk apps/web BaliTrade — i18n next-intl, Tailwind dengan token design system, pemanggilan API, aksesibilitas. Gunakan saat menulis atau mereview kode frontend.
---

# Konvensi Next.js — apps/web

Struktur
- App Router: `src/app/[locale]/...` (locale: en, id, ru). Komponen bersama di `src/components/`, UI dasar di `src/components/ui/`.
- Server Component secara default; `"use client"` hanya untuk interaksi (form, chat, stepper).
- Panggilan ke API NestJS lewat satu klien (`src/lib/api.ts`) dengan `credentials: 'include'` (cookie httpOnly). Jangan simpan token di localStorage.

i18n
- `next-intl`; semua teks UI dari `messages/{en,id,ru}.json` — tidak ada string hardcode di komponen.
- Konten produk dari API sudah per-locale; tampilkan label "Auto-translated · View original" bila `isAuto`.

Tampilan
- Token dari design system (`design-ui/google-stitch/01-v4.html`) di Tailwind config: primary `#0F4C5C`, hover `#0B3A46`, gold `#C9A24A` (teks gold di latar terang `#9A7426`), terracotta `#B5563A`, background `#FAF7F2`, border `#E7E2D9`, text `#1F2937`, muted `#6B7280`, radius 12px, font Plus Jakarta Sans, ikon Lucide.
- Navbar & footer = satu komponen standar. Ikuti "Catatan implementasi" di `UI_PROMPT.md` (tanpa kata "escrow", tanpa janji/SLA karangan).
- Sederhana dulu: jika bagian desain terasa berlebihan, buat versi paling sederhana yang tetap jelas.

Form & data
- Validasi di client untuk UX (mis. zod + react-hook-form), tetapi server tetap sumber kebenaran.
- Tampilkan state loading, kosong, dan error untuk setiap daftar/form.

Aksesibilitas
- Label untuk setiap input, `alt` untuk gambar, kontras teks ≥ 4.5:1, fokus keyboard terlihat, tombol bukan `div`.
