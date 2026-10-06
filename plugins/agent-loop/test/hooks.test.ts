import { describe, expect, it } from "bun:test"
import { existsSync, utimesSync } from "node:fs"
import { join } from "node:path"
import { commit, run, script, withRepo, write } from "./helpers"

const handoff = (opts: { recent?: number; watch?: number; extra?: number } = {}) =>
  [
    "# Handoff",
    "status: ACTIVE",
    "",
    "## Next action",
    "Do T2.",
    "",
    "## Recently done",
    ...Array.from({ length: opts.recent ?? 3 }, (_, i) => `- T${i} done — abc${i}`),
    "",
    "## Watch out",
    ...Array.from({ length: opts.watch ?? 2 }, (_, i) => `- trap ${i}`),
    ...Array.from({ length: opts.extra ?? 0 }, () => ""),
  ].join("\n") + "\n"

const stop = (dir: string, agentType = "agent-loop:orchestrator", loop = "1") =>
  run(dir, script("require-handoff.sh"), [], {
    env: { AGENT_LOOP: loop, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ hook_event_name: "Stop", agent_type: agentType, stop_hook_active: false }),
  })

/** A repo where a session has started (the marker is older than the files written after it). */
const withSession = (files: Record<string, string>, body: (dir: string) => void) =>
  withRepo({ "agent/LOG.md": "" }, (dir) => {
    write(dir, "agent/runtime/session.start", "")
    const past = new Date(Date.now() - 60_000)
    utimesSync(join(dir, "agent/runtime/session.start"), past, past)
    commit(dir, "chore(agent): S1 handoff", files)
    body(dir)
  })

const reason = (out: string) => (out.trim() ? JSON.parse(out).reason as string : "")

describe("require-handoff", () => {
  it("lets a session with a fresh, committed handoff within its caps end", () => {
    withSession({ "agent/HANDOFF.md": handoff() }, (dir) => {
      expect(stop(dir)).toBe("")
      expect(stop(dir, "orchestrator")).toBe("")
    })
  })

  it("blocks when the handoff is over its caps, naming each one", () => {
    withSession({ "agent/HANDOFF.md": handoff({ recent: 7, watch: 16, extra: 40 }) }, (dir) => {
      const r = reason(stop(dir))
      expect(r).toContain("lines (cap 60)")
      expect(r).toContain("\"Recently done\" has 7 entries (cap 5)")
      expect(r).toContain("\"Watch out\" is 16 lines (cap 15)")
    })
  })

  it("blocks when agent/ has uncommitted changes or FOR-HUMAN.md is too long", () => {
    withSession({ "agent/HANDOFF.md": handoff() }, (dir) => {
      write(dir, "agent/FOR-HUMAN.md", "x\n".repeat(30))
      const r = reason(stop(dir))
      expect(r).toContain("agent/FOR-HUMAN.md is 30 lines (cap 25)")
      expect(r).toContain("agent/ has uncommitted changes")
    })
  })

  it("blocks when the handoff was not rewritten this session", () => {
    withRepo({ "agent/HANDOFF.md": handoff() }, (dir) => {
      write(dir, "agent/runtime/session.start", "")
      expect(reason(stop(dir))).toContain("has not been rewritten this session")
    })
  })

  it("ignores other agents and interactive sessions", () => {
    withRepo({ "agent/HANDOFF.md": handoff({ recent: 9 }) }, (dir) => {
      write(dir, "agent/runtime/session.start", "")
      expect(stop(dir, "agent-loop:implementer")).toBe("")
      expect(stop(dir, "agent-loop:orchestrator", "0")).toBe("")
    })
  })
})

describe("context-budget", () => {
  const usage = (tokens: number) =>
    JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10, cache_read_input_tokens: tokens - 10 } } }) +
    "\n"

  const post = (dir: string, input: Record<string, string>) =>
    run(dir, script("context-budget.sh"), [], {
      env: { AGENT_LOOP: "1", CLAUDE_PROJECT_DIR: dir, AGENT_CONTEXT_WINDOW: "1000", AGENT_CONTEXT_BUDGET_PCT: "30" },
      input: JSON.stringify({ hook_event_name: "PostToolUse", session_id: "s1", ...input }),
    })

  const context = (out: string) => (out.trim() ? JSON.parse(out).hookSpecificOutput.additionalContext as string : "")

  it("stays quiet under the budget, warns once near it, and says HARD at it", () => {
    withRepo({}, (dir) => {
      const t = join(dir, "t.jsonl")
      write(dir, "t.jsonl", usage(100))
      expect(post(dir, { transcript_path: t })).toBe("")
      expect(existsSync(join(dir, "agent/runtime/budget/measured-main"))).toBe(true)
      write(dir, "t.jsonl", usage(250))
      expect(context(post(dir, { transcript_path: t }))).toStartWith("Context budget WARN: 25.0%")
      expect(post(dir, { transcript_path: t })).toBe("")
      write(dir, "t.jsonl", usage(300))
      expect(context(post(dir, { transcript_path: t }))).toStartWith("Context budget HARD: 30.0%")
    })
  })

  it("reads a subagent's own transcript and marks the subagent measured", () => {
    withRepo({}, (dir) => {
      const t = join(dir, "s1.jsonl")
      write(dir, "s1.jsonl", usage(10))
      write(dir, "s1/subagents/agent-a1.jsonl", usage(290))
      expect(context(post(dir, { transcript_path: t, agent_id: "a1" }))).toStartWith("Context budget WARN: 29.0%")
      expect(existsSync(join(dir, "agent/runtime/budget/measured-sub"))).toBe(true)
      expect(existsSync(join(dir, "agent/runtime/budget/measured-main"))).toBe(false)
    })
  })
})
