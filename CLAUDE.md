@AGENTS.md

## Claude Code notes

- Everything you need is in `AGENTS.md` (imported above). Read `TASKS.md` next.
- Skills (convention guides + the `next-task` workflow) live in `.kiro/skills/*/SKILL.md`; `.claude/skills` is a symlink to that
  folder so both Kiro and Claude Code use the same files. Edit them in `.kiro/skills`, never duplicate them.
- Use plan mode for tasks that touch many files; keep steps small (a few files at a time).
