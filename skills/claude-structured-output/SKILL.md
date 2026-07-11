---
name: claude-structured-output
description: Get machine-readable JSON out of Claude runs using --schema — pick a bundled schema (review-findings, verdict, task-report, patch-plan) or author an ad-hoc one. Use when a Claude result should be parsed and acted on rather than read as prose.
---

# Structured output from Claude

The runner's `--schema <path>` flag reads a JSON Schema file and passes
it to `claude --json-schema`, forcing the final result to validate
against it. The validated object arrives in the result's
`structured_output` field; the runner prints it as the final message
and writes it to the `last-message.txt` artifact.

## Bundled schemas (`schemas/` under the plugin root)

| Schema | Use for | Shape |
|---|---|---|
| `review-findings.schema.json` | code review | `{overall, findings[]: {file, line?, severity, summary, failure_scenario}}` |
| `verdict.schema.json` | fact-check a claim | `{claim, verdict: confirmed\|refuted\|uncertain, evidence, confidence?}` |
| `task-report.schema.json` | report after a mutating task | `{summary, files_changed[], commands_run[]?, risks[]?, follow_ups[]?}` |
| `patch-plan.schema.json` | plan before edits | `{steps[]: {file, change, rationale?}, notes?}` |

## Ad-hoc schemas

Write the schema to a scratch file, then pass its path. Claude's
`--json-schema` accepts standard JSON Schema (it does not require
OpenAI strict mode), but keep schemas disciplined anyway — they double
as the output contract:

- `additionalProperties: false` at every object level.
- Prefer listing every key in `required`; express optionality with
  nullable types (`"type": ["string", "null"]`).
- Keep nesting shallow — arrays of flat objects.
- Use `enum` for anything categorical.
- Describe fields with `description` — Claude reads them.

Keeping schemas strict-compatible means the same files work for both
this plugin and its Codex-side mirror (cdx).

## Parsing

Parse the final message as JSON. On parse failure treat the run as
failed and retry once, appending "Return ONLY the JSON object." to the
prompt.

Always verify substantive claims in parsed output against the repo
before acting — schema conformance is not truth.
