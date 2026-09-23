#!/usr/bin/env node
// cld runner: composes `claude -p --output-format json`, tees the full result
// object to a scratch file, and prints a compact context-safe summary.
// Contract: exit 0 only for a terminal success result with a zero process exit.
import { readFileSync } from "node:fs";
import path from "node:path";
import { executeRun } from "./run-execution.mjs";

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const FINAL_MESSAGE_LIMIT = 6000;
// ro permits common read tools, uses default permission mode, and denies edit
// tools. Bash allow patterns are not filesystem isolation.
const RO_ALLOWED_TOOLS = [
  "WebFetch",
  "WebSearch",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git show:*)",
  "Bash(git status:*)",
  "Bash(git blame:*)",
  "Bash(ls:*)",
  "Bash(cat:*)",
  "Bash(rg:*)",
  "Bash(grep:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
].join(",");

function die(msg) {
  process.stderr.write(`claude-run: ${msg}\n`);
  process.stderr.write(
    "usage: claude-run.mjs --sandbox <ro|write|full> [--model <m>] [--effort <low|medium|high|xhigh|max>] " +
      "[--schema <path>] [--schema-retries <n>] [--resume <id|last>] [--fork] [--session-id <uuid>] [--name <s>] " +
      "[--ephemeral] [--budget <usd>] [--max-turns <n>] [--fallback-model <m,...>] " +
      "[--agent <name>] [--agents <json>] [--tools <list>] [--allow <tools>] [--deny <tools>] " +
      "[--mcp-config <f-or-json>]... [--strict-mcp-config] [--betas <b,...>] " +
      "[--add-dir <d>]... [--cd <dir>] [--worktree <name>] " +
      "[--system-prompt <s>] [--append-system-prompt <s>] [--settings <file-or-json>] " +
      "[--setting-sources <s,...>] [--raw <arg>]... [--scratch <dir>] -- <prompt...>\n"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const o = { addDirs: [], mcpConfigs: [], raw: [], promptParts: [] };
  let i = 0;
  let afterDashes = false;
  const next = (flag) => {
    i += 1;
    if (i >= argv.length) die(`${flag} requires a value`);
    return argv[i];
  };
  while (i < argv.length) {
    const a = argv[i];
    if (afterDashes) {
      o.promptParts.push(a);
    } else if (a === "--") {
      afterDashes = true;
    } else if (a === "--sandbox") {
      o.sandbox = next(a);
    } else if (a === "--model") {
      o.model = next(a);
    } else if (a === "--effort") {
      o.effort = next(a);
    } else if (a === "--schema") {
      o.schema = next(a);
    } else if (a === "--schema-retries") {
      o.schemaRetries = next(a);
    } else if (a === "--resume") {
      o.resume = next(a);
    } else if (a === "--fork") {
      o.fork = true;
    } else if (a === "--session-id") {
      o.sessionId = next(a);
    } else if (a === "--name") {
      o.name = next(a);
    } else if (a === "--ephemeral") {
      o.ephemeral = true;
    } else if (a === "--budget") {
      o.budget = next(a);
    } else if (a === "--max-turns") {
      o.maxTurns = next(a);
    } else if (a === "--fallback-model") {
      o.fallbackModel = next(a);
    } else if (a === "--agent") {
      o.agent = next(a);
    } else if (a === "--agents") {
      o.agents = next(a);
    } else if (a === "--tools") {
      o.tools = next(a);
    } else if (a === "--allow") {
      o.allow = next(a);
    } else if (a === "--deny") {
      o.deny = next(a);
    } else if (a === "--mcp-config") {
      o.mcpConfigs.push(next(a));
    } else if (a === "--strict-mcp-config") {
      o.strictMcpConfig = true;
    } else if (a === "--betas") {
      o.betas = next(a);
    } else if (a === "--add-dir") {
      o.addDirs.push(next(a));
    } else if (a === "--cd") {
      o.cd = next(a);
    } else if (a === "--worktree") {
      o.worktree = next(a);
    } else if (a === "--system-prompt") {
      o.systemPrompt = next(a);
    } else if (a === "--append-system-prompt") {
      o.appendSystemPrompt = next(a);
    } else if (a === "--settings") {
      o.settings = next(a);
    } else if (a === "--setting-sources") {
      o.settingSources = next(a);
    } else if (a === "--raw") {
      o.raw.push(next(a));
    } else if (a === "--scratch") {
      o.scratch = next(a);
    } else if (a.startsWith("-")) {
      die(`unknown flag: ${a} (use --raw <arg> to pass anything verbatim to claude)`);
    } else {
      o.promptParts.push(a);
    }
    i += 1;
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.sandbox) die("--sandbox is required (ro|write|full)");
if (!["ro", "write", "full"].includes(opts.sandbox)) die(`invalid --sandbox: ${opts.sandbox}`);
if (opts.effort && !EFFORTS.has(opts.effort)) die(`invalid --effort: ${opts.effort}`);
if (opts.budget != null && !(Number.isFinite(Number(opts.budget)) && Number(opts.budget) > 0)) {
  die(`invalid --budget: ${opts.budget}`);
}
for (const [flag, value] of [["--max-turns", opts.maxTurns], ["--schema-retries", opts.schemaRetries]]) {
  if (value != null && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
    die(`invalid ${flag}: ${value}`);
  }
}
if (opts.ephemeral && opts.resume) die("--ephemeral cannot be used with --resume");
const prompt = opts.promptParts.join(" ").trim();
if (!prompt) die("a prompt is required (resume also needs a delta instruction)");

const argv = ["-p", "--output-format", "json"];

// Sandbox tiers (claude has no sandbox flag; permissions are the control):
//   ro    -> default permission mode with common read tools and edit denials
//   write -> auto-accept file edits, unrestricted shell
//   full  -> bypass all permission checks (explicit user intent required)
// --allow merges extra allowedTools into the tier's list; --deny always maps
// to --disallowedTools. These presets are not OS isolation.
if (opts.sandbox === "ro") {
  argv.push("--permission-mode", "manual");
  argv.push("--allowedTools", opts.allow ? `${RO_ALLOWED_TOOLS},${opts.allow}` : RO_ALLOWED_TOOLS);
} else if (opts.sandbox === "write") {
  argv.push("--permission-mode", "acceptEdits");
  const writeAllowed = "Bash,WebFetch,WebSearch";
  argv.push("--allowedTools", opts.allow ? `${writeAllowed},${opts.allow}` : writeAllowed);
} else {
  argv.push("--dangerously-skip-permissions");
}
const deniedTools = [opts.sandbox === "ro" ? "Write,Edit,NotebookEdit" : null, opts.deny].filter(Boolean).join(",");
if (deniedTools) argv.push("--disallowedTools", deniedTools);
if (opts.tools != null) argv.push("--tools", opts.tools);

if (opts.resume) {
  // `--resume last` means "most recent session in this directory" -> --continue
  if (opts.resume === "last") argv.push("--continue");
  else argv.push("--resume", opts.resume);
  if (opts.fork) argv.push("--fork-session");
} else if (opts.fork) {
  die("--fork requires --resume");
}

if (opts.model) argv.push("--model", opts.model);
if (opts.effort) argv.push("--effort", opts.effort);
if (opts.sessionId) argv.push("--session-id", opts.sessionId);
if (opts.name) argv.push("--name", opts.name);
if (opts.ephemeral) argv.push("--no-session-persistence");
if (opts.budget) argv.push("--max-budget-usd", opts.budget);
if (opts.maxTurns) argv.push("--max-turns", opts.maxTurns);
if (opts.fallbackModel) argv.push("--fallback-model", opts.fallbackModel);
if (opts.agent) argv.push("--agent", opts.agent);
if (opts.agents) argv.push("--agents", opts.agents);
for (const m of opts.mcpConfigs) argv.push("--mcp-config", m);
if (opts.strictMcpConfig) argv.push("--strict-mcp-config");
if (opts.betas) argv.push("--betas", opts.betas);
for (const d of opts.addDirs) argv.push("--add-dir", d);
if (opts.worktree) argv.push("--worktree", opts.worktree);
if (opts.systemPrompt) argv.push("--system-prompt", opts.systemPrompt);
if (opts.appendSystemPrompt) argv.push("--append-system-prompt", opts.appendSystemPrompt);
if (opts.settings) argv.push("--settings", opts.settings);
if (opts.settingSources) argv.push("--setting-sources", opts.settingSources);
for (const r of opts.raw) argv.push(r);

if (opts.schema) {
  // --json-schema takes inline JSON; parse and minify the file.
  let schemaRaw;
  try {
    schemaRaw = readFileSync(opts.schema, "utf8");
  } catch (err) {
    die(`cannot read --schema file ${opts.schema}: ${err.message}`);
  }
  let schemaObj;
  try {
    schemaObj = JSON.parse(schemaRaw);
  } catch (err) {
    die(`--schema file is not valid JSON: ${err.message}`);
  }
  argv.push("--json-schema", JSON.stringify(schemaObj));
}

argv.push(prompt);

const bin = process.env.CLD_CLAUDE_BIN || "claude";
const childEnv = { ...process.env };
if (opts.schemaRetries) childEnv.MAX_STRUCTURED_OUTPUT_RETRIES = opts.schemaRetries;
const context = {
  model: opts.model ?? null,
  effort: opts.effort ?? null,
  sandbox: opts.sandbox,
  sessionSelection: opts.resume === "last" ? "resume-last" : opts.resume ? "resume-id-or-name"
    : opts.sessionId ? "new-session-id" : "new",
  ephemeral: Boolean(opts.ephemeral),
  budgetUsd: opts.budget == null ? null : Number(opts.budget),
  maxTurns: opts.maxTurns == null ? null : Number(opts.maxTurns),
  hasRawFlags: opts.raw.length > 0,
  hasSettings: Boolean(opts.settings || opts.settingSources),
  hasMcpConfig: opts.mcpConfigs.length > 0,
  hasStrictMcpConfig: Boolean(opts.strictMcpConfig),
  hasSystemPrompt: Boolean(opts.systemPrompt || opts.appendSystemPrompt),
  hasAdditionalDirs: opts.addDirs.length > 0,
  hasCustomToolSelection: opts.tools != null,
  hasPermissionOverrides: Boolean(opts.allow || opts.deny),
  hasFallbackModel: Boolean(opts.fallbackModel),
  hasAgentConfig: Boolean(opts.agent || opts.agents),
  hasWorktree: Boolean(opts.worktree),
  hasBetas: Boolean(opts.betas),
  hasSessionName: Boolean(opts.name),
  hasSchemaRetries: Boolean(opts.schemaRetries),
};

let outcome;
try {
  outcome = await executeRun({
    bin, argv, cwd: path.resolve(opts.cd || process.cwd()), env: childEnv,
    scratchParent: opts.scratch, context, schemaRequested: Boolean(opts.schema),
    onStart: ({ recordPath }) => process.stderr.write(`claude-run: run record: ${recordPath}\n`),
  });
} catch (err) {
  process.stderr.write(`claude-run: execution failed: ${err.message}\n`);
  process.exitCode = 1;
}

if (outcome) {
  const { ok, result, finalMsg, exitCode, interruptedBy, hasStructuredOutput,
    outputTooLarge, artifactError, spawnError, stderrTail,
    runDir, resultPath, messagePath, stdoutPath, stderrPath, recordPath } = outcome;
  const lines = [];
  lines.push(`session: ${result?.session_id ?? "unknown"}`);
  lines.push(
    `status: ${ok ? `completed (${result?.subtype ?? "success"})` : `failed (exit ${exitCode}${result?.subtype ? `, ${result.subtype}` : ""})`}`
  );
  if (interruptedBy) lines.push(`interrupted: ${interruptedBy}`);
  if (result?.num_turns != null) lines.push(`turns: ${result.num_turns}`);
  if (result?.modelUsage && typeof result.modelUsage === "object") {
    const models = Object.keys(result.modelUsage);
    if (models.length) lines.push(`models: ${models.join(", ")}`);
  }
  if (result?.usage) {
    const u = result.usage;
    const cached = (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    lines.push(`tokens: input=${u.input_tokens ?? 0} cached=${cached} output=${u.output_tokens ?? 0}`);
  }
  if (Number.isFinite(result?.total_cost_usd)) lines.push(`cost: $${result.total_cost_usd.toFixed(4)}`);
  const denials = result?.permission_denials;
  if (Array.isArray(denials) && denials.length > 0) {
    const names = [...new Set(denials.map((d) => typeof d?.tool_name === "string" && d.tool_name ? d.tool_name : "unknown"))].join(", ");
    lines.push(`permission denials: ${denials.length} (${names}); inspect the blocked operations and task authorization before changing permissions`);
  }
  if (opts.schema && !hasStructuredOutput) lines.push("note: structured_output missing from terminal result");
  if (outputTooLarge) lines.push("note: stdout exceeded the 16 MiB parse limit; the complete output is in stdout.log");
  if (artifactError) lines.push(`note: ${artifactError.channel} artifact write failed: ${artifactError.message}`);
  if (spawnError) lines.push(`note: failed to spawn ${bin}: ${spawnError.message}`);
  if (result?.subtype === "error_max_structured_output_retries") {
    lines.push(
      "note: structured output failed; inspect workspace changes before repeating any task work."
    );
    lines.push(
      opts.ephemeral
        ? "note: this ephemeral run cannot be resumed; recover from inspected artifacts in a new report-only run."
        : `recover the report: --cd <original-project> --resume ${result?.session_id ?? "<id>"} --tools "" --strict-mcp-config --schema <same> -- "Report work already performed. Keep fields concise; do not repeat the task."`
    );
  }
  lines.push("--- final message ---");
  const shownMessage = finalMsg?.trim() || "(no final message)";
  lines.push(shownMessage.length > FINAL_MESSAGE_LIMIT
    ? `${shownMessage.slice(0, FINAL_MESSAGE_LIMIT)}\n[truncated; full message in ${messagePath}]`
    : shownMessage);
  if (!ok && stderrTail) {
    lines.push("--- stderr tail ---");
    lines.push(stderrTail);
  }
  lines.push("--- artifacts ---");
  lines.push(`run: ${runDir}`);
  lines.push(`record: ${recordPath}`);
  lines.push(`result: ${resultPath}`);
  lines.push(`last-message: ${messagePath}`);
  lines.push(`stdout: ${stdoutPath}`);
  lines.push(`stderr: ${stderrPath}`);
  process.stdout.write(lines.join("\n") + "\n");
  process.exitCode = ok ? 0 : 1;
}
