# cld: Claude for Codex

Codex delegates tasks to Claude Code through a bundled Node runner, then checks the results. The skills are instructions for the calling agent: choose controls, run Claude in the right project, inspect artifacts, verify the work, and resume when needed.

The inverse of [cdx](https://github.com/nuko-nova-dynamics/cdx), which lets Claude Code drive Codex.

## Skills

| Skill | Use |
|---|---|
| `driving-claude` | Invocation, controls, results, failure routing |
| `claude-task` | One delegated task |
| `claude-review` | Findings against a specific diff |
| `claude-fleet` | Independent workers and synthesis |
| `claude-session` | Resume, fork, and restore launch configuration |
| `claude-setup` | Diagnose installation, auth, and runner failures |
| `prompting-claude` | Compose prompts and select model-specific guidance |
| `claude-structured-output` | Consume schema results and recover failed reports |

Use `$claude-review` in Codex or describe the task, such as “get Claude's opinion on this diff.” The [model reference](skills/prompting-claude/references/models-and-migration.md) covers Opus 5.5, Fable 5.1, Sonnet 5, and direct API migration. Its recommendations are dated and distinct from measured results.

## Requirements and installation

- Authenticated [Claude Code](https://code.claude.com/docs/en/setup) on PATH. This refresh inspected version 2.1.280.
- Node.js for the runner and tests.
- Codex with plugin support.

Install from the Nuko Nova marketplace:

```bash
codex plugin marketplace add nuko-nova-dynamics/marketplace
codex plugin add cld@nuko-nova-tools
```

For an existing installation, refresh the catalog first with `codex plugin marketplace upgrade nuko-nova-tools`, then run the add command. Open a new Codex task after updating so its skills reload.

## Runner contract

```bash
node /path/to/cld/scripts/claude-run.mjs --sandbox ro \
  --cd /path/to/target-repo \
  --schema /path/to/cld/schemas/review-findings.schema.json \
  -- "Review the current diff for actionable defects. Do not edit. Cite source evidence."
```

The runner prints status, session ID, model usage, token/cost estimates, permission denials, and a bounded final-message excerpt. Full result JSON, final message, and stderr remain in scratch artifacts. Exit zero requires a successful terminal result; `--schema` also requires Claude Code's `structured_output`. The runner relies on Claude Code for schema validation and does not treat JSON recovered from prose as validated.

| Preset | Behavior |
|---|---|
| `ro` | Default permission mode, direct file-edit tools denied, selected read/shell operations pre-approved |
| `write` | File edits accepted and shell pre-approved |
| `full` | Claude permission bypass, requiring explicit user authorization |

The historical `--sandbox` name describes permission presets, not filesystem isolation. Inherited configuration, hooks, shell operations, MCP servers, extra allowances, and raw flags affect what can run. See the [flag map](skills/driving-claude/references/flag-map.md) before extending permissions.

Use absolute runner/schema paths and an explicit target `--cd`. On resume, restore required launch flags. Output is buffered until Claude exits; the runner does not stream progress. SIGINT and SIGTERM are forwarded to Claude, with forced shutdown after five seconds. Interrupted runs exit nonzero and save available artifacts. POSIX cancellation targets the owned process group; Windows cancellation targets the direct child. Give every concurrent run a unique scratch directory.

## Verification

```bash
node --test tests/runner.test.mjs
node tests/smoke.mjs
```

Offline tests use a mock CLI and cover terminal results, schema presence, failure propagation, permission arguments, artifacts, and truncation. Live smoke tests consume account usage, run plain/schema/verbose probes, and preserve their artifacts. Each probe sets a $0.50 Claude Code budget and a five-turn limit; those controls are not billing guarantees. To probe a specific model:

```bash
CLD_SMOKE_MODEL=claude-opus-5-5 node tests/smoke.mjs
```

The [September research record](docs/research-2026-09-23.md) lists sources, decisions, and validation limits.

## License

Apache-2.0
