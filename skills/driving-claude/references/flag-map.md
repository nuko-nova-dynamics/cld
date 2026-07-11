# Claude Code CLI flag map — verified against Claude Code 2.1.207 (2026-07-11)

Sources: `claude --help`, the official CLI reference
(code.claude.com/docs/en/cli-reference — which states outright that
`--help` does not list every flag), the env-vars reference
(code.claude.com/docs/en/env-vars), and a strings-dump of the 2.1.207
binary. Flags marked **[hidden]** are absent from `--help` but
documented and/or verified live.

Runner flags map to these. Anything not wrapped can be passed with
`--raw <arg>` (repeatable, verbatim passthrough placed before the
prompt) or by calling `claude` directly.

## Core headless invocation (runner always sets)

| Flag | Notes |
|---|---|
| `-p, --print` | non-interactive; prints and exits. Skips the workspace trust dialog — only run in trusted directories |
| `--output-format json` | single result object on stdout: `type, subtype, is_error, result, structured_output, session_id, num_turns, usage, total_cost_usd, permission_denials, modelUsage, duration_ms, stop_reason, ...` (field list verified live) |

## Permissions (runner `--sandbox ro|write|full`)

| Flag | Notes |
|---|---|
| `--allowedTools <tools...>` | ro: read-only shell whitelist + WebFetch/WebSearch (Read/Grep/Glob need no permission in -p mode); write: `Bash,WebFetch,WebSearch`. Runner `--allow <tools>` merges extras into the tier list. Rule syntax: `Bash(git diff:*)` scopes a tool |
| `--permission-mode <default\|acceptEdits\|plan\|auto\|dontAsk\|bypassPermissions\|manual>` | write tier sets `acceptEdits`. `manual` = alias for `default` (v2.1.200+). Other modes via `--raw` |
| `--dangerously-skip-permissions` | full tier ≡ `--permission-mode bypassPermissions`. Never outside explicit user intent |
| `--allow-dangerously-skip-permissions` | adds bypass to the mode cycle without starting in it — `--raw` only |
| `--disallowedTools <tools...>` | runner `--deny`. Bare name (`"Edit"`, `"*"`, `"mcp__*"`) removes the tool from the model's context entirely; scoped rule (`Bash(rm *)`) only denies matching calls |
| `--tools <list\|""\|default>` | restrict the built-in tool SET; does NOT affect MCP tools (deny those with `--deny "mcp__*"` or `--strict-mcp-config` with no `--mcp-config`); runner `--tools` |
| `--permission-prompt-tool <mcp-tool>` | **[hidden]** MCP tool that adjudicates permission prompts in -p mode (the programmatic alternative to our tiers). Since v2.1.199 it cannot approve MCP tools marked as requiring user interaction |

## Model & effort

| Flag | Notes |
|---|---|
| `--model <alias\|full-name>` | runner `--model`; aliases `fable`, `opus`, `sonnet`, `haiku` (avoid haiku), or full ids like `claude-fable-5`. Overrides `ANTHROPIC_MODEL` and settings |
| `--effort <low\|medium\|high\|xhigh\|max\|ultracode>` | runner `--effort`; `ultracode` (v2.1.203+) = xhigh + ultracode multi-agent mode — expensive, only on explicit user request |
| `--fallback-model <m,...>` | runner `--fallback-model`; comma list tried in order on overload/retired-model (print-only) |
| `--advisor <opus\|sonnet\|fable\|full-id>` | **[hidden]** server-side advisor tool for the session (v2.1.98+) — `--raw` |
| `--betas <betas...>` | runner `--betas`; API-key users only |

## Cost & turn control

| Flag | Notes |
|---|---|
| `--max-budget-usd <amount>` | runner `--budget`; hard dollar cap (print-only) |
| `--max-turns <n>` | **[hidden]** runner `--max-turns`; cap agentic turns, exits with error at the limit (print-only). Verified live on 2.1.207 |

## Sessions

