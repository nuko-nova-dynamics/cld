# Prompt failure routing

Apply a correction only when its failure mode is present.

| Failure | Correction |
|---|---|
| Blanket `xhigh` or `max` for any difficult task | Start from the selected model's guidance, evaluate quality/cost, and raise effort for a specific gap. |
| Guessed line edits or an unnecessary implementation script | Supply observed failure, constraints, and acceptance criteria. Preserve numbered steps where order or required coverage matters. |
| “Be thorough” repeated across prompts | Name the missing check. Remove repetitive self-verification once relevant checks pass. |
| Asking for a private reasoning transcript | Request conclusions, evidence, and a concise rationale. Direct API clients can request supported thinking summaries; do not demand reproduction of hidden reasoning. |
| Assuming persona wording guarantees expertise | State domain context and review criteria. A useful role can focus behavior; grandiose credentials add no evidence. |
| Treating any JSON as schema-validated | Use `--schema` and require successful `structured_output`. Parsing fenced prose is not schema validation. |
| Repeating all context on every resume | Send the delta, changed constraints, and evidence; restore required launch flags and correct `--cd`. Re-ground after compaction when needed. |
| Answering current model questions from memory | Retrieve the exact name and current primary docs, especially with Fable 5.1 at low effort. |
| Whole-file rewrites for small fixes | Ask for targeted edits and report adjacent concerns separately. |
| “Next I will…” as the final result of unfinished work | Name remaining acceptance criteria and resume within limits. Distinguish a completed turn from a completed task. |
| A prompt requests progress but nothing appears | This runner buffers stdout. For custom API clients, inspect thinking progress blocks and display configuration; prompt wording alone cannot fix rendering. |
| “No tools” implemented only with `--tools ""` | Also restrict MCP with `--strict-mcp-config` and no supplied configs. Hooks/configuration still need separate consideration. |
| Read-only review silently promoted to writes after a denial | Inspect the blocked action, preserve scope, and use read-only evidence or an authorized narrow permission. |
| Trusting findings or task reports at face value | Inspect source, diffs, and verification artifacts before acting. |

Use a single coherent run for an authorized task with several required steps. Split runs when permission, context, or independent verification benefits from separation; do not split merely because a task contains several verbs.

Sources: [prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [model-specific guidance](models-and-migration.md), [CLI reference](https://code.claude.com/docs/en/cli-reference).
