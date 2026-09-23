#!/usr/bin/env node
// Live Claude integration probes. Each call consumes account usage.
// Pin CLD_SMOKE_MODEL to verify a specific model; defaults to the sonnet alias.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts", "claude-run.mjs");
const scratchRoot = mkdtempSync(path.join(tmpdir(), "cld-smoke-"));
const model = process.env.CLD_SMOKE_MODEL || "sonnet";
const base = ["--sandbox", "ro", "--cd", scratchRoot, "--model", model,
  "--tools", "", "--strict-mcp-config", "--ephemeral", "--budget", "0.50", "--max-turns", "5"];
if (!model.includes("haiku")) base.push("--effort", "low");
let failures = 0;

function run(name, args, check) {
  const scratch = path.join(scratchRoot, name);
  const res = spawnSync(process.execPath, [runner, ...base, "--scratch", scratch, ...args], {
    encoding: "utf8", cwd: root, timeout: 180000,
  });
  let result;
  try { result = JSON.parse(readFileSync(path.join(scratch, "result.json"), "utf8")); } catch {}
  const ok = res.status === 0 && check(result);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (result?.modelUsage) console.log(`models: ${Object.keys(result.modelUsage).join(", ")}`);
  if (result?.total_cost_usd != null) console.log(`estimated cost: $${result.total_cost_usd.toFixed(4)}`);
  console.log(`artifacts: ${scratch}`);
  if (!ok) {
    failures += 1;
    console.log(`exit=${res.status}; error=${res.error?.message ?? "none"}`);
    console.log((res.stdout ?? "").slice(-2000));
    if (res.stderr?.trim()) console.log(res.stderr.slice(-1000));
  }
}

run("plain", ["--", "Reply with exactly: OK"], r => r?.result?.trim() === "OK");
run("schema", ["--schema", path.join(root, "schemas", "verdict.schema.json"), "--",
  "Assess this claim: 2+2 equals 4. Use arithmetic; no external tools needed. Return the structured verdict."], r => {
  const v = r?.structured_output;
  return v?.verdict === "confirmed" && typeof v.claim === "string" && typeof v.evidence === "string" &&
    Object.hasOwn(v, "confidence") && (v.confidence === null || typeof v.confidence === "number");
});
run("verbose", ["--raw", "--verbose", "--", "Reply with exactly: OK"],
  r => r?.result?.trim() === "OK" && typeof r.session_id === "string");
process.exit(failures ? 1 : 0);
