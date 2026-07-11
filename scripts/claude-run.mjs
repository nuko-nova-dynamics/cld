#!/usr/bin/env node
// cld runner: composes `claude -p --output-format json`, tees the full result
// object to a scratch file, and prints a compact context-safe summary.
// Contract: exit 0 only when claude exited 0 and reported a non-error result.
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
// ro: read-only. Read/Grep/Glob need no permission in -p mode; everything else
// is denied by default, so we only allow web reads and read-only shell.
const RO_ALLOWED_TOOLS = [
  "WebFetch",
  "WebSearch",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git show:*)",
  "Bash(git status:*)",
  "Bash(git branch:*)",
  "Bash(git blame:*)",
  "Bash(ls:*)",
  "Bash(cat:*)",
  "Bash(rg:*)",
  "Bash(grep:*)",
  "Bash(find:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
].join(",");

function die(msg) {
  process.stderr.write(`claude-run: ${msg}\n`);
  process.stderr.write(
    "usage: claude-run.mjs --sandbox <ro|write|full> [--model <m>] [--effort <low|medium|high|xhigh|max>] " +
      "[--schema <path>] [--resume <id|last>] [--fork] [--session-id <uuid>] [--name <s>] " +
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
if (opts.budget && !(Number(opts.budget) > 0)) die(`invalid --budget: ${opts.budget}`);
const prompt = opts.promptParts.join(" ").trim();
if (!prompt) die("a prompt is required (resume also needs a delta instruction)");

const scratch = opts.scratch ?? mkdtempSync(path.join(tmpdir(), "cld-"));
mkdirSync(scratch, { recursive: true });
const resultPath = path.join(scratch, "result.json");
const messagePath = path.join(scratch, "last-message.txt");
const stderrPath = path.join(scratch, "stderr.log");

const argv = ["-p", "--output-format", "json"];

// Sandbox tiers (claude has no sandbox flag; permissions are the control):
//   ro    -> nothing allowed beyond reads + read-only shell + web
//   write -> auto-accept file edits, unrestricted shell
//   full  -> bypass all permission checks (explicit user intent required)
// --allow merges extra allowedTools into the tier's list; --deny always maps
// to --disallowedTools (deny wins over allow in claude's permission system,
// but is ignored under full's bypass).
if (opts.sandbox === "ro") {
  argv.push("--allowedTools", opts.allow ? `${RO_ALLOWED_TOOLS},${opts.allow}` : RO_ALLOWED_TOOLS);
} else if (opts.sandbox === "write") {
  argv.push("--permission-mode", "acceptEdits");
  const writeAllowed = "Bash,WebFetch,WebSearch";
  argv.push("--allowedTools", opts.allow ? `${writeAllowed},${opts.allow}` : writeAllowed);
} else {
  argv.push("--dangerously-skip-permissions");
}
if (opts.deny) argv.push("--disallowedTools", opts.deny);
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
  // --json-schema takes inline JSON; read, validate, and minify the file.
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
const child = spawn(bin, argv, {
  cwd: opts.cd || process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});

let stdoutBuf = "";
let stderrBuf = "";
child.stdout.on("data", (buf) => {
  stdoutBuf += buf.toString();
});
child.stderr.on("data", (buf) => {
  stderrBuf += buf.toString();
});

child.on("close", (code) => {
  writeFileSync(stderrPath, stderrBuf);
  // -p --output-format json emits one JSON object on stdout. With
  // --raw --verbose it becomes an array of messages (the result object is the
  // element with type "result"); with stream-json it's JSONL whose last line
  // is the result. Handle all three.
  let result = null;
  try {
    result = JSON.parse(stdoutBuf);
  } catch {
    for (const line of stdoutBuf.split("\n").reverse()) {
      const t = line.trim();
      if (!t.startsWith("{")) continue;
      try {
        result = JSON.parse(t);
        break;
      } catch {}
    }
  }
  if (Array.isArray(result)) result = result.find((m) => m?.type === "result") ?? null;
  writeFileSync(resultPath, result ? JSON.stringify(result, null, 2) : stdoutBuf);

  const ok = code === 0 && result != null && result.is_error !== true;
  const lines = [];
  lines.push(`session: ${result?.session_id ?? "unknown"}`);
  lines.push(
    `status: ${ok ? `completed (${result?.subtype ?? "success"})` : `failed (exit ${code}${result?.subtype ? `, ${result.subtype}` : ""})`}`
  );
  if (result?.num_turns != null) lines.push(`turns: ${result.num_turns}`);
  if (result?.usage) {
    const u = result.usage;
    const cached = (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    lines.push(`tokens: input=${u.input_tokens ?? 0} cached=${cached} output=${u.output_tokens ?? 0}`);
  }
  if (result?.total_cost_usd != null) lines.push(`cost: $${result.total_cost_usd.toFixed(4)}`);
  const denials = result?.permission_denials;
  if (Array.isArray(denials) && denials.length > 0) {
    const names = [...new Set(denials.map((d) => d.tool_name ?? "unknown"))].join(", ");
    lines.push(`permission denials: ${denials.length} (${names}) — escalate --sandbox tier if these blocked the task`);
  }
  // With --json-schema the validated object lands in structured_output; the
  // prose result stays in result.
  let finalMsg = null;
  if (result?.structured_output !== undefined && result?.structured_output !== null) {
    finalMsg = JSON.stringify(result.structured_output, null, 2);
  } else if (typeof result?.result === "string") {
    finalMsg = result.result;
  }
  if (finalMsg != null) writeFileSync(messagePath, finalMsg);
  lines.push("--- final message ---");
  lines.push(finalMsg?.trim() || "(no final message)");
  if (!ok && stderrBuf.trim()) {
    lines.push("--- stderr tail ---");
    lines.push(stderrBuf.trim().slice(-400));
  }
  lines.push("--- artifacts ---");
  lines.push(`result: ${resultPath}`);
  lines.push(`last-message: ${messagePath}`);
  lines.push(`stderr: ${stderrPath}`);
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(ok ? 0 : 1);
});

child.on("error", (err) => {
  process.stderr.write(`claude-run: failed to spawn ${bin}: ${err.message}\n`);
  process.exit(1);
});
