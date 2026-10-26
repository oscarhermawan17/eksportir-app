# Conventions index

The convention guides are plain Markdown files that any AI model (or human) can read. They live in `.kiro/skills/` because Kiro
loads them from there; `.claude/skills` is a symlink to the same folder for Claude Code. **Edit them in `.kiro/skills/` only.**
(They are written in Indonesian with English code examples; the rules apply regardless of the assistant you use.)

| Guide | File | Read before |
|---|---|---|
| Next-task workflow (pick the next unticked task, do it, check the DoD, tick it) | `.kiro/skills/next-task/SKILL.md` | Starting any task |
| NestJS (`apps/api`): modules, DTOs, guards/RBAC, Prisma, WebSocket | `.kiro/skills/nestjs/SKILL.md` | Backend code |
| Next.js (`apps/web`): App Router, next-intl, Tailwind tokens, API calls, accessibility | `.kiro/skills/nextjs/SKILL.md` | Frontend code |
| Prisma + PostgreSQL: naming, migrations, money/rates, transactions, seed | `.kiro/skills/prisma-postgres/SKILL.md` | Touching `schema.prisma` or queries |
| TypeScript rules shared by web, api and shared | `.kiro/skills/typescript/SKILL.md` | Any TypeScript |

## How to use the "next task" workflow with any assistant

Tell the assistant: *"Follow `.kiro/skills/next-task/SKILL.md`"* (optionally with a task id, e.g. T11). In Claude Code it is also
available as the `next-task` skill. The steps are: read `TASKS.md` → read the relevant part of `ARCHITECTURE.md` (and `UI_PROMPT.md`
for UI) → apply the matching convention guides → give a short plan → implement in small steps → run lint/typecheck/build/tests →
tick the task only if its DoD is verified → record decisions → report briefly.

## Assistant-specific files (all point to the same content)

| Assistant | File it reads | Notes |
|---|---|---|
| Claude Code | `CLAUDE.md` (imports `AGENTS.md`) + `.claude/skills` | |
| Codex CLI / ChatGPT, Cursor, Copilot agents and others | `AGENTS.md` | Open standard; no extra setup |
| Kiro | `.kiro/steering/project-context.md` (includes `AGENTS.md`) + `.kiro/skills` | Keep these files; do not delete |
| Gemini CLI | `GEMINI.md` if present, otherwise say "read AGENTS.md first" | Not set up |

Keep the project knowledge in `AGENTS.md`, `ARCHITECTURE.md`, `BRAINSTORMING.md`, `TASKS.md` and `docs/`; keep the assistant-specific
files tiny and pointing at them, so nothing drifts.
