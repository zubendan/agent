# agent-loop

An unattended agent loop for Claude Code. `agent-loop` starts one fresh session after another. Each session runs as the `agent-loop:orchestrator` agent, picks up from the file baton in `agent/HANDOFF.md`, delegates backlog tasks to subagents, and hands off before its context budget runs out.

## Install

Once per machine:

```bash
claude plugin marketplace add ~/projects/agent
claude plugin install agent-loop@agent
ln -s ~/projects/agent/plugins/agent-loop/bin/agent-loop ~/.local/bin/agent-loop   # any dir on PATH
```

The marketplace is a local directory, so the plugin loads in place: edits under `~/projects/agent` take effect at the next session, with no reinstall. The runner also passes `--plugin-dir` for its own copy, so a loop run always uses the plugin next to the runner that started it.

Once per project, in a Claude Code session at the project root: `/agent-loop:init`. It writes `agent/`, fills in `agent/PROJECT.md` with you, drafts a roadmap, and wires `.gitignore`, `.claude/settings.json` and `CLAUDE.md`.

Needs `git`, `jq` and `bash`; notifications use `osascript` on macOS.

## How it works

Each session:

1. reads `agent/HANDOFF.md`, the baton left by the previous session;
2. hands backlog tasks one at a time to subagents:
   - `planner` breaks a milestone into tasks;
   - `implementer` builds one task test-first and commits it;
   - `reviewer` checks the commits and runs the checks itself;
3. commits `agent/` after every task (the resume point), then rewrites `HANDOFF.md`, commits, and exits. The next session starts fresh.

Everything specific to one project lives in `agent/PROJECT.md`: the goal documents, the check commands, the conventions files, preparation before coding (e.g. reading a library's real source), extra review and audit rules, and what only the human can do. The agents are generic and read the sections they need.

**Context budget.** Every agent stays under 30% of its context window. The `context-budget` hook reads each agent's real token use from its transcript; at 24% it tells the agent to wrap up, at 30% to stop. A subagent that runs out returns `PARTIAL`, and a fresh one continues the task. The hook reads Claude Code's transcript layout, which is not a public contract. After each session the runner checks that the hook measured both the orchestrator and its subagents, and notifies you if it didn't: then the budget is off until the hook is fixed (`AGENT_HOOK_DEBUG=/tmp/hook.log` logs every hook input).

**Handoff guard.** The Stop hook won't let the orchestrator end a session until `HANDOFF.md` is rewritten within its caps (60 lines, 5 "Recently done" entries, 15 lines of "Watch out"), `FOR-HUMAN.md` is at most 25 lines, and `agent/` is committed. Both hooks act only when `AGENT_LOOP=1`, which the runner sets, so interactive sessions are unaffected.

**Checkpoints.** The `auditor` re-evaluates direction and health, writes `agent/checkpoints/NNN.md`, prunes loop state, and rebuilds `FOR-HUMAN.md`. It runs after every milestone and after every 15 tasks closed since the last checkpoint, counted from the orchestrator's `close` commits; the orchestrator asks after each task, so a long session can't skip it. A due checkpoint stays due until it has run. Its verdict is CONTINUE, ADJUST (it edits the roadmap and backlog) or HALT (the loop stops for you). Each checkpoint is tagged `checkpoint-NNN`.

## Running it

```bash
agent-loop --dry-run   # print the next session's command
agent-loop --once      # run one session, then stop
agent-loop             # run until done, blocked, or a cap is hit
```

Run it in a terminal you can leave open, e.g. `tmux new -s loop agent-loop`.

| Setting (env) | Default | Meaning |
|---|---|---|
| `AGENT_MAX_SESSIONS` | 40 | Sessions per run (`--max-sessions`) |
| `AGENT_CHECKPOINT_EVERY_TASKS` | 15 | Periodic checkpoint cadence, in tasks closed |
| `AGENT_CONTEXT_BUDGET_PCT` | 30 | Context budget, % of window |
| `AGENT_CONTEXT_WINDOW` | 1000000 | Window the budget is measured against. Match the model: `opus[1m]` is 1M. The runner warns on a mismatch |
| `AGENT_MODEL` | unset | `--model` for every session |
| `AGENT_MAX_BUDGET_USD` | unset | Spend cap per session (`--max-budget-usd`). A session that hits it counts as failed |

## The loop stops when

- You press Ctrl-C. The session in progress is abandoned; the next run resumes from the last per-task commit.
- `agent/STOP` exists. `touch agent/STOP` stops after the current session; delete it to allow runs again.
- `HANDOFF.md` says `status: DONE` or `status: BLOCKED`. For BLOCKED, read `FOR-HUMAN.md` and `HANDOFF.md`, fix the blocker, set `status: ACTIVE`, and rerun.
- 3 work sessions in a row commit nothing outside `agent/`, or the CLI fails 5 times in a row (retries back off from 5 minutes to 1 hour).
- The session cap is reached.

A macOS notification fires on each stop, and whenever a session changes `agent/FOR-HUMAN.md`.

## Watching and steering

- The terminal shows one line per orchestrator action: `>` marks a subagent dispatch, `=` ends a session. One implementer task can run 5–15 minutes with no new line. `--quiet` prints only session starts.
- `agent/FOR-HUMAN.md` is the short, ranked list of what the loop needs from you. Start there.
- `agent/LOG.md` has one line per session; `agent/HANDOFF.md` shows where it is now. A session that dies without its line gets a `killed` stub, at the latest when the runner next starts.
- `agent/runtime/logs/session-NNN.jsonl` is the full stream of each session (not committed).
- Answer questions in `agent/QUESTIONS.md`, and steer by editing `agent/ROADMAP.md` or `agent/BACKLOG.md` between sessions. Leave your edits uncommitted or commit them; the next session reads `git diff -- agent`, follows them, and commits them.

## Development

`bun test` in `~/projects/agent` runs the runner and hook tests in throwaway git repos; `bun run validate` runs `claude plugin validate`.
