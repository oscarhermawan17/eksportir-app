# Project context — BaliTrade

Sebelum menjawab apa pun tentang project ini, WAJIB baca:
1. `BRAINSTORMING.md` — semua keputusan bisnis, flow, dan keputusan terbuka.
2. `UI_PROMPT.md` — prompt Google Stitch + tabel **Progress** (status tiap halaman UI).
3. `ARCHITECTURE.md` — stack, model data, alur status order, scope MVP 1.0 / 1.1, rencana kerja.
4. `TASKS.md` — daftar task coding berurutan dengan DoD; lanjutkan dari task pertama yang belum dicentang (skill `/next-task`).

Skill project di `.kiro/skills/`: `nestjs`, `nextjs`, `prisma-postgres`, `typescript` (konvensi kode), `next-task` (alur kerja task).

Aturan:
- Tahap saat ini: desain UI selesai (2026-10-22); berikutnya arsitektur/teknis. Jangan memilih framework tanpa diskusi dengan user.
- Lanjutkan pekerjaan UI dari tabel Progress di `UI_PROMPT.md`; update tabel itu setiap ada perubahan status.
- Hasil generate disimpan di `design-ui/google-stitch/` (`01.html` = halaman 1, dst.). Saat review, cocokkan dengan keputusan di `BRAINSTORMING.md`.
- Keputusan baru dari diskusi → catat di `BRAINSTORMING.md`. Prompt UI baru/revisi → `UI_PROMPT.md`.
- Komunikasi dengan user dalam Bahasa Indonesia; prompt Stitch dalam bahasa Inggris.
- Saat masuk tahap implementasi/coding UI: WAJIB baca bagian "Catatan implementasi (ringkasan)" di `UI_PROMPT.md` dan catatan implementasi per halaman. Design system `design-ui/google-stitch/01-v4.html` = sumber kebenaran visual; halaman lain hanya acuan alur.
