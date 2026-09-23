import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, statSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts", "claude-run.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "cld-runner-test-"));
const mock = path.join(dir, "mock-claude");
const signalMock = path.join(dir, "signal-claude");
const splitMock = path.join(dir, "split-claude");
const schema = path.join(dir, "schema.json");
writeFileSync(mock, `#!${process.execPath}\n` +
  'const fs = require("node:fs");\n' +
  'fs.writeFileSync(process.env.MOCK_ARGV_PATH, JSON.stringify(process.argv.slice(2)));\n' +
  'process.stdout.write(process.env.MOCK_STDOUT || "");\n' +
  'process.stderr.write(process.env.MOCK_STDERR || "");\n' +
  'process.exit(Number(process.env.MOCK_EXIT || 0));\n');
chmodSync(mock, 0o755);
writeFileSync(signalMock, `#!${process.execPath}\n` +
  'const fs = require("node:fs");\n' +
  'const mode = process.env.MOCK_MODE;\n' +
  'for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {\n' +
  '  fs.writeFileSync(process.env.MOCK_SIGNAL_PATH, signal);\n' +
  '  if (mode === "ignore") return;\n' +
  '  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "after signal" }));\n' +
  '  process.stderr.write("received " + signal + "\\n");\n' +
  '  process.exit(0);\n' +
  '});\n' +
  'fs.writeFileSync(process.env.MOCK_READY_PATH, String(process.pid));\n' +
  'process.stderr.write("ready\\n");\n' +
  'process.stdout.write(" \\n");\n' +
  'setInterval(() => {}, 1000);\n');
chmodSync(signalMock, 0o755);
writeFileSync(splitMock, `#!${process.execPath}\n` +
  'const raw = Buffer.from(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "A😀B" }));\n' +
  'const cut = raw.indexOf(Buffer.from("😀")) + 1;\n' +
  'process.stdout.write(raw.subarray(0, cut));\n' +
  'setTimeout(() => { process.stdout.write(raw.subarray(cut)); process.exit(0); }, 25);\n');
chmodSync(splitMock, 0o755);
writeFileSync(schema, JSON.stringify({ type: "object" }));
after(() => rmSync(dir, { recursive: true, force: true }));

const success = { type: "result", subtype: "success", is_error: false, session_id: "current", result: "OK" };
const failure = { type: "result", subtype: "error_during_execution", is_error: true, session_id: "failed", result: "Failed" };

function run(output, args = [], options = {}) {
  const scratch = options.scratch ?? mkdtempSync(path.join(dir, "scratch-"));
  const argvPath = path.join(scratch, "mock-argv.json");
  const res = spawnSync(process.execPath, [runner, "--sandbox", "ro", "--scratch", scratch, ...args, "--", "test prompt"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CLD_CLAUDE_BIN: options.bin ?? mock,
      MOCK_ARGV_PATH: argvPath,
      MOCK_STDOUT: typeof output === "string" ? output : JSON.stringify(output),
      MOCK_STDERR: options.stderr ?? "",
      MOCK_EXIT: String(options.exit ?? 0),
    },
  });
  const resultFile = res.stdout?.match(/^result: (.+)$/m)?.[1];
  const discovered = readdirSync(scratch).find(name => name.startsWith("cld-run-"));
  const runDir = resultFile ? path.dirname(resultFile) : discovered ? path.join(scratch, discovered) : scratch;
  return {
    ...res,
    parent: scratch,
    scratch: runDir,
    argv: () => JSON.parse(readFileSync(argvPath, "utf8")),
    artifact: (name) => readFileSync(path.join(runDir, name), "utf8"),
  };
}

