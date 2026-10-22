---
name: next-task
description: Ambil task berikutnya yang belum selesai di TASKS.md BaliTrade, kerjakan sampai DoD terpenuhi, lalu centang.
---

# Kerjakan task berikutnya (BaliTrade)

1. Baca `TASKS.md`, cari task pertama yang belum dicentang (`- [ ]`). Jika $ARGUMENTS berisi ID task (mis. T07), kerjakan task itu.
2. Baca bagian yang relevan di `ARCHITECTURE.md` dan, untuk pekerjaan UI, "Catatan implementasi" di `UI_PROMPT.md` serta desain di `design-ui/google-stitch/` (visual: `01-v4.html`).
3. Gunakan skill yang sesuai (`nestjs`, `nextjs`, `prisma-postgres`, `typescript`) untuk konvensi kode.
4. Jelaskan rencana singkat ke user sebelum mengubah banyak file.
5. Kerjakan task. Jalankan lint, build, dan test yang relevan. Perbaiki error sebelum lapor.
6. Jika DoD terpenuhi: centang task di `TASKS.md`. Jika ada keputusan baru → catat di `BRAINSTORMING.md` atau `ARCHITECTURE.md`.
7. Lapor singkat: apa yang dibuat, cara mengecek, task berikutnya.

Aturan: jangan menambah fitur di luar task; jika task terasa terlalu besar, pecah dan tanyakan ke user.
