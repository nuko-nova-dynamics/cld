# Changelog

## 0.3.0 (2026-09-23)

- Refresh all eight agent skills against current Anthropic prompting, model migration, and Claude Code documentation. Add dated Opus 5.5, Fable 5.1, and Sonnet 5 guidance with source links and evaluation rules.
- Make the target working directory explicit, restore required launch flags on resume, and distinguish completed turns from completed tasks. Replace automatic permission escalation and blanket maximum-effort guidance.
- Correct permission and bare-mode claims. Read-only presets now select default mode and deny direct file-edit tools; remove broad git-branch and find allowances. These presets remain distinct from OS isolation.
- Require a successful terminal result and canonical structured output for schema runs. Preserve diagnostic prose without promoting fenced JSON, report actual model usage, bound console output, replace stale artifacts, and retain spawn errors.
- Forward SIGINT/SIGTERM to Claude, force shutdown after five seconds, and save available artifacts with a failed outcome after interruption. Preserve split UTF-8 output and tolerate malformed cost/denial metadata.
- Add eleven offline runner regression tests and bounded live probes. Integration checks do not establish comparative model quality.

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

## 0.2.0 (2026-07-11)

- Hidden-flag research pass against the official CLI reference
  (code.claude.com/docs/en/cli-reference — which confirms `--help` is
  incomplete), the env-vars reference, and a strings-dump of the
  2.1.207 binary. Flag map rebuilt: `--max-turns` (now a runner flag,
  verified live), `--advisor`, `--cloud`/`--teleport`,
  `--bg --exec`, `--init`/`--init-only`/`--maintenance`,
  `--append-subagent-system-prompt`, `--permission-prompt-tool`,
  background-session subcommands, key env vars, and a
  present-in-binary-but-undocumented list.
- driving-claude: Background & cloud section (`--bg`, `claude agents`,
  `--cloud`, `--teleport`).
- prompting-claude deepened with three reference files: prompt blocks,
  end-to-end recipes, and anti-patterns (Claude-tuned).
- Plugin directory assets: logo + composer icon.

## 0.2.1 (2026-07-11)

- Field-hardening from the first real-world failure (174-turn, $70
  write run): Claude Code's StructuredOutput validation can wrongly
  reject large payloads (`structured_output_retry_exhausted` while the
  work itself completed). Runner now prints a recovery hint on that
  subtype, salvages fenced JSON when a "successful" schema run lacks
  `structured_output`, and gains `--schema-retries`
  (MAX_STRUCTURED_OUTPUT_RETRIES). Skills document the bounded-payload
  rule, the verified `--tools ""` recovery recipe, resume-cost warning
  on huge sessions, and mid-run model auto-fallback attribution.

## 0.2.2 (2026-08-08)

- Publish through the shared Nuko Nova marketplace instead of an embedded
  self-marketplace.
- Add a Nuko Nova Dynamics copyright notice.
- Document the unrestricted access granted by `--sandbox full` and recommend
  the narrower read-only and workspace-write tiers for ordinary work.
