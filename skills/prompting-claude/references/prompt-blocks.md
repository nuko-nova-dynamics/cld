# Prompt Blocks for Claude

Use these blocks selectively when composing Claude delegation prompts.
Claude parses XML tags natively (Anthropic's own guidance recommends
them for structure), but unlike GPT it needs less scaffolding — a
plain-prose prompt with intent, context, and done-criteria is often
enough. Reach for blocks when the task is high-stakes, parsed, or
mutating.

## Core Wrapper

### `task`

Use in nearly every prompt. Intent + context + end state; no
micro-steps.

```xml
<task>
State the outcome you want, the relevant repo/failure context, and
what "done" looks like. Let Claude plan the steps itself.
</task>
```

### `done_criteria`

The highest-leverage block for Claude — it follows explicit completion
criteria very reliably.

```xml
<done_criteria>
Done means: the tests in <path> pass, nothing outside <scope> changed,
and you report what you changed with the verification output.
</done_criteria>
```

## Grounding and Evidence

### `evidence_contract`

Use for review, research, or any claim-heavy output. Claude honors
evidence contracts strictly when asked.

```xml
<evidence_contract>
Cite file:line (or command output) for every finding.
Label anything you could not verify as UNVERIFIED.
Do not present inference as fact.
</evidence_contract>
```

### `no_guessing`

```xml
<no_guessing>
Do not guess repository facts. Read the file or run the command first.
If something remains unknowable with the tools you have, say exactly
what and why.
</no_guessing>
```

## Scope and Safety

### `scope_fence`

Required for every mutating (write/full) run. Claude respects stated
scopes; unstated ones invite helpful-but-unwanted cleanups.

```xml
<scope_fence>
Only touch <paths>. No refactors, renames, dependency bumps, or
formatting changes outside the stated task, even if you notice
problems — list those as follow-ups instead.
</scope_fence>
```

### `verification_required`

```xml
<verification_required>
Run the relevant tests/commands and include their real output.
"It should work" does not count as verification.
</verification_required>
```

## Output

### `output_shape`

Only when NOT using `--schema` (the schema IS the contract when you
are). For prose results.

```xml
<output_shape>
Reply with: (1) outcome in one sentence, (2) what changed / what you
found, (3) evidence, (4) open risks. Compact; no preamble.
</output_shape>
```

### `schema_field_intent`

Pair with `--schema` — state what the fields mean, let the schema
carry the shape.

```xml
<schema_field_intent>
findings[].failure_scenario must be a concrete input/state that
produces the wrong behavior — not a restatement of the summary.
</schema_field_intent>
```

## Depth Control

Do NOT write "think very hard" blocks — pass `--effort xhigh|max` on
the runner instead. The one prompt-side depth lever worth using:

### `second_order_check`

```xml
<second_order_check>
After the first plausible answer, check second-order failures:
empty states, retries, concurrency, stale caches, rollback paths.
</second_order_check>
```
