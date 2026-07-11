# Claude Code CLI flag map — verified against Claude Code 2.1.207 (2026-07-11)

Runner flags map to these. Anything not wrapped by the runner can be
passed with `--raw <arg>` (repeatable, verbatim passthrough placed
before the prompt) or by calling `claude` directly.

## Core headless invocation (runner always sets)

| Flag | Notes |
|---|---|
| `-p, --print` | non-interactive; prints and exits. Skips the workspace trust dialog — only run in trusted directories |
| `--output-format json` | single result object on stdout: `type, subtype, is_error, result, structured_output, session_id, num_turns, usage, total_cost_usd, permission_denials, modelUsage, duration_ms, stop_reason, ...` (field list verified live) |

## Permissions (runner `--sandbox ro|write|full`)

| Flag | Notes |
|---|---|
| `--allowedTools <tools...>` | ro: read-only shell whitelist + WebFetch/WebSearch (Read/Grep/Glob need no permission in -p mode); write: `Bash,WebFetch,WebSearch`. Runner `--allow <tools>` merges extras into the tier list. Syntax: `Bash(git diff:*)` scopes a tool |
| `--permission-mode <acceptEdits\|auto\|bypassPermissions\|manual\|dontAsk\|plan>` | write tier sets `acceptEdits`. Other modes via `--raw` |
| `--dangerously-skip-permissions` | full tier. Never outside explicit user intent |
| `--allow-dangerously-skip-permissions` | enables bypass as an *option* without defaulting to it — `--raw` only |
| `--disallowedTools <tools...>` | runner `--deny`; deny wins over allow; ignored under full's bypass |
| `--tools <list\|""\|default>` | restrict the built-in tool SET itself (stronger than permissions); runner `--tools` |

## Model & effort

| Flag | Notes |
|---|---|
| `--model <alias\|full-name>` | runner `--model`; native aliases `fable`, `opus`, `sonnet` (haiku exists; avoid), or full ids like `claude-fable-5` |
| `--effort <low\|medium\|high\|xhigh\|max>` | runner `--effort` |
| `--fallback-model <m,...>` | runner `--fallback-model`; comma list, tried in order when primary is overloaded (print-only) |
| `--betas <betas...>` | runner `--betas`; API-key users only |

## Sessions

| Flag | Notes |
|---|---|
| `-r, --resume <uuid>` | runner `--resume <uuid>`. Sessions are per working directory — resume from the same `--cd` |
| `-c, --continue` | most recent session in cwd; runner `--resume last` |
| `--fork-session` | runner `--fork` (requires resume); new session id, original untouched |
| `--session-id <uuid>` | runner `--session-id`; pin a specific (valid v4 UUID) id up front |
| `-n, --name <name>` | runner `--name`; label shown in pickers |
| `--no-session-persistence` | runner `--ephemeral`; unresumable (print-only) |
| `--from-pr <n\|url>` | resume the session linked to a PR — `--raw` only |

On disk: `~/.claude/projects/<cwd-slug>/<session-id>.jsonl` (slug =
absolute path with `/` and `.` → `-`).

## Output contracts & cost

| Flag | Notes |
|---|---|
| `--json-schema <inline-json>` | runner `--schema <file>` reads/validates/minifies the file and passes it inline. Result lands in `structured_output` |
| `--max-budget-usd <amount>` | runner `--budget`; hard dollar cap (print-only) |

## Workspace & context

| Flag | Notes |
|---|---|
| `--add-dir <dirs...>` | runner `--add-dir` (repeatable) |
| *(spawn cwd)* | runner `--cd <dir>`; claude has no cd flag — the runner sets the child process cwd |
| `-w, --worktree <name>` | runner `--worktree`; fresh git worktree for the run (good for A/B fleet implementations) |
| `--system-prompt <s>` / `--append-system-prompt <s>` | runner `--system-prompt` / `--append-system-prompt`; `--system-prompt-file` / `--append-system-prompt-file` variants via `--raw` |
| `--settings <file-or-json>` | runner `--settings`; extra settings layer |
| `--setting-sources <user,project,local>` | runner `--setting-sources`; which settings files load |
| `--agent <name>` | runner `--agent`; run as a named configured agent |
| `--agents <json>` | runner `--agents`; define ad-hoc subagents for the session, e.g. `{"reviewer":{"description":"...","prompt":"..."}}` |
| `--file <id:path...>` | download file resources at startup — `--raw` only |

## MCP

| Flag | Notes |
|---|---|
| `--mcp-config <file-or-json...>` | runner `--mcp-config` (repeatable); give Claude extra MCP servers for the run |
| `--strict-mcp-config` | runner `--strict-mcp-config`; ONLY the servers from `--mcp-config` |

## Isolation / hygiene (all `--raw`)

| Flag | Notes |
|---|---|
| `--bare` | minimal mode: no hooks, plugins, CLAUDE.md auto-discovery, keychain; auth strictly `ANTHROPIC_API_KEY` |
| `--safe-mode` | all customizations disabled; normal auth |
| `--plugin-dir <path>` / `--plugin-url <url>` | load a Claude plugin for this session only |
| `--disable-slash-commands` | disable all skills |
| `--no-chrome` | disable Chrome integration |
| `--verbose`, `-d, --debug [filter]`, `--debug-file <path>` | diagnostics; debug output goes to stderr artifact |

## Streaming & advanced I/O (all `--raw`; runner parsing tolerates them)

| Flag | Notes |
|---|---|
| `--output-format stream-json` | JSONL events; the final line is the result object (runner's fallback parser picks it up), but prefer plain `json` |
| `--include-partial-messages` / `--include-hook-events` | stream-json only |
| `--input-format stream-json` / `--replay-user-messages` | streaming stdin protocols; not usable through the runner (stdin is ignored) |
| `--json-schema` + `--tools ""` | pure-inference structured extraction with no tool use |
| `--bg, --background` | detached background agent; manage with `claude agents` — bypasses the runner contract, use only deliberately |
| `--max-budget-usd`, `--fallback-model`, `--no-session-persistence` | print-only flags, listed above |

## Interactive-only / not applicable in -p mode

`--ide`, `--tmux`, `--remote-control`, `--remote-control-session-name-prefix`,
`--chrome`, `--brief`, `--prompt-suggestions`, `--ax-screen-reader`,
`--exclude-dynamic-system-prompt-sections` (cache optimization, harmless),
`--fast` (not a flag; fast mode is the in-session `/fast` toggle).

## Relevant subcommands

| Command | Notes |
|---|---|
| `claude doctor` | health check (used by claude-setup skill) |
| `claude setup-token` | long-lived headless auth token (requires subscription) |
| `claude agents` | manage `--bg` background agents |
| `claude mcp` | manage MCP servers; `claude mcp serve` runs Claude Code itself as an MCP server |
| `claude plugin` | manage Claude-side plugins |
| `claude update` | self-update |
| `claude ultrareview [target]` | cloud multi-agent review of a branch/PR — billed; only on explicit user request |

## Environment

| Variable | Notes |
|---|---|
| `CLD_CLAUDE_BIN` | override the `claude` binary the runner spawns |
| `ANTHROPIC_API_KEY` | direct API auth (otherwise OAuth/keychain from interactive login) |
| `MAX_THINKING_TOKENS` | legacy thinking-budget override; prefer `--effort` |
