---
name: claude-setup
description: Check Claude Code CLI health — install, auth, version, runner smoke test. Invoke explicitly with $claude-setup, or use when Claude delegation fails with auth/install errors or the user asks whether Claude is set up.
---

# Claude setup check

Health-check the Claude integration:

1. `claude --version` — if missing, offer to install: native installer
   `curl -fsSL https://claude.ai/install.sh | bash` (macOS/Linux) or
   `npm install -g @anthropic-ai/claude-code`. Ask before installing.
2. `claude doctor` — surface anything non-healthy.
3. Auth: if runs fail with auth errors, tell the user to run `claude`
   interactively once to log in, or `claude setup-token` for
   long-lived headless auth.
4. Smoke test the runner (from the plugin root):

```bash
node scripts/claude-run.mjs --sandbox ro --model sonnet --ephemeral -- "Reply with exactly: ok"
```

   Expect exit 0, `status: completed (success)`, final message `ok`.
5. Flag drift: this plugin was verified against Claude Code 2.1.207.
   If `claude --version` is much newer and the runner errors on a
   flag, check `claude --help` for renames before blaming the task.

Report all findings compactly.
