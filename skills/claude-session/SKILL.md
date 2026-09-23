---
name: claude-session
description: Resume, fork, or locate Claude Code sessions used by this plugin. Use when continuing prior Claude work, recovering a report, or branching a conversation.
---

# Claude sessions

Retain the session ID, original working directory, selected model/effort, and runtime flags with each delegated result. Prefer that record over guessing from transcript filenames.

```bash
node <plugin-root>/scripts/claude-run.mjs --sandbox <tier> \
  --cd <original-project> --resume <session-id> [required-launch-flags] \
  -- <delta-instruction>
```

- `--resume last` means the most recent session in the child's working directory. Use it only when that session is unambiguous; parallel workers make explicit IDs preferable.
- `--fork` with `--resume` creates a new session. Retain the returned ID.
- `--ephemeral` sessions cannot be resumed through this workflow.
- Send the new instruction and changed context. Do not repeat the whole original task, but recheck current files because the workspace may have changed.
- Re-pass launch-only configuration the task needs: `--mcp-config`, `--settings`, `--raw --plugin-dir --raw <path>`, `--fallback-model`, and `--add-dir`. Standard settings files are re-read on launch. Do not assume prompt text restores runtime configuration.
- Select the permission tier for the current authorized action. A past write run does not authorize new writes during a review. The runner sets the mode explicitly.
- A resumed transcript does not restart an interrupted background command or recover its missing output. Verify the actual process and workspace before rerunning anything.
- `--budget` starts a new invocation cap on resume. If the user set a total task budget, subtract spend already incurred and pass only the remaining allocation. Do not resume with the original full cap each time.
- Large resumed histories can incur substantial input cost, especially after cache expiry. CLI cost totals may include earlier calls; distinguish current-run usage from cumulative totals to avoid double-counting. These estimates and call-level caps are not billing guarantees.

If the ID was lost, use Claude's documented session picker or inspect recent JSONL files under `~/.claude/projects/` for the target project. Storage paths are implementation details: locate the actual directory rather than assuming a hand-built slug is correct. Read only enough metadata to identify the task; do not dump private transcripts into the conversation.

Source: [Claude Code sessions](https://code.claude.com/docs/en/sessions), checked 2026-09-23.