async function interruptRun(signal, mode) {
  const scratch = mkdtempSync(path.join(dir, "signal-scratch-"));
  const readyPath = path.join(scratch, "ready.pid");
  const signalPath = path.join(scratch, "received-signal.txt");
  const runnerChild = spawn(process.execPath, [runner, "--sandbox", "ro", "--scratch", scratch, "--", "test prompt"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLD_CLAUDE_BIN: signalMock, MOCK_MODE: mode,
      MOCK_READY_PATH: readyPath, MOCK_SIGNAL_PATH: signalPath },
  });
  let stdout = "";
  let stderr = "";
  runnerChild.stdout.setEncoding("utf8");
  runnerChild.stderr.setEncoding("utf8");
  runnerChild.stdout.on("data", chunk => { stdout += chunk; });
  runnerChild.stderr.on("data", chunk => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    runnerChild.on("close", (code, closingSignal) => resolve({ code, closingSignal }));
    runnerChild.on("error", reject);
  });
  let childPid;
  let watchdog;
  let childAliveAfterRunner = false;
  try {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      try { childPid = Number(readFileSync(readyPath, "utf8")); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.ok(childPid, `mock did not start: ${stderr}`);
    const runDir = path.join(scratch, readdirSync(scratch).find(name => name.startsWith("cld-run-")));
    assert.equal(JSON.parse(readFileSync(path.join(runDir, "run.json"), "utf8")).status, "running");
    const outputDeadline = Date.now() + 1000;
    while ((!readFileSync(path.join(runDir, "stderr.log"), "utf8").includes("ready") || statSync(path.join(runDir, "stdout.log")).size === 0) && Date.now() < outputDeadline) {
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.match(readFileSync(path.join(runDir, "stderr.log"), "utf8"), /ready/);
    assert.ok(statSync(path.join(runDir, "stdout.log")).size > 0);
    assert.equal(runnerChild.kill(signal), true);
    const outcome = await Promise.race([closed, new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error(`runner did not exit after ${signal}`)), 9000);
    })]);
    try { process.kill(childPid, 0); childAliveAfterRunner = true; } catch {}
    return { ...outcome, stdout, stderr, scratch, childPid, childAliveAfterRunner,
      receivedSignal: readFileSync(signalPath, "utf8"),
      artifact: name => readFileSync(path.join(runDir, name), "utf8") };
  } finally {
    if (watchdog) clearTimeout(watchdog);
    if (runnerChild.exitCode === null && runnerChild.signalCode === null) runnerChild.kill("SIGKILL");
    if (childPid) { try { process.kill(childPid, "SIGKILL"); } catch {} }
  }
}

test("a terminal success is required, with exit zero", () => {
  for (const [output, exit] of [
    [{ type: "assistant", result: "OK" }, 0],
    [{ ...success, subtype: "error_max_turns" }, 0],
    [{ ...success, is_error: true }, 0],
    [success, 3],
    ["{bad json", 0],
  ]) {
    const res = run(output, [], { exit });
    assert.equal(res.status, 1, res.stdout);
    assert.match(res.stdout, /status: failed/);
  }
  assert.equal(run(success).status, 0);
});

test("arrays and JSONL select the last terminal result", () => {
  const array = run([success, { type: "assistant", result: "later prose" }, failure]);
  assert.equal(array.status, 1);
  assert.equal(JSON.parse(array.artifact("result.json")).session_id, "failed");

  const jsonl = run([JSON.stringify(success), "not JSON", JSON.stringify(failure), JSON.stringify({ type: "assistant" })].join("\n"));
  assert.equal(jsonl.status, 1);
  assert.equal(JSON.parse(jsonl.artifact("result.json")).session_id, "failed");

  const trailingEvent = run([JSON.stringify(failure), JSON.stringify(success), JSON.stringify({ type: "assistant" })].join("\n"));
  assert.equal(trailingEvent.status, 0);
  assert.equal(JSON.parse(trailingEvent.artifact("result.json")).session_id, "current");
});

test("schema requires canonical structured_output and keeps diagnostic prose", () => {
  const prose = '```json\n{"verdict":"confirmed"}\n```';
  for (const structured_output of [undefined, null]) {
    const result = { ...success, result: prose };
    if (structured_output === null) result.structured_output = null;
    const res = run(result, ["--schema", schema]);
    assert.equal(res.status, 1);
    assert.match(res.stdout, /structured_output missing/);
    assert.equal(res.artifact("last-message.txt"), prose);
    assert.ok(!res.stdout.includes("salvaged"));
  }
  const canonical = run({ ...success, result: "other prose", structured_output: { verdict: "confirmed" } }, ["--schema", schema]);
  assert.equal(canonical.status, 0);
  assert.deepEqual(JSON.parse(canonical.artifact("last-message.txt")), { verdict: "confirmed" });
  const argv = canonical.argv();
  assert.equal(JSON.parse(argv[argv.indexOf("--json-schema") + 1]).type, "object");
});

