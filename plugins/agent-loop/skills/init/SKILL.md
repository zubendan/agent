---
name: init
description: Set up the agent-loop autonomous loop in the current project.
disable-model-invocation: true
---

Set up this project for the agent loop: the `agent/` state files, a filled-in `agent/PROJECT.md`, a first roadmap, and the settings the loop relies on. The human is present for this skill, so ask them what the repository can't tell you.

Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`. Operator guide: `${CLAUDE_PLUGIN_ROOT}/README.md`.

## Steps

1. **Check the ground.** The working directory is a git repository with at least one commit. If `agent/` already exists, stop: show the human how it differs from the templates, and change only what they approve.
2. **Survey.** Read what defines this project without asking: `CLAUDE.md`/`AGENTS.md`, the README, the build manifest and its scripts (`package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml`, ...), CI config, `docs/`. Note candidates for every section of `templates/agent/PROJECT.md`.
3. **Ask** for what the survey left open, in one round of questions where you can:
   - the goal: which document defines done. If none exists, offer to write one with them first; the loop is only as good as its goal;
   - the gate: the command every change must pass, and any conditional check;
   - what only the human can do: credentials, live services, decisions they want to keep;
   - extra preparation, review or audit rules they care about.

   This step is done when every `<...>` placeholder in `PROJECT.md` has an answer or is deleted.
4. **Write `agent/`.** Copy `templates/agent/` into the project and fill in `PROJECT.md`. Fill in `<YYYY-MM-DD>` with today's date in `HANDOFF.md` and `LOG.md`.
5. **Draft the roadmap** with the human: three to eight milestones from the goal document, each with exit criteria a stranger can check. Put the riskiest integration early, as a spike. Set M0's name in `ROADMAP.md`, `BACKLOG.md` and `HANDOFF.md`. Leave the tasks to the planner.
6. **Wire the project.**
   - Append `agent/runtime/` and `agent/STOP` to `.gitignore`.
   - In `.claude/settings.json`, merge in: `"enabledPlugins": {"agent-loop@agent": true}`; `permissions.allow` entries for the check commands and `git`; `permissions.deny` for `Bash(git push)`, `Bash(git push *)`, `Bash(git reset --hard *)` and `Bash(git clean *)`.
   - Add `templates/CLAUDE-section.md` to the project's `CLAUDE.md`, creating it if needed.
7. **Verify.** Run `agent-loop --dry-run` from the project. It prints the first session's command; if it reports a missing file, fix it. If `agent-loop` isn't on `PATH`, tell the human the one-time setup in the README's "Install" section.
8. **Hand over.** Show the human the files you wrote and offer to commit them as `chore(agent): set up the agent loop`. Tell them the next step: `agent-loop --once` runs one session to try it; `agent-loop` runs until done, blocked or capped.
