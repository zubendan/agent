import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { commit, commitCount, run, runner, source, withRepo, write } from "./helpers"

describe("record_missing_log_line", () => {
  it("leaves LOG.md and history alone when the session wrote its line", () => {
    const log = "# Log\nS9 2026-10-01 work: did things | next: more\n"
    withRepo({ "agent/LOG.md": log }, (dir) => {
      source(dir, "record_missing_log_line 9")
      expect(readFileSync(join(dir, "agent/LOG.md"), "utf8")).toBe(log)
      expect(commitCount(dir)).toBe(1)
    })
  })

  it("appends and commits a killed stub when the session wrote none", () => {
    // S1 is a prefix of S10 and must not count as S10's line; no trailing newline either.
    withRepo({ "agent/LOG.md": "# Log\nS1 2026-10-01 work: x | next: y", "agent/BACKLOG.md": "- [ ] T1\n" }, (dir) => {
      // An unrelated uncommitted change (e.g. a backlog claim) must stay out of the commit.
      writeFileSync(join(dir, "agent/BACKLOG.md"), "- [~] T1\n")
      source(dir, "record_missing_log_line 10")
      const lines = readFileSync(join(dir, "agent/LOG.md"), "utf8").split("\n")
      expect(lines[1]).toBe("S1 2026-10-01 work: x | next: y")
      expect(lines[2]).toMatch(
        /^S10 \d{4}-\d{2}-\d{2} killed: no log line written \(see agent\/runtime\/logs\/session-010\.jsonl\)$/,
      )
      expect(commitCount(dir)).toBe(2)
      expect(run(dir, "git", ["status", "--porcelain"]).trim()).toBe("M agent/BACKLOG.md")
      expect(run(dir, "git", ["show", "--name-only", "--format=", "HEAD"]).trim()).toBe("agent/LOG.md")
    })
  })
})

describe("commits_outside_agent", () => {
  it("counts only commits that touch files outside agent/", () => {
    withRepo({ "agent/LOG.md": "# Log\n" }, (dir) => {
      const base = run(dir, "git", ["rev-parse", "HEAD"]).trim()
      commit(dir, "chore(agent): S1 handoff", { "agent/HANDOFF.md": "x\n" })
      expect(source(dir, `commits_outside_agent ${base}`).trim()).toBe("0")
      commit(dir, "feat: T1 code", { "src/a.ts": "a\n", "agent/BACKLOG.md": "y\n" })
      commit(dir, "chore(agent): S1 close T1", { "agent/BACKLOG.md": "z\n" })
      expect(source(dir, `commits_outside_agent ${base}`).trim()).toBe("1")
    })
  })
})

describe("tasks_since_checkpoint and checkpoint_due", () => {
  const closes = (dir: string, ids: ReadonlyArray<string>) => {
    for (const id of ids) commit(dir, `chore(agent): S3 close ${id}`)
  }

  it("counts distinct closed task ids since the newest checkpoint tag", () => {
    withRepo({ "agent/LOG.md": "" }, (dir) => {
      closes(dir, ["M0-01", "M0-02"])
      run(dir, "git", ["tag", "checkpoint-001"])
      // A task can get a second close commit (a correction); it still counts once.
      closes(dir, ["M1-01", "M1-02", "M1-02"])
      commit(dir, "chore(agent): S3 handoff")
      commit(dir, "chore(agent): S3 close MAINT-07 (mark done, park a note)")
      expect(source(dir, "tasks_since_checkpoint").trim()).toBe("3")
    })
  })

  it("raises a periodic checkpoint once the cadence is reached, and keeps it due", () => {
    withRepo({ "agent/LOG.md": "" }, (dir) => {
      closes(dir, ["T1", "T2"])
      const env = { AGENT_CHECKPOINT_EVERY_TASKS: "3" }
      expect(run(dir, runner, ["checkpoint-due"], { env }).trim()).toBe("not due (2 of 3 tasks since the last checkpoint)")
      expect(existsSync(join(dir, "agent/runtime/CHECKPOINT_DUE"))).toBe(false)
      closes(dir, ["T3"])
      expect(run(dir, runner, ["checkpoint-due"], { env }).trim()).toBe(
        "due: periodic (3 tasks closed since the last checkpoint)",
      )
      expect(readFileSync(join(dir, "agent/runtime/CHECKPOINT_DUE"), "utf8")).toBe("periodic\n")
      expect(run(dir, runner, ["checkpoint-due"], { env }).trim()).toBe("due: periodic")
    })
  })

  it("reports a milestone checkpoint the orchestrator flagged with an empty file", () => {
    withRepo({ "agent/LOG.md": "" }, (dir) => {
      write(dir, "agent/runtime/CHECKPOINT_DUE", "")
      expect(run(dir, runner, ["checkpoint-due"]).trim()).toBe("due: milestone complete")
    })
  })
})

describe("runner", () => {
  it("refuses a project without agent/PROJECT.md", () => {
    withRepo({ "agent/HANDOFF.md": "status: ACTIVE\n" }, (dir) => {
      const result = Bun.spawnSync([runner, "--dry-run"], { cwd: dir })
      expect(result.exitCode).toBe(2)
      expect(result.stderr.toString()).toContain("agent/PROJECT.md is missing; run /agent-loop:init")
    })
  })

  it("prints the orchestrator command for the next session on --dry-run", () => {
    withRepo({ "agent/HANDOFF.md": "status: ACTIVE\n", "agent/PROJECT.md": "# P\n", "agent/LOG.md": "" }, (dir) => {
      const out = run(dir, runner, ["--dry-run"])
      expect(out).toContain("would run S1 (work)")
      expect(out).toContain("--agent agent-loop:orchestrator --plugin-dir")
    })
  })
})