test("read-only arguments reject edits and show models used", () => {
  const res = run({ ...success, modelUsage: { "claude-sonnet": {}, "claude-opus-fallback": {} } }, [
    "--allow", "Bash(echo:*)", "--deny", "Bash(rm:*)", "--raw", "--verbose",
  ]);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /models: claude-sonnet, claude-opus-fallback/);
  const argv = res.argv();
  assert.equal(argv[argv.indexOf("--permission-mode") + 1], "manual");
  const allowed = argv[argv.indexOf("--allowedTools") + 1];
  assert.match(allowed, /Bash\(echo:\*\)/);
  assert.doesNotMatch(allowed, /git branch|Bash\(find/);
  assert.equal(argv[argv.indexOf("--disallowedTools") + 1], "Write,Edit,NotebookEdit,Bash(rm:*)");
  assert.ok(argv.includes("--verbose"));
});

test("console truncation preserves the complete message artifact", () => {
  const longMessage = "x".repeat(8000);
  const res = run({ ...success, result: longMessage });
  assert.equal(res.status, 0);
  assert.equal(res.artifact("last-message.txt"), longMessage);
  assert.match(res.stdout, /\[truncated; full message in /);
  assert.ok(res.stdout.length < 7000);
});

test("reusing a scratch parent preserves earlier run artifacts", () => {
  const first = run(success);
  assert.equal(first.artifact("last-message.txt"), "OK");
  const second = run("not JSON", [], { scratch: first.parent });
  assert.equal(second.status, 1);
  assert.notEqual(first.scratch, second.scratch);
  assert.equal(first.artifact("last-message.txt"), "OK");
  assert.equal(second.artifact("last-message.txt"), "(no final message)");
  assert.equal(second.artifact("result.json"), "not JSON");
});

test("spawn failure is persisted in stderr artifact", () => {
  const res = run("", [], { bin: path.join(dir, "missing-claude") });
  assert.equal(res.status, 1);
  assert.match(res.artifact("stderr.log"), /failed to spawn/);
  assert.equal(res.artifact("last-message.txt"), "(no final message)");
});

test("SIGTERM and SIGINT forward to Claude and cannot report success", { timeout: 8000 }, async () => {
  for (const signal of ["SIGTERM", "SIGINT"]) {
    const res = await interruptRun(signal, "graceful");
    assert.equal(res.code, 1, `${signal}: ${res.stderr}`);
    assert.equal(res.receivedSignal, signal);
    assert.match(res.stdout, new RegExp(`interrupted: ${signal}`));
    assert.match(res.stdout, /status: failed/);
    assert.equal(JSON.parse(res.artifact("run.json")).status, "interrupted");
    assert.equal(JSON.parse(res.artifact("result.json")).subtype, "success");
    assert.equal(res.artifact("last-message.txt"), "after signal");
    assert.match(res.artifact("stderr.log"), new RegExp(`received ${signal}`));
  }
});

test("an unresponsive Claude child is killed after the grace period", { timeout: 10000 }, async () => {
  const started = Date.now();
  const res = await interruptRun("SIGTERM", "ignore");
  assert.equal(res.code, 1);
  assert.equal(res.receivedSignal, "SIGTERM");
  assert.ok(Date.now() - started >= 4500);
  assert.match(res.stdout, /interrupted: SIGTERM/);
  assert.equal(res.artifact("last-message.txt"), "(no final message)");
  assert.match(res.artifact("stderr.log"), /ready/);
  assert.equal(res.childAliveAfterRunner, false);
});

test("split UTF-8 chunks and malformed metadata preserve artifacts", () => {
  const unicode = run("", [], { bin: splitMock });
  assert.equal(unicode.status, 0, unicode.stderr);
  assert.equal(unicode.artifact("last-message.txt"), "A😀B");
  const malformed = run({ ...success, total_cost_usd: "not a number",
    permission_denials: [null, { tool_name: { toString: null } }, { tool_name: "Write" }] });
  assert.equal(malformed.status, 0, malformed.stderr);
  assert.match(malformed.stdout, /permission denials: 3 \(unknown, Write\)/);
  assert.doesNotMatch(malformed.stdout, /cost:/);
  assert.equal(malformed.artifact("last-message.txt"), "OK");
});

test("numeric limits and ephemeral session conflicts fail before spawning", () => {
  for (const args of [
    ["--budget", "Infinity"], ["--budget", "NaN"], ["--budget", "0"],
    ["--max-turns", "1.5"], ["--max-turns", "0"],
    ["--schema-retries", "-1"], ["--schema-retries", "2.5"],
    ["--ephemeral", "--resume", "last"],
  ]) {
    const res = run(success, args);
    assert.equal(res.status, 2, `${args.join(" ")}: ${res.stderr}`);
  }
  const valid = run(success, ["--budget", "1.25", "--max-turns", "3", "--schema-retries", "2"]);
  assert.equal(valid.status, 0);
  const argv = valid.argv();
  assert.equal(argv[argv.indexOf("--max-budget-usd") + 1], "1.25");
  assert.equal(argv[argv.indexOf("--max-turns") + 1], "3");
});

test("concurrent calls sharing a scratch parent keep independent results", async () => {
  const parent = mkdtempSync(path.join(dir, "shared-"));
  const launch = label => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, "--sandbox", "ro", "--scratch", parent, "--", label], {
      cwd: root, env: { ...process.env, CLD_CLAUDE_BIN: mock,
        MOCK_ARGV_PATH: path.join(parent, `${label}-argv.json`),
        MOCK_STDOUT: JSON.stringify({ ...success, result: label }), MOCK_EXIT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", data => { stdout += data; });
    child.stderr.on("data", data => { stderr += data; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
  const results = await Promise.all([launch("worker-a"), launch("worker-b")]);
  const paths = results.map(res => {
    assert.equal(res.code, 0, res.stderr);
    const resultPath = res.stdout.match(/^result: (.+)$/m)?.[1];
    assert.ok(resultPath, res.stdout);
    return resultPath;
  });
  assert.notEqual(paths[0], paths[1]);
  assert.deepEqual(paths.map(p => JSON.parse(readFileSync(p, "utf8")).result), ["worker-a", "worker-b"]);
});

test("run records retain useful context without persisting launch secrets", () => {
  const secret = "never-persist-this-test-token";
  const res = run(success, ["--model", "claude-opus-5-5", "--effort", "medium",
    "--budget", "0.25", "--settings", JSON.stringify({ env: { EXAMPLE_TOKEN: secret } }),
    "--append-system-prompt", secret, "--raw", "--example-token", "--raw", secret]);
  assert.equal(res.status, 0, res.stderr);
  const raw = res.artifact("run.json");
  assert.ok(!raw.includes(secret));
  assert.ok(!raw.includes("test prompt"));
  const record = JSON.parse(raw);
  assert.equal(record.status, "succeeded");
  assert.equal(record.cwd, root);
  assert.ok(raw.includes("claude-opus-5-5"));
  assert.ok(raw.includes("medium"));
  assert.equal(JSON.parse(res.artifact("stdout.log")).session_id, "current");
});

test("oversized stdout fails within the parse limit and preserves raw output", () => {
  const largeMock = path.join(dir, "large-claude");
  writeFileSync(largeMock, `#!${process.execPath}\n` +
    'const fs = require("node:fs");\n' +
    'fs.writeSync(1, "{\\"type\\":\\"result\\",\\"subtype\\":\\"success\\",\\"result\\":\\"");\n' +
    'const block = Buffer.alloc(1024 * 1024, 120);\n' +
    'for (let i = 0; i < 17; i++) fs.writeSync(1, block);\n' +
    'fs.writeSync(1, "\\"}\\n");\n');
  chmodSync(largeMock, 0o755);
  const res = run("", [], { bin: largeMock });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stdout, /limit|large/i);
  assert.ok(res.stdout.length < 10000);
  assert.ok(statSync(path.join(res.scratch, "stdout.log")).size > 16 * 1024 * 1024);
  assert.equal(JSON.parse(res.artifact("run.json")).status, "failed");
});

test("artifact finalization failures cannot become successful runs", () => {
  const brokenMock = path.join(dir, "broken-artifact-claude");
  writeFileSync(brokenMock, `#!${process.execPath}\n` +
    'const fs = require("node:fs"), path = require("node:path");\n' +
    'const parent = path.dirname(process.env.MOCK_ARGV_PATH);\n' +
    'const run = fs.readdirSync(parent).find(name => name.startsWith("cld-run-"));\n' +
    'fs.mkdirSync(path.join(parent, run, "result.json"));\n' +
    'process.stdout.write(process.env.MOCK_STDOUT);\n');
  chmodSync(brokenMock, 0o755);
  const res = run(success, [], { bin: brokenMock });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /execution failed/);
  assert.equal(JSON.parse(res.artifact("run.json")).status, "failed");
  assert.equal(JSON.parse(res.artifact("run.json")).failureReason, "artifact_error");
  assert.equal(JSON.parse(res.artifact("stdout.log")).subtype, "success");
});
