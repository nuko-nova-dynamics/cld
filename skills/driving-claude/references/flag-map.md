# Claude Code CLI flag map

Checked against local `claude --version` **2.1.280** on 2026-09-23 and the [official CLI reference](https://code.claude.com/docs/en/cli-reference). The runner is `scripts/claude-run.mjs`. It always starts `claude -p --output-format json` and requires `--sandbox ro|write|full`. Use `--cd <target repo>` for repository work and resume in that same directory.

`claude --help` omits some documented flags. The tables distinguish runner options from Claude flags. `--raw <arg>` passes one argument through before the prompt; repeat it for a flag and its value. Do not use `--raw` to replace the runner's print/output contract or to request interactive or stdin streaming modes. The runner closes child stdin.

## Output and result

| Runner | Claude flag | Contract |
| --- | --- | --- |
| Always set | `-p --output-format json` | One non-interactive result. The runner records `result.json`, `last-message.txt`, `stdout.log`, `stderr.log`, and `run.json` in an isolated run directory. |
| `--schema <file>` | `--json-schema <inline JSON>` | Claude puts schema output in `structured_output`. A successful runner exit requires a `result` message with `subtype: "success"` and this field present. Prose in `result` is diagnostic, not schema output. |
| `--schema-retries <n>` | `MAX_STRUCTURED_OUTPUT_RETRIES` environment variable | Sets the retry budget for structured output. Inspect changed files before retrying a run whose final report failed. |
| `--scratch <dir>` | Runner only | Selects a parent folder; each call creates a unique `cld-run-*` child. Follow the reported artifact paths. |
| `--raw --verbose` | `--verbose` | Claude may emit an array of messages instead of one object. The runner selects the terminal `result` message. |

The runner reports `modelUsage` names when present. Use that field to attribute a run; `--model` alone does not prove which model served every request. JSON cost totals are [client-side estimates](https://code.claude.com/docs/en/headless#get-structured-output), and a resumed conversation's total can include earlier runs.

## Permissions

| Runner tier or option | Claude flags | Meaning |
| --- | --- | --- |
| `--sandbox ro` | `--permission-mode manual`, a narrow `--allowedTools` list, and `--disallowedTools Write,Edit,NotebookEdit` | Best-effort review mode. The named shell commands and web tools are pre-approved; edits through built-in file tools are denied. This is not OS isolation. |
| `--sandbox write` | `--permission-mode acceptEdits` plus `--allowedTools Bash,WebFetch,WebSearch` | Auto-accepts file edits and shell commands. Scope the requested edits in the prompt. |
| `--sandbox full` | `--dangerously-skip-permissions` | Starts `bypassPermissions`. Use only within the user's authorization. |
| `--allow <rules>` | Extends `--allowedTools` | Pre-approves matching tools. It can widen any tier, including `ro`; do not treat the tier name as a guarantee after adding rules. |
| `--deny <rules>` | `--disallowedTools` | Blocks matching tools. A bare tool name removes it from context; a scoped rule blocks matching calls. |
| `--tools <names>` | `--tools` | Restricts **built-in** tool availability. It does not remove MCP tools; use `--deny "mcp__*"` when needed. |

[Permission rules](https://code.claude.com/docs/en/permissions#permission-rule-syntax) decide which calls run without a prompt. `--allowedTools` does not restrict the tool set. Shell patterns match command text, so even a narrow prefix is not a filesystem or process boundary. Existing settings, hooks, MCP tools, and explicit `--raw` options can affect a run. For unattended calls, `--raw --permission-prompts --raw none` denies prompts that nobody can answer; it does not revoke pre-approved tools. Claude Code 2.1.280 also has [`--restricted`](https://code.claude.com/docs/en/cli-reference#cli-flags), which ignores user/project/local settings, limits file tools to working directories, and removes command/code tools unless individually re-enabled. The runner does not set it by default.

## Model, effort, and cost

| Runner | Claude flag | Contract |
| --- | --- | --- |
| `--model <alias\|id>` | `--model` | Selects a model for this launch. The current documented aliases include `default`, `best`, `fable`, `opus`, `sonnet`, and `haiku`; aliases change with version, provider, and settings. |
| `--effort low\|medium\|high\|xhigh\|max` | `--effort` | These five levels are accepted by the runner. Claude also documents `ultracode`, which enables workflow orchestration at `xhigh`; pass that through `--raw` only when intentionally requested. Model and policy limits may lower the effective effort. |
| `--fallback-model <m,...>` | `--fallback-model` | Tries up to three distinct fallbacks on overload, unavailability, or another non-retryable server error, then retries the primary at the next user turn. Auth, billing, rate limit, request-size, and transport failures do not trigger it. |
| `--budget <usd>` | `--max-budget-usd` | Stops further API calls after the print-mode budget is reached. Subagent spend counts; earlier resumed-session spend does not count toward the new cap. |
| `--max-turns <n>` | `--max-turns` | Limits agentic turns in print mode and exits with an error when reached. |
| `--betas <values>` | `--betas` | API key users only. |

The current [model configuration](https://code.claude.com/docs/en/model-config#model-aliases) says `fable` resolves to Fable 5.1 where available, while `opus` resolves to Opus 5.5 on the Anthropic API with Claude Code 2.1.280. Provider deployment IDs and organization settings can differ. `CLAUDE_CODE_EFFORT_LEVEL` is the documented environment override for effort; `CLAUDE_EFFORT` is not the current documented name. See [effort precedence](https://code.claude.com/docs/en/model-config#adjust-effort-level).

## Sessions

| Runner | Claude flag | Contract |
| --- | --- | --- |
| `--resume <id\|name>` | `--resume` | Resumes a named or identified conversation. Pass `--cd <original project>` for the right working context. |
| `--resume last` | `--continue` | Continues the most recent conversation for the child process's working directory. In print mode it can include earlier print/SDK sessions. |
| `--fork` | `--fork-session` | With resume, creates a new session ID and leaves the original transcript intact. |
| `--session-id <uuid>` | `--session-id` | Chooses a UUID for a new conversation. |
| `--name <name>` | `--name` | Display name; an exact name can be a resume target. |
| `--ephemeral` | `--no-session-persistence` | Does not save a resumable transcript. |
| `--cd <dir>` | Spawn cwd | Sets Claude's working directory; Claude has no `--cd` flag. |

On [resume](https://code.claude.com/docs/en/sessions#resume-a-session), pass launch-only dependencies again: `--mcp-config`, `--settings`, `--plugin-dir`, `--fallback-model`, and `--add-dir` are not restored. Standard settings files are re-read. The CLI may restore a previous model, while a new `--model` overrides it. For print-mode resume, the runner supplies a fresh permission tier.

## Workspace, agents, and configuration

| Runner | Claude flag | Contract |
| --- | --- | --- |
| `--add-dir <dir>` | `--add-dir` | Grants access to another directory. It does not auto-discover most of that directory's `.claude/` configuration. |
| `--worktree <name>` | `--worktree` | Starts Claude in an isolated Git worktree. |
| `--agent <name>` / `--agents <json>` | Same flags | Selects a configured agent or defines [CLI subagents](https://code.claude.com/docs/en/sub-agents#cli-configuration). Claude validates `--agents` JSON at startup. |
| `--mcp-config <file-or-json>` | Same flag | Loads an MCP server configuration. Repeat for several. |
| `--strict-mcp-config` | Same flag | Loads only MCP servers named by `--mcp-config`. |
| `--settings <file-or-json>` | Same flag | Applies additional settings for this launch. |
| `--setting-sources <sources>` | Same flag | Chooses user, project, or local setting sources. Managed settings may still apply. |
| `--append-system-prompt <text>` | Same flag | Keeps Claude Code's default system prompt. |
| `--system-prompt <text>` | Same flag | Replaces the default prompt, including its tool guidance and safety instructions. |

`--raw --bare` turns off automatic loading of hooks, most skills, custom agents, plugins, MCP servers, auto memory, and CLAUDE.md. It still loads skills from directories passed with `--add-dir`, and explicitly supplied settings, MCP servers, agents, or plugins can load. [Bare mode](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode) does not read Anthropic OAuth or keychain credentials: it needs `ANTHROPIC_API_KEY` or an `apiKeyHelper` supplied through `--settings`. Third-party providers use their own credentials. Bare mode still has built-in Bash and file tools.

## Other documented CLI routes

These run outside the runner's `-p` contract:

| Command | Use |
| --- | --- |
| `claude --bg "<task>"`, `claude agents --json`, `claude attach/logs/stop/respawn/rm <id>` | Start and manage local background sessions. `--bg` cannot be combined with `-p`. |
| `claude --cloud "<task>"`, `claude --teleport [session]` | Create a cloud session or bring one back locally. |
| `claude doctor`, `claude auth status` | Read installation/settings diagnostics and authentication status. `auth status` returns JSON and exits 0 when signed in, 1 otherwise. |
| `claude mcp login/logout <name>` | Manage OAuth for configured MCP servers. |

Primary references: [CLI reference](https://code.claude.com/docs/en/cli-reference), [programmatic use](https://code.claude.com/docs/en/headless), [permissions](https://code.claude.com/docs/en/permissions), [models and effort](https://code.claude.com/docs/en/model-config), [sessions](https://code.claude.com/docs/en/sessions), [subagents](https://code.claude.com/docs/en/sub-agents).
