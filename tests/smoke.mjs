#!/usr/bin/env node
// Live smoke test for the cld runner. Spends real Claude tokens (a few cents):
// three cheap sonnet/low/ephemeral probes — plain, schema, verbose-raw.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(root, "scripts", "claude-run.mjs");
const base = ["--sandbox", "ro", "--model", "sonnet", "--effort", "low", "--ephemeral"];

let failures = 0;
function run(name, args, check) {
  const res = spawnSync("node", [runner, ...args], { encoding: "utf8", cwd: root, timeout: 180000 });
  const out = res.stdout ?? "";
  const ok = res.status === 0 && check(out);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures += 1;
    console.log(`  exit=${res.status}`);
    console.log(out.split("\n").map((l) => `  | ${l}`).join("\n"));
    if (res.stderr?.trim()) console.log(res.stderr.split("\n").map((l) => `  ! ${l}`).join("\n"));
  }
}

run("plain ro run", [...base, "--", "Reply with exactly: OK"], (out) =>
  out.includes("status: completed") && /final message ---\s*\nOK/.test(out)
);

run(
  "schema structured output",
  [...base, "--schema", path.join(root, "schemas", "verdict.schema.json"), "--",
    "Claim to check: 2+2 equals 4. No tools needed; answer from arithmetic."],
  (out) => {
    if (!out.includes("status: completed")) return false;
    const body = out.split("--- final message ---")[1]?.split("--- artifacts ---")[0] ?? "";
    try {
      const v = JSON.parse(body.trim());
      return v.verdict === "confirmed" && typeof v.evidence === "string";
    } catch {
      return false;
    }
  }
);

run("raw verbose passthrough", [...base, "--raw", "--verbose", "--", "Reply with exactly: OK"], (out) =>
  out.includes("status: completed") && !out.includes("session: unknown")
);

process.exit(failures === 0 ? 0 : 1);
