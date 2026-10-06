## Autonomous loop

Most work here is done by an unattended agent loop: the `agent-loop` plugin, started with `agent-loop` from a terminal. Loop sessions run with `AGENT_LOOP=1`. Loop state lives in `agent/`; `agent/PROJECT.md` is this project's profile (goal, checks, conventions, what only the human can do).

**No human is present during a loop run.** When a skill or step would ask the user something, answer it from the documents `agent/PROJECT.md` `## Goal` names. If it is genuinely the user's call, add it to `agent/QUESTIONS.md` with your recommended default, apply that default, and keep going.

**Context budget:** every agent stays under 30% of its context window. The `context-budget` hook reminds you as you approach it, and its reminders are binding: finish the step in hand, then hand off (orchestrator) or return a PARTIAL report (subagent).