| Flag | Notes |
|---|---|
| `-r, --resume <uuid\|name>` | runner `--resume <id>`; accepts session *names* too. Per working directory (+ its git worktrees) |
| `-c, --continue` | most recent session in cwd; runner `--resume last` |
| `--fork-session` | runner `--fork` (requires resume); new session id, original untouched |
| `--session-id <uuid>` | runner `--session-id`; pin a v4 UUID up front |
| `-n, --name <name>` | runner `--name`; names work as resume targets |
| `--no-session-persistence` | runner `--ephemeral`; unresumable (print-only) |
| `--from-pr <n\|url>` | resume sessions linked to a PR (GitHub/GitLab/Bitbucket) — `--raw` |

On disk: `~/.claude/projects/<cwd-slug>/<session-id>.jsonl` (slug =
absolute path with `/` and `.` → `-`).

## Background agents & cloud (the Claude-side "fleet/cloud" surface)

| Flag / command | Notes |
|---|---|
| `--bg, --background` | detached background session; prints session id + management commands. NOT combinable with `-p` — bypasses the runner contract, use deliberately |
| `--bg --exec '<cmd>'` | **[hidden]** run a shell command as a PTY-backed background job |
| `claude agents [--json] [--cwd <path>] [--all]` | list/monitor background sessions (`--json` for scripting) |
| `claude attach <id>` / `claude logs <id>` / `claude stop <id>` / `claude respawn <id>` / `claude rm <id>` | manage background sessions from the shell |
| `claude daemon status` / `claude daemon stop --any [--keep-workers]` | background-session supervisor diagnostics/recovery |
| `--cloud "<task>"` | **[hidden]** create a Claude Code web session on claude.ai with the task (`--remote` is a deprecated alias) |
| `--teleport` | **[hidden]** resume a claude.ai web session in the local terminal |
| `--teammate-mode <in-process\|auto\|tmux\|iterm2>` | **[hidden]** agent-teams display mode — interactive concern, `--raw` |

## Output contracts

| Flag | Notes |
|---|---|
| `--json-schema <inline-json>` | runner `--schema <file>` reads/validates/minifies the file and passes it inline. Result lands in `structured_output`. Invalid schemas error since v2.1.205; `format` keyword is annotation-only. `MAX_STRUCTURED_OUTPUT_RETRIES` env controls validation-failure retries |

## Workspace & context

| Flag | Notes |
|---|---|
| `--add-dir <dirs...>` | runner `--add-dir`; grants file access only — `.claude/` config is NOT discovered from those dirs |
| *(spawn cwd)* | runner `--cd <dir>`; claude has no cd flag — the runner sets the child process cwd |
| `-w, --worktree <name\|#PR\|PR-url>` | runner `--worktree`; isolated git worktree at `<repo>/.claude/worktrees/<name>`; accepts a PR number/URL to branch from it |
| `--system-prompt <s>` / `--system-prompt-file <f>` | replace the ENTIRE default prompt (mutually exclusive with each other; drops tool guidance + safety — you own what remains); runner `--system-prompt`, file variant via `--raw` |
| `--append-system-prompt <s>` / `--append-system-prompt-file <f>` | append, keeping the default prompt; runner `--append-system-prompt`, file variant via `--raw` |
| `--append-subagent-system-prompt <s>` | **[hidden]** append to every subagent's system prompt, -p only, v2.1.205+ — `--raw` |
| `--settings <file-or-json>` | runner `--settings`; overrides matching keys for the session |
| `--setting-sources <user,project,local>` | runner `--setting-sources` |
| `--agent <name>` | runner `--agent`; run as a configured agent |
| `--agents <json>` | runner `--agents`; ad-hoc subagents (same fields as subagent frontmatter + `prompt`) |
| `--file <id:path...>` | download file resources at startup — `--raw` |

## MCP

| Flag | Notes |
|---|---|
| `--mcp-config <file-or-json...>` | runner `--mcp-config` (repeatable) |
| `--strict-mcp-config` | runner `--strict-mcp-config`; ONLY servers from `--mcp-config` |
| `claude mcp login/logout <name>` | headless-friendly MCP OAuth (v2.1.186+) |

## Hooks & lifecycle (print mode; all `--raw`)

| Flag | Notes |
|---|---|
| `--init` / `--maintenance` | **[hidden]** run Setup hooks with the `init`/`maintenance` matcher before the session (-p only) |
| `--init-only` | **[hidden]** run Setup + SessionStart hooks, then exit |

## Isolation / hygiene (all `--raw`)

