---
name: driving-claude
description: Run and supervise Claude Code from Codex for delegated tasks, reviews, second opinions, parallel workers, or resumed Claude sessions. Use for requests to ask or delegate work to Claude; use prompting-claude for prompt design and migration research without a Claude run.
---

# Driving Claude

You own the outcome: choose the invocation, inspect the result, verify claims and changes, and continue authorized work when necessary.

## Invocation contract

Resolve the plugin root two directories above this file. Use an absolute runner path and explicitly set the task directory:

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox <ro|write|full> \
  --cd <target-repo> [flags] -- <prompt>
```

Schema and scratch paths resolve from the caller's directory, not `--cd`; use absolute paths. Preserve pre-existing changes. `--scratch` is a parent folder; the runner creates a unique child for each invocation. Retain the printed artifact paths.

The runner invokes `claude -p --output-format json`, buffers output, and prints a bounded summary plus paths to the full result, final message, and stderr. It exits successfully only for a successful terminal result; schema runs also require Claude Code's `structured_output` field. Read the full message artifact when the summary is truncated. See [flag-map.md](references/flag-map.md) for the exact CLI mapping and limitations.

Use the host's background-process support for long runs; poll process status without killing slow work. A silent runner is not evidence of a hang. If the host blocks network or execution, follow that host's approval path, not a broader Claude permission tier.

## Select controls

| Decision | Rule |
|---|---|
| Permission tier | `ro` for review/research, `write` for authorized edits, `full` only when the user explicitly authorized bypassing Claude permissions. Do not ask again if that authorization is already clear. |
| Model | Preserve user choice/configuration. For deliberate selection, load the prompting reference. Pin a full ID for reproducible comparisons; aliases can change or be overridden. |
| Effort | Supports `low`, `medium`, `high`, `xhigh`, `max`; leave configured when appropriate. Opus 5.5 starts at `medium`, Fable 5.1 at `high`. Use higher levels when evidence supports the cost. |
| Schema | Use `--schema <absolute-file>` when consuming structured fields. Keep reports proportionate; schemas do not validate the truth of claims. |
| Budget | `--budget <usd>` limits Claude Code's tracked spend; `--max-turns <n>` bounds turns. Neither proves task completion. Track cumulative spend across workers and resumes; allocate each new cap from the remaining task budget. Never silently reset or raise a user budget. |
| Persistence | `--ephemeral` for disposable probes; otherwise retain the returned session ID and target directory. |
| Tools | `--tools` selects built-ins; it does not remove MCP tools. `--allow` auto-approves matching tools; `--deny` adds deny rules. |
| MCP | Reuse only relevant servers. `--strict-mcp-config` uses only explicitly supplied MCP configs; pair with `--tools ""` for no built-ins or MCP servers. |
| Parallel writes | Prefer isolated worktrees. Otherwise assign disjoint files and avoid overlapping formatters, generated output, lockfiles, or Git operations. |
| Passthrough | `--raw <arg>` passes each token verbatim. It can override runner choices; inspect effects before use. Interactive and stdin-driven modes do not work through this runner. |

The name `--sandbox` is historical: these are Claude permission presets, not OS isolation. `ro` selects default permission mode, denies direct file edit tools, and pre-approves selected shell/read operations. Shell prefixes, inherited settings, hooks, MCP, extra allow rules, and raw flags can still permit effects. For a genuinely isolated review, use host-level read-only execution or provide captured source/diffs to a no-tools run. Do not promise that a permission preset prevents every write.

`--bare` is optional minimal startup, not isolation. It skips automatic discovery but can load explicit settings/plugins/MCP and skills from `--add-dir`; on the Anthropic API it requires API-key authentication rather than subscription OAuth. Do not add it blindly to a working login.

## Results and continuation

1. Read exit status, terminal subtype, errors, permission denials, and artifacts. Read `run.json` for lifecycle status, cwd, and safe launch context. Retain required runtime options omitted from that record without copying credentials.
2. For schema runs, parse `last-message.txt` only after success. Missing `structured_output` is failure; fenced prose is diagnostic data, not a validated result. The runner relies on Claude Code's schema validation; validate additional application constraints before acting.
3. Inspect `modelUsage` in `result.json` for models that actually served the session. A requested model or a model's self-description does not establish attribution; multiple models alone do not establish the reason for fallback.
4. Verify findings against current files. After edits, inspect the diff and relevant test evidence. Run any missing checks; avoid repeating already adequate checks without cause.
5. Compare the result to the user's complete task. Resume specific unfinished work when authorized; do not declare completion from `status: completed` alone. Bound corrective resumes and report a concrete blocker when progress stops.

## Failure routing

| Evidence | Next action |
|---|---|
| Missing/malformed terminal result or nonzero exit | Inspect stderr and result artifacts; do not treat partial output as success. |
| `error_max_structured_output_retries` or missing structured output | Inspect the workspace before retrying. Work may have happened. Recover only the report with the same session and bounded output; see `claude-structured-output`. |
| Permission denials | Identify the exact blocked operation. Keep read-only work read-only; use captured evidence or a narrowly authorized tool. Change to `write` only if the user authorized the mutation. |
| Auth/billing/rate-limit failure | Diagnose that failure; changing models is not a general remedy. Use `claude-setup` for auth/install problems. |
| Capacity/model availability failure | Retry within the task budget or use an authorized `--fallback-model` chain. State model changes and inspect usage. |
| Budget/turn limit | Report completed and remaining work. Narrow the task or resume only within the user's authorized limits. |

## Related workflows

- `claude-task`: one delegated task.
- `claude-review`: findings against a specific diff in the correct repository.
- `claude-session`: resume/fork and restore launch configuration.
- `claude-fleet`: independent workers and synthesis.
- `claude-structured-output`: schema contracts and report recovery.
- `claude-setup`: version, authentication, and a bounded smoke probe.

Detached background/cloud sessions use a different lifecycle from the runner. Use them only when the task calls for detached or remote execution, verify current CLI support, and report the returned ID and management command. Starting one is not completing its task.
