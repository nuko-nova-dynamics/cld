# Claude Prompt Anti-Patterns

Failure modes specific to prompting Claude from another agent.

## Micro-scripting the steps

Bad:

```text
1. Open src/auth.ts 2. Find the login function 3. Add a null check on
line 42 4. Then open the test file 5. ...
```

Better: state the outcome and let Claude plan. Claude decomposes work
internally; step lists constrain it into worse plans and go stale the
moment the repo differs from your memory.

```xml
<task>
login() crashes on null user. Fix it and cover the case in the
existing test file.
</task>
```

## Restating the whole task on resume

Bad: re-sending the original prompt plus the new instruction.

Better: the delta only. The session retains everything; restating
wastes tokens and can trigger re-work of finished steps.

## "Think very hard" instead of `--effort`

Bad:

```text
Think extremely hard about this. Be very thorough. Do not miss anything.
```

Better: pass `--effort xhigh` (or `max`) on the runner and spend the
prompt on concrete checks:

```xml
<second_order_check>
Check empty states, retries, concurrency, stale caches, rollback paths.
</second_order_check>
```

## Asking for JSON in prose

Bad:

```text
Respond in JSON with keys findings, severity, ...
```

Better: `--schema <file>` — validated, retried on failure, delivered in
`structured_output`. Keep the prompt about field *intent*, not shape.

## Persona wrappers

Bad:

```text
You are a world-class 10x staff engineer with 20 years of experience...
```

Better: skip it. Claude Code's default system prompt already frames the
role; personas add nothing and can skew tone. Use
`--append-system-prompt` only for real standing rules (house style,
banned APIs).

## Unscoped mutating runs

Bad:

```text
Fix the auth bug. (--sandbox write, no scope stated)
```

Better: always fence writes. Claude is helpful by default — unstated
scope invites drive-by cleanups you didn't want in the diff.

```xml
<scope_fence>
Only touch src/auth/ and tests/auth/. List anything else you notice as
follow-ups instead of changing it.
</scope_fence>
```

## Trusting the report without the diff

Not a prompt flaw but a driver flaw: after any write run, inspect
`git diff` and run the tests yourself. Claude's task-report is a claim,
not a verification. Same rule cdx applies to Codex — symmetric here.

## Mixing unrelated jobs in one run

Bad: "review this, fix what you find, update the changelog, and plan
next steps" — one run, four jobs, muddled result. Split into separate
runs (review → fix on resume → docs), reusing the session id.
