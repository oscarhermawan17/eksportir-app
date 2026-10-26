# Project context — BaliTrade

Konteks utama project ada di `AGENTS.md` (dipakai bersama oleh semua AI assistant: Kiro, Claude Code, Codex/ChatGPT, dll.).
File ini sengaja dibuat pendek agar tidak ada dua sumber yang bisa berbeda. Update status & aturan di `AGENTS.md`, bukan di sini.

#[[file:AGENTS.md]]

Urutan baca saat membuka sesi baru: `AGENTS.md` → `TASKS.md` (kerjakan task pertama yang belum dicentang) → `ARCHITECTURE.md` →
`BRAINSTORMING.md` → `UI_PROMPT.md` (untuk UI) → `docs/DECISIONS.md`.

Skill project (`.kiro/skills/`): `nestjs`, `nextjs`, `prisma-postgres`, `typescript` (konvensi kode), `next-task` (alur kerja: ambil task →
kerjakan → cek DoD → centang). Indeksnya ada di `docs/CONVENTIONS.md`.

Ringkasan aturan (detail di `AGENTS.md`): komunikasi dengan user dalam Bahasa Indonesia; kode, commit, dan teks UI default dalam bahasa Inggris;
hanya kerjakan scope task; langkah kecil; jangan commit kecuali diminta, tanpa trailer "Co-authored-by", jangan commit `.env`.
