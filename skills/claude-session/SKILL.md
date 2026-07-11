---
name: claude-session
description: List, resume, or fork Claude Code sessions started through this plugin. Invoke explicitly with $claude-session, or use when the user wants to continue, check, or branch a previous Claude run.
---

# Claude sessions

Claude Code persists sessions per working directory under
`~/.claude/projects/<slugified-cwd>/*.jsonl`, where the slug is the
absolute cwd path with `/` and `.` replaced by `-` (e.g.
`/Users/x/proj` → `-Users-x-proj`). The filename (minus `.jsonl`) is
the session id.

- **List recent sessions** for a directory:

```bash
ls -t ~/.claude/projects/<slug>/*.jsonl | head -5
```

  To label them, peek at each file's first user message (JSONL; look
  for the first line whose `type` is `"user"`).

- **Resume** (same working directory as the original run, from the
  plugin root):

```bash
node scripts/claude-run.mjs --sandbox <tier> --resume <session-id> -- <delta instruction>
```

  Send only the delta — the session retains full context. `--resume
  last` continues the most recent session in the current directory.

- **Fork** (branch off without touching the original): add `--fork` to
  a resume. The runner prints the new session id.

- Sessions created with `--ephemeral` were never persisted and cannot
  be resumed.

- Sandbox tier is per-run, not per-session: you can resume a `ro`
  review session with `--sandbox write` to let Claude apply the fix it
  proposed.
