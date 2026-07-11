# cld — Claude for Codex

Full-surface Claude Code integration for Codex: delegate, review, fan
out, resume, and act on structured Claude results. Codex drives the
`claude` CLI directly through a context-safe bundled runner — no
middleman runtime.

The inverse of [cdx](https://github.com/nuko-nova-dynamics/cdx) (which
lets Claude Code drive Codex).

## What you get

| Skill | Purpose |
|---|---|
| `driving-claude` | The brain: invocation contract, flag heuristics, sessions, fleet, verification. Auto-triggers on any "ask/have/let Claude…" request |
| `claude-task` | Delegate one task with full flag control |
| `claude-review` | Schema-backed code review with verified findings |
| `claude-fleet` | 2–4 parallel Claude workers (decomposition, angles, A/B) |
| `claude-session` | List, resume, fork Claude sessions |
| `claude-setup` | Health-check install/auth/runner |
| `prompting-claude` | How to prompt Claude models well |
| `claude-structured-output` | `--schema` patterns + bundled schemas |

Invoke explicitly with `$` in Codex (e.g. `$claude-review`) or just
describe the task ("get a second opinion from Claude on this diff").

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI installed and
  authenticated (`claude` on PATH; run it once interactively to log
  in). Verified against Claude Code 2.1.207.
- Node.js (for the bundled runner).
- Codex ≥ 0.144 / ChatGPT desktop app with plugins.

## Install

### ChatGPT desktop app (personal marketplace)

Add this repo as a marketplace and install:

```bash
codex plugin marketplace add /path/to/cld   # or: codex plugin marketplace add nuko-nova-dynamics/cld
codex plugin add cld@cld
```

Then restart the ChatGPT desktop app; `cld` appears under **Plugins**.
Bundled skills load in new Codex chats and CLI sessions.

## How it works

Every delegation goes through `scripts/claude-run.mjs`, which wraps
`claude -p --output-format json` and prints a compact summary (session
id, status, tokens, cost, permission denials, final message) plus
artifact paths for the full result. Permission tiers:

| Tier | Claude permissions |
|---|---|
| `--sandbox ro` | read files + read-only shell (git diff/log/…, ls, cat, rg) + web; nothing else |
| `--sandbox write` | auto-accepted file edits + shell |
| `--sandbox full` | `--dangerously-skip-permissions` (explicit user intent only) |

Structured output: `--schema <file>` forces the result to validate
against a JSON Schema (bundled: review-findings, verdict, task-report,
patch-plan). Any `claude` flag the runner doesn't wrap passes through
verbatim with `--raw <arg>`. Full verified reference:
[skills/driving-claude/references/flag-map.md](skills/driving-claude/references/flag-map.md).

## Smoke test

```bash
node tests/smoke.mjs   # runs 3 cheap live probes against claude (costs a few cents)
```

## License

Apache-2.0
