---
name: claude-structured-output
description: Request and consume schema-backed Claude Code results with the bundled runner. Use for machine-parsed findings, verdicts, plans, task reports, or recovery when a final structured report fails.
---

# Structured Claude results

`--schema <absolute-path>` parses a JSON Schema file and passes it to Claude Code's `--json-schema`. Claude Code validates the output; the runner requires a successful terminal result and a non-null `structured_output` field. It writes that field to `last-message.txt`. It does not run a separate JSON Schema validator.

## Select a contract

| Bundled schema | Purpose | Required fields |
|---|---|---|
| `review-findings.schema.json` | Verified code findings | `overall`, `findings` with file, nullable line, severity, summary, failure scenario |
| `verdict.schema.json` | Assess one claim | `claim`, `verdict`, `evidence`, nullable `confidence` |
| `task-report.schema.json` | Report completed work and gaps | `summary`, `files_changed`, `commands_run`, `risks`, `follow_ups` |
| `patch-plan.schema.json` | Describe proposed changes | `steps` with file, change, nullable rationale; nullable `notes` |

Schemas live under `<plugin-root>/schemas/`. The caller should parse the full artifact, not the console excerpt, which can be truncated. Verify substantive claims and application constraints before acting.

For an ad-hoc schema, keep its nesting and report length proportional to what the caller needs. Use categorical enums, descriptive fields, explicit required keys, and `additionalProperties: false`. Claude Code's schema support differs from the direct API's grammar-constrained `output_config.format`; do not assume arbitrary JSON Schema keywords are enforced. The CLI treats `format` as annotation, so validate dates, URLs, and other domain constraints in the consumer when correctness depends on them.

## Recover a report without replaying the task

On `error_max_structured_output_retries`, missing `structured_output`, or other failure:

1. Inspect the terminal result, stderr, workspace diff, and relevant artifacts. Report failure does not establish whether the underlying work finished.
2. If the task work is complete and the session persists, request only a smaller report in the same project and with required launch configuration restored:

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox ro \
  --cd <original-project> --resume <session-id> \
  --tools "" --strict-mcp-config --schema <absolute-schema> \
  -- "Return the report for work already performed. Do not repeat the task. Keep entries concise and mark anything you could not verify."
```

3. Try report recovery once, then reassess the failure. Do not automatically increase retries or repeat an expensive mutating task. `--schema-retries <positive-integer>` is available when evidence supports a different retry budget.
4. If recovery still fails, retain prose as diagnostic output and report the structured contract as failed. Do not promote fenced JSON to validated output.

`--tools ""` disables built-in tools; `--strict-mcp-config` without supplied configs removes MCP servers. Claude Code still owns its structured-output mechanism. Avoid saying this forces a text-only response or disables every hook or configuration effect.

A large-report failure was observed on Claude Code 2.1.207 in this project's July history. Treat it as historical evidence, not proof that the same upstream defect exists on the installed version.

Sources checked 2026-09-23: [CLI schema contract](https://code.claude.com/docs/en/cli-reference), [programmatic results](https://code.claude.com/docs/en/headless), [direct API structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
