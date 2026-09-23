# cld domain language

- **Calling agent**: the Codex agent delegating work and verifying its result.
- **Claude run**: one invocation of the Claude Code process, from launch through cleanup.
- **Session**: Claude conversation history that can outlive a run. Resuming a session starts a new run.
- **Run record**: `run.json`, containing lifecycle state and safe launch context. It is not a replay script.
- **Artifact directory**: the unique folder owned by one run, with raw output and final results.
- **Scratch parent**: an optional caller-selected folder beneath which each run allocates its artifact directory.
- **Terminal result**: Claude Code's final `type: result` message. Successful process execution does not establish task completion.
- **Structured output**: the terminal result's canonical `structured_output` field, required when a schema was requested.
