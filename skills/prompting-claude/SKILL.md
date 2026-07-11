---
name: prompting-claude
description: Compose effective prompts for Claude (Fable/Opus/Sonnet models) — intent framing, context, output contracts, verification asks. Use before any non-trivial Claude delegation to tighten the prompt.
---

# Prompting Claude

Prompt Claude like a strong senior colleague, not a command executor.
Claude models infer intent well and plan internally — give them the
goal, the context, and what "done" looks like; don't micro-script the
steps.

Core rules:

- **State intent and constraints, then stop.** Describe the outcome
  and the boundaries (files in scope, what must not change, how to
  verify). Claude decomposes the work itself; over-specified
  step-by-step instructions degrade results.
- **Front-load context.** Name the repo areas, paste the failing
  output, link the spec. Claude handles long context well — include
  the relevant material rather than summarizing it away.
- **Define done.** "Done means: tests in X pass, no changes outside
  Y, report what you changed." Claude follows completion criteria
  reliably when they're explicit.
- **Demand grounding for claims.** For reviews/research: "cite
  file:line for every finding; label anything you could not verify."
  Claude honors evidence contracts strictly when asked.
- **Ask for verification, get verification.** "Run the tests and show
  the output" beats "make sure it works."
- **Depth via `--effort`, not exhortation.** Use the runner's
  `--effort xhigh|max` for hard problems instead of stacking "think
  very hard" into the prompt.
- **Output contract only when parsing.** When the result will be
  acted on programmatically, pass `--schema` (the schema IS the
  contract) and state field intent in the prompt. For prose, just say
  the format ("one paragraph", "a table of X by Y").
- **Scope mutating runs explicitly.** "Only touch src/auth/ and its
  tests" — Claude respects stated scopes; unstated ones invite
  helpful-but-unwanted cleanups.

Resume follow-ups (`--resume <id>`): send only the delta instruction.
Claude retains full session context; restating the task wastes tokens
and can cause re-work.

Reusable blocks: [references/prompt-blocks.md](references/prompt-blocks.md).
End-to-end templates: [references/claude-prompt-recipes.md](references/claude-prompt-recipes.md).
Failure modes: [references/claude-prompt-antipatterns.md](references/claude-prompt-antipatterns.md).

Anti-patterns (short list):

- Numbered micro-steps for work Claude should plan itself.
- Vague quality pleas ("be thorough", "don't make mistakes") — replace
  with concrete checks.
- Asking for JSON in the prompt instead of using `--schema`.
- Repeating the original prompt on resume.
- Persona wrappers ("you are a 10x engineer") — use
  `--append-system-prompt` only for real standing rules (house style,
  banned APIs), not vibes.
