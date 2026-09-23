---
name: claude-setup
description: Diagnose Claude Code installation, version, authentication, provider configuration, or runner failures and run a bounded integration probe.
---

# Claude setup check

1. Read `claude --version`, `claude --help`, and `claude auth status`. Keep credentials out of logs. The 2026-09-23 refresh inspected Claude Code 2.1.280; older or newer installs may differ.
2. Inspect the actual failure and use `claude doctor` when installation/settings diagnostics are needed. Separate missing binary, auth, provider/model availability, network, permissions, and malformed result problems.
3. If the binary is missing or needs repair, follow the host's toolchain instructions and current [setup docs](https://code.claude.com/docs/en/setup). Do not install or update packages merely to inspect this skill. For auth failure, use `claude auth login` or the documented subscription/API-key flow appropriate to the host. Never copy credentials from another machine.
4. Run the offline contract tests first when diagnosing the runner:

```bash
node --test <plugin-root>/tests/runner.test.mjs
```

5. When a live call is needed, use a bounded disposable probe in the intended directory and an available model. Preserve the user's configured default if no model choice is needed:

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox ro \
  --cd <target-project> --tools "" --strict-mcp-config \
  --ephemeral --max-turns 3 --budget 0.25 -- "Reply with exactly: OK"
```

Expect exit zero, a successful terminal result, and `OK`. Inspect `modelUsage` rather than assuming the requested model served the call. A text probe verifies connectivity and result handling, not editing, retrieval, schemas, or model quality. The live suite in `tests/smoke.mjs` covers plain, schema, and verbose responses and consumes account usage.

`--bare` on the Anthropic API bypasses OAuth/keychain authentication, so it can break a subscription login that otherwise works. Do not recommend it as a universal fix. Consult the [flag map](../driving-claude/references/flag-map.md) and current CLI help before blaming a model for a rejected flag.
