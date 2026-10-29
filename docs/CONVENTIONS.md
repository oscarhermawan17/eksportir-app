# Conventions index

The convention guides are plain Markdown files (`SKILL.md`) in `.claude/skills/`; Claude Code loads them as skills and any other AI
model or human can read them as ordinary files. **Edit them there only.** (They are written in Indonesian with English code examples;
the rules apply regardless of the assistant you use.)

| Guide | File | Read before |
|---|---|---|
| Next-task workflow (pick the next unticked task, do it, check the DoD, tick it) | `.claude/skills/next-task/SKILL.md` | Starting any task |
| NestJS (`apps/api`): modules, DTOs, guards/RBAC, Prisma, WebSocket | `.claude/skills/nestjs/SKILL.md` | Backend code |
| Next.js (`apps/web`): App Router, next-intl, Tailwind tokens, API calls, accessibility | `.claude/skills/nextjs/SKILL.md` | Frontend code |
| Prisma + PostgreSQL: naming, migrations, money/rates, transactions, seed | `.claude/skills/prisma-postgres/SKILL.md` | Touching `schema.prisma` or queries |
| TypeScript rules shared by web, api and shared | `.claude/skills/typescript/SKILL.md` | Any TypeScript |
| Frontend design (third-party, `anthropics/skills`, installed 2026-10-30; version pinned in `skills-lock.json`) | `.claude/skills/frontend-design/SKILL.md` | Building or fixing the look of a page |

**`frontend-design` is advisory.** The BaliTrade design system (`design-ui/google-stitch/01-v4.html`, tokens in
`apps/web/src/app/globals.css`) is the brief and always wins: keep the palette, Plus Jakarta Sans, the 12px radius and Lucide icons even
where the skill calls them "default" looks. Use the skill for what the system leaves open: hierarchy, spacing, alignment, responsive
layout, empty/error states, keyboard focus, and plain-language copy (see also "Catatan implementasi" in `UI_PROMPT.md`).

## How to use the "next task" workflow

Tell the assistant: *"Follow `.claude/skills/next-task/SKILL.md`"* (optionally with a task id, e.g. T13). In Claude Code it is also
available as the `next-task` skill. The steps are: read `TASKS.md` → read the relevant part of `ARCHITECTURE.md` (and `UI_PROMPT.md`
for UI) → apply the matching convention guides → give a short plan → implement in small steps → run lint/typecheck/build/tests →
tick the task only if its DoD is verified → record decisions → report briefly.

## Where an assistant starts reading

| Assistant | File it reads |
|---|---|
| Claude Code | `CLAUDE.md` (imports `AGENTS.md`) + `.claude/skills` |
| Codex CLI / ChatGPT, Cursor, Copilot agents and others | `AGENTS.md` (open standard; no extra setup) |

Keep the project knowledge in `AGENTS.md`, `ARCHITECTURE.md`, `BRAINSTORMING.md`, `TASKS.md` and `docs/`; keep `CLAUDE.md` tiny and
pointing at them, so nothing drifts.
