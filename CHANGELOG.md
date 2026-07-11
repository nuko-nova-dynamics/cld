# Changelog

## 0.1.0 (2026-07-11)

- Initial release: Codex plugin that orchestrates Claude Code.
- Runner `scripts/claude-run.mjs` wrapping `claude -p --output-format
  json` with sandbox tiers (ro/write/full), model/effort control,
  schema-backed structured output, resume/fork/session-id, budget cap,
  fallback models, agents, MCP config, worktrees, and a `--raw`
  verbatim passthrough for the rest of the `claude` surface.
- Skills: driving-claude (+ verified flag map), claude-task,
  claude-review, claude-fleet, claude-session, claude-setup,
  prompting-claude, claude-structured-output.
- Bundled schemas: review-findings, verdict, task-report, patch-plan
  (strict-mode compatible, shared shape with cdx).
- Verified against Claude Code 2.1.207 and codex-cli 0.144.0.
