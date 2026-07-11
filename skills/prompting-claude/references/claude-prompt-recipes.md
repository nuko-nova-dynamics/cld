# Claude Prompt Recipes

Starting templates for Claude delegation via the runner. Copy the
smallest recipe that fits, trim what you don't need, and prepend the
right runner flags (shown per recipe).

## Diagnosis (`--sandbox ro`, `--effort high` if gnarly)

```xml
<task>
Diagnose why <failing test/command> is breaking in this repo.
Failure output:
<paste the actual error/output>
</task>

<no_guessing>
Read the implicated files and re-run read-only checks before
concluding. If the root cause needs a mutating experiment to confirm,
say so instead of guessing.
</no_guessing>

<output_shape>
Reply with: (1) most likely root cause, (2) evidence (file:line +
output), (3) smallest safe fix, (4) confidence and what would raise it.
</output_shape>
```

## Narrow fix (`--sandbox write`, `--schema task-report`)

```xml
<task>
Implement the smallest safe fix for <issue> in this repo.
Context: <root cause if known, or the diagnosis session id you're resuming>.
</task>

<scope_fence>
Only touch <paths>. No refactors or cleanup outside the failing path;
list anything else you notice as follow-ups.
</scope_fence>

<done_criteria>
Done means: <tests/command> passes and you ran it — include the output
in commands_run. files_changed lists every file you touched.
</done_criteria>
```

## Review (`--sandbox ro`, `--schema review-findings`)

```xml
<task>
Review this change for correctness bugs, security issues, and
significant quality problems. Repo: <path>. Get the diff yourself:
<git diff command>. The change is supposed to: <intent>.
</task>

<evidence_contract>
Cite file:line for every finding. failure_scenario must be a concrete
input/state that produces wrong behavior. Only report findings you
verified against the actual code.
</evidence_contract>

<second_order_check>
After the obvious issues, check empty states, retries, concurrency,
stale caches, and rollback paths.
</second_order_check>
```

## Research / recommendation (`--sandbox ro`, `--budget` for open-ended)

```xml
<task>
Research <question> and recommend a path. Constraints: <constraints>.
You may use web search and fetch.
</task>

<evidence_contract>
Separate observed facts (with sources), inference, and open questions.
Prefer primary sources; link them.
</evidence_contract>

<output_shape>
Reply with: recommendation first, then the 2-3 facts that drove it,
then tradeoffs, then open questions. Compact.
</output_shape>
```

## Second opinion on Codex's own work (`--sandbox ro`, `--schema verdict`)

```xml
<task>
I implemented <change> with the intent: <intent>. Claim to check:
<the specific claim, e.g. "this handles concurrent writers correctly">.
Verify against the actual code at <paths>, not the description.
</task>

<schema_field_intent>
evidence must cite the file:line or command output that decided the
verdict. If the code contradicts my description, that's a "refuted"
with the contradiction as evidence.
</schema_field_intent>
```

## Resume follow-up (`--resume <id>`)

Send ONLY the delta — Claude has full session context:

```text
The fix broke test_foo — here's the output: <paste>. Adjust the fix;
same scope fence as before.
```
