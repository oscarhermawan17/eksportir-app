# Project context — BaliTrade

Sebelum menjawab apa pun tentang project ini, baca:
1. `TASKS.md` — daftar task coding berurutan dengan DoD; lanjutkan dari task pertama yang belum dicentang.
2. `ARCHITECTURE.md` — stack (versi), model data, alur status order, scope MVP 1.0 / 1.1.
3. `BRAINSTORMING.md` — keputusan bisnis, flow, dan keputusan terbuka (bagian 15).
4. `UI_PROMPT.md` — terutama "Catatan implementasi (ringkasan)" saat mengerjakan UI.
5. `README.md` — struktur folder & cara menjalankan.

Skill project di `.kiro/skills/`: `nestjs`, `nextjs`, `prisma-postgres`, `typescript` (konvensi kode), `next-task` (alur kerja: ambil task → kerjakan → cek DoD → centang).

Status (update setiap selesai task):
- Ide & desain UI: selesai (2026-10-22). Stack sudah diputuskan (lihat ARCHITECTURE.md) — jangan ganti framework tanpa diskusi.
- Coding MVP 1.0 berjalan; target 31 Okt 2026. Task terakhir selesai: lihat centang di `TASKS.md`.

Aturan:
- Komunikasi dengan user dalam Bahasa Indonesia; kode, commit, dan teks UI default dalam bahasa Inggris.
- Kerjakan hanya scope task; fitur yang terasa berlebihan → versi paling sederhana.
- Setiap task: jalankan lint, typecheck, build, dan test yang relevan sebelum dianggap selesai.
- Keputusan baru → catat di `BRAINSTORMING.md` (bisnis) atau `ARCHITECTURE.md` (teknis).
- UI: design system `design-ui/google-stitch/01-v4.html` = sumber kebenaran visual (token sudah ada di `apps/web/src/app/globals.css`); halaman Stitch lain hanya acuan alur.
- Git: commit hanya jika user meminta; author = user saja (tanpa trailer "Co-authored-by"); jangan commit `.env`.
