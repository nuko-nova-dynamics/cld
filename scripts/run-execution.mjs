import { spawn } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, statSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const STDOUT_PARSE_LIMIT = 16 * 1024 * 1024;
const INTERRUPT_GRACE_MS = 5000;

export async function executeRun({ bin, argv, cwd, env, scratchParent, context, schemaRequested, onStart }) {
  const container = scratchParent ? path.resolve(scratchParent) : tmpdir();
  if (scratchParent) mkdirSync(container, { recursive: true });
  const runDir = mkdtempSync(path.join(container, "cld-run-"));
  const resultPath = path.join(runDir, "result.json");
  const messagePath = path.join(runDir, "last-message.txt");
  const stdoutPath = path.join(runDir, "stdout.log");
  const stderrPath = path.join(runDir, "stderr.log");
  const recordPath = path.join(runDir, "run.json");
  const record = {
    status: "running",
    cwd,
    startedAt: new Date().toISOString(),
    endedAt: null,
    launch: {
      model: context.model ?? null,
      effort: context.effort ?? null,
      sandbox: context.sandbox,
      sessionSelection: context.sessionSelection,
      ephemeral: context.ephemeral,
      schemaRequested,
      budgetUsd: context.budgetUsd,
      maxTurns: context.maxTurns,
      hasRawFlags: context.hasRawFlags,
      hasSettings: context.hasSettings,
      hasMcpConfig: context.hasMcpConfig,
      hasStrictMcpConfig: context.hasStrictMcpConfig,
      hasSystemPrompt: context.hasSystemPrompt,
      hasAdditionalDirs: context.hasAdditionalDirs,
      hasCustomToolSelection: context.hasCustomToolSelection,
      hasPermissionOverrides: context.hasPermissionOverrides,
      hasFallbackModel: context.hasFallbackModel,
      hasAgentConfig: context.hasAgentConfig,
      hasWorktree: context.hasWorktree,
      hasBetas: context.hasBetas,
      hasSessionName: context.hasSessionName,
      hasSchemaRetries: context.hasSchemaRetries,
    },
    exitCode: null,
    signal: null,
    interruptSignal: null,
    sessionId: null,
    stdoutBytes: 0,
    reportedCostUsd: null,
    reportedCostMayBeCumulative: true,
    reportedModels: [],
    failureReason: null,
    artifacts: {
      result: "result.json",
      lastMessage: "last-message.txt",
      stdout: "stdout.log",
      stderr: "stderr.log",
    },
    continuation: {
      cwd,
      resumable: false,
      restoreLaunchOptions: [
        ...(context.hasRawFlags ? ["raw flags"] : []),
        ...(context.hasSettings ? ["settings"] : []),
        ...(context.hasMcpConfig ? ["MCP config"] : []),
        ...(context.hasStrictMcpConfig ? ["strict MCP selection"] : []),
        ...(schemaRequested ? ["schema"] : []),
        ...(context.hasSystemPrompt ? ["system prompt"] : []),
        ...(context.hasAdditionalDirs ? ["additional directories"] : []),
        ...(context.hasCustomToolSelection ? ["tool selection"] : []),
        ...(context.hasPermissionOverrides ? ["permission overrides"] : []),
        ...(context.hasFallbackModel ? ["fallback model"] : []),
        ...(context.hasAgentConfig ? ["agent config"] : []),
        ...(context.hasWorktree ? ["worktree"] : []),
        ...(context.hasBetas ? ["beta headers"] : []),
        ...(context.hasSessionName ? ["session name"] : []),
        ...(context.hasSchemaRetries ? ["schema retry setting"] : []),
      ],
      note: "Restore required launch-only options from the caller's private context before continuing.",
    },
  };
  const saveRecord = () => {
    const temporaryPath = `${recordPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(record, null, 2), { mode: 0o600 });
    renameSync(temporaryPath, recordPath);
  };
  let stdoutFd;
  let stderrFd;
  try {
    saveRecord();
    writeFileSync(messagePath, "(no final message)", { mode: 0o600 });
    stdoutFd = openSync(stdoutPath, "wx", 0o600);
    stderrFd = openSync(stderrPath, "wx", 0o600);
    onStart?.({ runDir, recordPath, resultPath, messagePath, stdoutPath, stderrPath });
  } catch (err) {
    for (const fd of [stdoutFd, stderrFd]) {
      if (fd !== undefined) { try { closeSync(fd); } catch {} }
    }
    record.status = "failed";
    record.endedAt = new Date().toISOString();
    record.failureReason = "artifact_error";
    try { saveRecord(); } catch {}
    throw err;
  }

  return new Promise((resolve, reject) => {
    let child;
    let spawnError = null;
    let artifactError = null;
    let interruptedBy = null;
    let interruptTimer = null;
    let stderrTailBytes = Buffer.alloc(0);
    let stdoutWritable = true;
    let stderrWritable = true;
    let finished = false;

    const signalChild = (signal) => {
      if (!child?.pid) return;
      if (process.platform !== "win32") {
        try { process.kill(-child.pid, signal); return; } catch {}
      }
      try { child.kill(signal); } catch {}
    };
    const stopChild = (signal) => {
      signalChild(signal);
      if (!interruptTimer) interruptTimer = setTimeout(() => signalChild("SIGKILL"), INTERRUPT_GRACE_MS);
    };
    const onSigint = () => {
      if (interruptedBy) return;
      interruptedBy = "SIGINT";
      stopChild("SIGINT");
    };
    const onSigterm = () => {
      if (interruptedBy) return;
      interruptedBy = "SIGTERM";
      stopChild("SIGTERM");
    };
    const writeChunk = (fd, chunk, channel) => {
      try {
        for (let offset = 0; offset < chunk.length;) {
          const written = writeSync(fd, chunk, offset, chunk.length - offset);
          if (written === 0) throw new Error("zero-byte artifact write");
          offset += written;
        }
      } catch (err) {
        if (!artifactError) artifactError = { channel, message: err.message };
        if (channel === "stdout") stdoutWritable = false;
        else stderrWritable = false;
        if (!finished) stopChild("SIGTERM");
      }
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    try {
      child = spawn(bin, argv, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env,
        detached: process.platform !== "win32",
      });
    } catch (err) {
      spawnError = err;
      finish(null, null);
      return;
    }
    child.stdout.on("data", (chunk) => {
      if (stdoutWritable) writeChunk(stdoutFd, chunk, "stdout");
    });
    child.stderr.on("data", (chunk) => {
      stderrTailBytes = Buffer.concat([stderrTailBytes, chunk]).subarray(-4096);
      if (stderrWritable) writeChunk(stderrFd, chunk, "stderr");
    });
    child.on("error", (err) => { spawnError = err; });
    child.on("close", finish);

    function finish(exitCode, signal) {
      finished = true;
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      if (interruptTimer) clearTimeout(interruptTimer);
      if (interruptedBy || artifactError) signalChild("SIGKILL");
      if (spawnError && stderrWritable) {
        const chunk = Buffer.from(`claude-run: failed to spawn ${bin}: ${spawnError.message}\n`);
        stderrTailBytes = Buffer.concat([stderrTailBytes, chunk]).subarray(-4096);
        writeChunk(stderrFd, chunk, "stderr");
      }
      for (const [fd, channel] of [[stdoutFd, "stdout"], [stderrFd, "stderr"]]) {
        try { closeSync(fd); } catch (err) {
          if (!artifactError) artifactError = { channel, message: err.message };
        }
      }

      try {
        const stdoutBytes = statSync(stdoutPath).size;
        const outputTooLarge = stdoutBytes > STDOUT_PARSE_LIMIT;
        let result = null;
        let stdoutText = null;
        if (!outputTooLarge && stdoutWritable) {
          stdoutText = readFileSync(stdoutPath, "utf8");
          let messages = [];
          try {
            const parsed = JSON.parse(stdoutText);
            messages = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            for (const line of stdoutText.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("{")) continue;
              try {
                const parsed = JSON.parse(trimmed);
                messages.push(...(Array.isArray(parsed) ? parsed : [parsed]));
              } catch {}
            }
          }
          result = messages.filter((message) => message?.type === "result").at(-1) ?? null;
        }
        writeFileSync(resultPath, outputTooLarge
          ? JSON.stringify({ error: "stdout_over_limit", limitBytes: STDOUT_PARSE_LIMIT, stdoutBytes }, null, 2)
          : result ? JSON.stringify(result, null, 2) : stdoutText ?? "", { mode: 0o600 });

        const hasStructuredOutput = result?.structured_output !== undefined && result?.structured_output !== null;
        const finalMsg = hasStructuredOutput ? JSON.stringify(result.structured_output, null, 2)
          : typeof result?.result === "string" ? result.result : null;
        writeFileSync(messagePath, finalMsg ?? "(no final message)", { mode: 0o600 });
        const ok = !interruptedBy && !spawnError && !artifactError && !outputTooLarge &&
          exitCode === 0 && result?.subtype === "success" && result.is_error !== true &&
          (!schemaRequested || hasStructuredOutput);
        const sessionId = typeof result?.session_id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.session_id)
          ? result.session_id : null;

        record.status = interruptedBy ? "interrupted" : ok ? "succeeded" : "failed";
        record.endedAt = new Date().toISOString();
        record.exitCode = exitCode;
        record.signal = signal;
        record.interruptSignal = interruptedBy;
        record.sessionId = sessionId;
        record.stdoutBytes = stdoutBytes;
        record.reportedCostUsd = Number.isFinite(result?.total_cost_usd) ? result.total_cost_usd : null;
        record.reportedModels = result?.modelUsage && typeof result.modelUsage === "object"
          ? Object.keys(result.modelUsage).filter((name) => /^[A-Za-z0-9._:/-]{1,128}$/.test(name)) : [];
        record.failureReason = interruptedBy ? "interrupted" : artifactError ? "artifact_error"
          : spawnError ? "spawn_error" : outputTooLarge ? "stdout_over_limit"
          : !result ? "missing_terminal_result" : schemaRequested && !hasStructuredOutput
          ? "schema_missing" : !ok ? "child_error" : null;
        record.continuation.resumable = !context.ephemeral && sessionId !== null;
        saveRecord();
        resolve({ ok, runDir, resultPath, messagePath, stdoutPath, stderrPath, recordPath,
          result, finalMsg, exitCode, signal, interruptedBy, spawnError, artifactError,
          outputTooLarge, stdoutBytes, stderrTail: stderrTailBytes.toString("utf8").trim().slice(-400),
          hasStructuredOutput });
      } catch (err) {
        record.status = interruptedBy ? "interrupted" : "failed";
        record.endedAt = new Date().toISOString();
        record.exitCode = exitCode;
        record.signal = signal;
        record.interruptSignal = interruptedBy;
        record.failureReason = "artifact_error";
        try { saveRecord(); } catch {}
        reject(err);
      }
    }
  });
}
