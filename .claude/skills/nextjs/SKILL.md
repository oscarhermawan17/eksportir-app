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
- Navbar & footer = satu komponen standar. Ikuti "Catatan implementasi" di `docs/DESIGN.md` (tanpa kata "escrow", tanpa janji/SLA karangan).
- Sederhana dulu: jika bagian desain terasa berlebihan, buat versi paling sederhana yang tetap jelas.

Form & data
- Validasi di client untuk UX (mis. zod + react-hook-form), tetapi server tetap sumber kebenaran.
- Tampilkan state loading, kosong, dan error untuk setiap daftar/form.

Aksesibilitas
- Label untuk setiap input, `alt` untuk gambar, kontras teks ≥ 4.5:1, fokus keyboard terlihat, tombol bukan `div`.

Pola yang sudah dipakai di project ini (Next.js 16)
- `proxy.ts` (bukan `middleware.ts`) untuk next-intl. Link/redirect/useRouter/usePathname dari `@/i18n/navigation`, bukan `next/link` atau `next/navigation`.
- Dengan `cacheComponents`: komponen client yang memakai `usePathname()`/`useSearchParams()` pada rute ber-segmen dinamis harus di dalam `<Suspense>` (Navbar & Footer sudah dibungkus di `[locale]/layout.tsx`); `params` rute dinamis dibaca di dalam `<Suspense>` (lihat `seller/products/[id]/edit/page.tsx`).
- URL tak dikenal: `[locale]/[...rest]/page.tsx` (memanggil `notFound()`) + `[locale]/not-found.tsx` + `app/global-not-found.tsx`; tanpa ini halaman 404 ter-reload terus.
- Panggilan API dari browser lewat `apiFetch` (`@/lib/api`); pesan error dari API tidak pernah ditampilkan mentah — petakan status HTTP ke key `Errors.*` dengan `errorKey()`.
- Halaman yang butuh login memakai `LoginGate` (`components/auth/login-gate.tsx`), opsional dengan `allow={(user) => ...}` untuk cek role.
- Memuat data di `useEffect`: jangan panggil setState sinkron di dalam effect (aturan lint `react-hooks/set-state-in-effect`); reset state di event handler, lalu biarkan effect hanya memanggil API.
- Input yang berganti tipe di posisi yang sama perlu `key` berbeda, kalau tidak nilai lama ikut terbawa.
- Semua key di `messages/en.json`, `id.json`, `ru.json` harus sama; cek dengan skrip kecil sebelum selesai.
