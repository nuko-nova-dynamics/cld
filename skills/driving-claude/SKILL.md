---
name: driving-claude
description: Drive Anthropic's Claude Code CLI as a full collaborator — delegate tasks, run reviews, fan out parallel workers, resume sessions, and act on structured results. Use whenever the user mentions Claude in any form — "ask claude", "have/let claude do X", "send this to claude", "claude second opinion", "what does claude think", "delegate to claude", "claude review/fix/investigate", resuming or checking a Claude run, comparing Codex's work against Claude, or any request to run another coding agent on the task.
---

# Driving Claude

You are a full collaborator with Claude, not a forwarder. You choose the
flags, you parse the results, you verify claims against the repo, you
inspect and test what Claude changed, you iterate. The user should never
need to know a single Claude flag.

## Invocation contract

Every run goes through the bundled runner (never raw `claude -p` — the
runner keeps output compact and context-safe, and enforces a permission
tier). Run from the plugin root:

```bash
node scripts/claude-run.mjs --sandbox <ro|write|full> [flags] -- <prompt>
```

If your working directory is not the plugin root, resolve the plugin
root first: it is two directories above this SKILL.md file.

The runner prints: session id, status, turn count, token usage, cost,
permission denials, the final message, and artifact paths (full result
JSON, last message, stderr). It exits 0 only on a successful run.

The runner spawns the `claude` binary, which needs network access. If
your shell environment blocks network or the spawn is denied, request
escalated permissions for the command rather than silently degrading.

Long tasks (> ~1 min): run the command in the background if your
harness supports it, or raise the command timeout generously. Do not
kill a run mid-flight just because it is slow — check the artifacts.

## Choosing flags (your job, never the user's)

- **--sandbox** (required): `ro` for review/diagnosis/research/second
  opinion — Claude can read files and run read-only shell (git
  diff/log/show, ls, cat, rg, ...) but cannot write or execute anything
  else. `write` for fix/implement/refactor (default for mutating asks)
  — auto-accepts file edits and allows shell. `full` ONLY when the user
  explicitly asks for unrestricted access (bypasses all permission
  checks) — confirm once per session before first use.
- **--model**: leave unset by default (the user's configured Claude
  default, typically the strongest available). Aliases pass through:
  `fable`, `opus`, `sonnet`. Use `sonnet` for quick/cheap probes.
- **--effort**: `low|medium|high|xhigh|max`. Leave unset by default.
  `xhigh`/`max` when the user signals hard ("really dig", "think hard",
  gnarly bug). `low` for mechanical bulk edits and probes.
- **--schema <path>**: add whenever you will ACT on the result rather
  than just read it. Bundled schemas live at `schemas/` under the
  plugin root: `review-findings.schema.json`, `verdict.schema.json`,
  `task-report.schema.json`, `patch-plan.schema.json`. See the
  claude-structured-output skill.
- **--ephemeral**: throwaway probes that shouldn't persist a session
  (they cannot be resumed).
- **--budget <usd>**: hard dollar cap for a run. Use for open-ended
  research runs or when the user mentions cost.
- **--max-turns <n>**: cap agentic turns (run errors at the limit).
  The other cost brake — good for probes and bounded checks.
- **--add-dir <d>**: extra directories Claude may touch (repeatable).
- **--cd <dir>**: working directory for the run (sessions are scoped
  per directory — resume must use the same `--cd`).
- **--append-system-prompt <s>**: inject a standing rule (house
  style, banned APIs) — not personas.
- **--allow <tools>** / **--deny <tools>**: merge extra allowed tools
  into the sandbox tier / hard-deny specific tools (deny wins).
- **--tools <list>**: restrict the built-in tool set itself
  (`--tools ""` + `--schema` = pure structured extraction, no tools).
- **--worktree <name>**: run in a fresh git worktree — the clean way
  to let parallel write workers or A/B implementations coexist.