| Flag | Notes |
|---|---|
| `--bare` | minimal mode: no hooks/skills/plugins/MCP/CLAUDE.md auto-discovery; fastest scripted startup; auth strictly `ANTHROPIC_API_KEY` |
| `--safe-mode` | all customizations off, normal auth (differs from `--bare`) |
| `--plugin-dir <path>` / `--plugin-url <url>` | load a Claude plugin for this session only (`--plugin-dir-no-mcp` variant exists in the binary) |
| `--disable-slash-commands` | disable all skills/commands |
| `--no-chrome` | disable Chrome integration |
| `--exclude-dynamic-system-prompt-sections` | move per-machine prompt sections into the first user message for cross-machine cache reuse (-p workloads) |
| `--verbose`, `-d, --debug [filter]`, `--debug-file <path>` | diagnostics. NOTE: `--verbose` with `-p --output-format json` switches stdout to an ARRAY of messages — the runner handles it |

## Streaming & advanced I/O (all `--raw`)

| Flag | Notes |
|---|---|
| `--output-format stream-json` | JSONL events; final line is the result object (runner's fallback parser copes), prefer plain `json` |
| `--include-partial-messages` / `--include-hook-events` / `--prompt-suggestions` | stream-json extras (some also need `--verbose`) |
| `--input-format stream-json` / `--replay-user-messages` | streaming stdin protocols; not usable through the runner (stdin is ignored) |
| `--json-schema` + `--tools ""` | pure-inference structured extraction with no tool use |

## Interactive-only / not applicable in -p mode

`--ide`, `--tmux`, `--remote-control`/`--rc`,
`--remote-control-session-name-prefix`, `--chrome`, `--brief`,
`--ax-screen-reader`, `--channels`,
`--dangerously-load-development-channels`, `--teammate-mode`.
Removed: `--enable-auto-mode` (v2.1.111; use `--permission-mode auto`).

## In the binary but undocumented (observed in 2.1.207 strings; use with care)

`--max-thinking-tokens` (prefer `CLAUDE_CODE_MAX_THINKING_TOKENS` env),
`--plugin-dir-no-mcp`, `--parent-session-id`, `--session-mirror`,
`--resume-session-at`, `--reply-on-resume`, `--create-session-in-dir`,
`--prefill` / `--prefill-b64`, `--plan-mode-instructions` /
`--plan-mode-required`, `--autocompact`, `--thinking` /
`--thinking-display`, `--task-budget`, `--team-name`, `--cowork`,
`--sdk-url`, `--managed-settings`. These are internal/unstable —
document-only; don't build on them.

## Relevant subcommands

| Command | Notes |
|---|---|
| `claude doctor` | read-only install/settings diagnostics (claude-setup skill) |
| `claude auth login/logout/status` | auth management; `status` exits 0/1 — good for health checks |
| `claude setup-token` | long-lived OAuth token for CI/scripts (subscription required) |
| `claude mcp` | manage MCP servers; `claude mcp serve` runs Claude Code itself as an MCP server |
| `claude plugin` | manage Claude-side plugins |
| `claude project purge [path] [--dry-run]` | delete local project state |
| `claude update` / `claude install <ver>` | self-update / pin version |
| `claude ultrareview [target] [--json] [--timeout <min>]` | cloud multi-agent review — billed; only on explicit user request |

## Environment (docs: code.claude.com/docs/en/env-vars)

| Variable | Notes |
|---|---|
| `CLD_CLAUDE_BIN` | (runner's own) override the `claude` binary the runner spawns |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | direct API auth / default model |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | cap output tokens |
| `CLAUDE_CODE_MAX_THINKING_TOKENS` | extended-thinking budget override (prefer `--effort`) |
| `MAX_STRUCTURED_OUTPUT_RETRIES` | retries when `--json-schema` validation fails |
| `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE` | force transcript persistence in nested sessions (relevant: Codex-spawned claude counts as nested if markers leak through) |
| `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` | max wait for background tasks in -p mode |
| `BASH_MAX_TIMEOUT_MS` / `BASH_MAX_OUTPUT_LENGTH` | Bash tool limits inside Claude |
| `API_TIMEOUT_MS` | API request timeout |
| `CLAUDE_EFFORT` | env form of `--effort` |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | any-mode equivalent of `--no-session-persistence` |
