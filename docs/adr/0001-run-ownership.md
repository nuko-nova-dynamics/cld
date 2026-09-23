# Own execution and artifacts per Claude run

Status: accepted, 2026-09-23.

## Context

The CLI mixed argument translation, process lifetime, buffered output, result interpretation, and file writes. Terminating the wrapper could leave Claude running. Concurrent invocations with the same scratch path could overwrite each other's results. Calling agents reconstructed continuation context outside the artifacts.

## Decision

Keep argument parsing and Claude permission/flag translation in `claude-run.mjs`. Put process supervision, incremental output persistence, result classification, and run-record finalization in one execution module. The existing real Claude executable and fake executables exercise this seam without a dependency injection framework.

Allocate a unique artifact directory for every call. `--scratch` selects its parent, so callers must use returned paths. Write a running record before launch and atomically replace it with the final state. Record selected safe fields and markers for omitted configuration; never store prompts, environment values, inline settings, or raw arguments in the run record. Raw Claude output is not redacted.

Write output as it arrives instead of retaining an unbounded string. Cap stdout parsing at 16 MiB and report failure if it exceeds that limit, preserving raw bytes on disk. The console remains a compact completion summary. Forward SIGINT/SIGTERM and force termination after a five-second grace period. Interrupted runs cannot succeed even when Claude emits a success result.

Preserve named CLI flags. Removing simple forwarding aliases might move complexity to agents rather than remove it; there is no demonstrated need for that compatibility break. Do not split the execution module into small forwarding modules.

## Consequences

Each run owns its process and artifacts. Tests cover that observable contract through the CLI, including parallel calls, partial output, cancellation, oversized output, and launch metadata.

This is not a durable job scheduler. SIGKILL or host failure can leave a running record; inspect process state before retrying. Files can consume disk space until callers remove them. On Windows, cancellation targets the direct child; POSIX uses the owned process group. Resumption still requires authorization, remaining-budget calculation, and restoration of omitted launch options.
