# Project profile

The agent-loop agents read this file for everything specific to this project. Each section says who reads it. Keep it to what an agent cannot find by looking: name the files and commands, and don't copy their contents here.

## Goal

Read by the planner, implementer and auditor.

- Spec: `<path to the document(s) that define what done looks like>`
- Binding decisions: `<where they live, e.g. a stack table, docs/adr/>`. Changing one takes an ADR explaining what evidence overturned it.

## Checks

Read by the implementer, reviewer and auditor.

- Gate: `<command>`. Every change passes it.
- `<command>` also passes when `<condition, e.g. the change touches code its tests cover>`.
- `<gotchas about running them: services they need, flaky tests to rerun once>`

## Conventions

Read by every agent.

- Conventions live in `<CLAUDE.md, CONTEXT.md, docs/adr/, ...>`.
- Task ids: milestone tasks `M<k>-<nn>`, maintenance tasks `MAINT-<nn>`.
- Commits: conventional commits starting with the task id, e.g. `feat(scope): M3-02 <summary>`. History is append-only: fix mistakes with a new commit.

## Knowledge

Read by the orchestrator and auditor: where each kind of lasting lesson goes, so the handoff stays short.

- Conventions and gotchas for every change: `CLAUDE.md`.
- Domain vocabulary: `<CONTEXT.md>`.
- `<other homes, e.g. how-to notes for one library: agent-patterns/<library>.md>`

## Before writing code

Read by the planner, implementer and reviewer. The preparation every task needs before the first test.

- `<e.g. ground every third-party library call in its real source at the pinned version>`

## Review checks

Read by the reviewer, on top of its standard checks.

- `<project-specific rules, or "none">`

## Audit checks

Read by the auditor at every checkpoint, on top of its standard checks.

- `<e.g. dependency versions pinned; module boundaries per docs/architecture.md>`

## Human-only

Read by the orchestrator and auditor: what the loop cannot do, so it can ask in `FOR-HUMAN.md` instead of waiting.

- `<e.g. runs against live services or credentials the loop doesn't have>`