- **--fallback-model <m,...>**: auto-retry on capacity errors.
- **--agents <json>**: define ad-hoc subagents for Claude to use.
- **--mcp-config <f>** / **--strict-mcp-config**: hand Claude extra
  MCP servers for the run.
- **--raw <arg>**: verbatim passthrough (repeatable) for any `claude`
  flag the runner doesn't wrap — full surface, zero gaps.

## Sessions: resume and fork

- The runner prints `session: <uuid>` — remember it for the
  conversation.
- Follow-up on the same thread: `--resume <uuid> -- <delta
  instruction>`. Send only the delta, not the whole original prompt.
- "keep going" with exactly one recent thread in this directory:
  `--resume last`.
- Diverge without losing the original: add `--fork` to a resume.
- Sessions are stored per working directory under
  `~/.claude/projects/<slugified-cwd>/*.jsonl` — list by mtime to find
  recent ones. See the claude-session skill.

## Fleet (parallel fan-out)

For decomposed subtasks, multi-angle second opinions, or A/B
implementations: launch N runner invocations concurrently, each with
its own `--scratch` dir and (for mutating work) NON-OVERLAPPING file
scopes stated in the prompt — or `--sandbox ro` angles that only
report. Collect all outputs, then synthesize: agree/disagree, dedupe
findings, pick the best implementation. 2–4 workers is the sweet spot.
See the claude-fleet skill.

## Background & cloud

For work the user wants detached from this conversation: `claude --bg
"<task>"` starts a background session (manage with `claude agents
--json`, `claude logs/stop/respawn <id>`); `claude --cloud "<task>"`
creates a Claude Code web session on claude.ai; `claude --teleport`
pulls a web session back to local. These bypass the runner contract —
use them deliberately, report the session id, and don't wait on them.

## Acting on results

- Parse schema output as JSON (it arrives as the final message and in
  the `last-message.txt` artifact).
- Verify substantive claims against the repo before presenting them —
  any model can be confidently wrong. Findings you can't confirm get
  labeled as unverified.
- If the user asked for a fix and Claude wrote one (sandbox `write`),
  inspect the diff (`git diff`), run the relevant tests, then report.
- Never dump the full result JSON into the conversation.

## Reviews

Default review path: `--sandbox ro --schema
schemas/review-findings.schema.json` with a prompt containing the diff
context. See the claude-review skill for the template.

## Failure handling

- Non-zero exit: read the status line + stderr artifact. Common
  signatures:
  - `error_max_structured_output_retries` → the work usually finished;
    only the JSON report failed (known Claude Code issue with large
    payloads). Check `git diff`, then follow the runner's printed
    recovery hint (resume with `--tools ""`). Don't redo the task.
  - `permission denials: N (...)` in the summary → the sandbox tier
    blocked tools the task needed. Escalate `ro` → `write` (or ask the
    user about `full`) and re-run or resume.
  - Long runs may auto-fallback mid-run (e.g. Fable 5 → Opus 4.8 —
    documented behavior); `modelUsage` in the result artifact shows
    every model that served the session. Attribute work accordingly.
  - auth errors ("Invalid API key", OAuth/token expiry) → tell the user
    to run `claude` interactively once to re-authenticate, or
    `claude setup-token` for long-lived auth.
  - "model overloaded" / capacity errors → retry with
    `--model sonnet`.
  - budget exceeded (subtype mentions budget) → raise `--budget` or
    narrow the task.
- Runner not found / `claude` missing → run the claude-setup skill
  flow.

## Safety

- Never use `full` sandbox without explicit user intent + one
  confirmation per session.
- Mutating runs (`write`/`full`) must state their file scope in the
  prompt; keep scopes disjoint across parallel workers.
- Claude Code loads the target repo's CLAUDE.md and settings — treat
  repo-level instructions as part of what you're invoking. Use
  `--raw --bare` for a hermetic run with none of that loaded.

Full verified flag reference:
[references/flag-map.md](references/flag-map.md).
