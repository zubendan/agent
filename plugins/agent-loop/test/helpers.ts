import { expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

export const pluginRoot = join(import.meta.dirname, "..")
export const runner = join(pluginRoot, "bin", "agent-loop")
export const script = (name: string) => join(pluginRoot, "scripts", name)

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
}

export const run = (
  cwd: string,
  command: string,
  args: ReadonlyArray<string>,
  opts: { env?: Record<string, string>; input?: string } = {},
) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...gitEnv, ...opts.env }, input: opts.input })
  expect(result.status, `${command} ${args.join(" ")}: ${result.stderr}`).toBe(0)
  return result.stdout
}

export const write = (dir: string, path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), content)
}

export const commit = (dir: string, message: string, files: Record<string, string> = {}) => {
  for (const [path, content] of Object.entries(files)) write(dir, path, content)
  run(dir, "git", ["add", "-A"])
  run(dir, "git", ["commit", "-q", "--allow-empty", "-m", message])
}

/** A throwaway git repo with agent/ files; never this repository. */
export const withRepo = (files: Record<string, string>, body: (dir: string) => void) => {
  // realpath: macOS tmpdir is a symlink.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "agent-loop-")))
  try {
    run(dir, "git", ["init", "-q"])
    commit(dir, "init", files)
    body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Runs a function defined in bin/agent-loop by sourcing it. */
export const source = (dir: string, call: string, env: Record<string, string> = {}) =>
  run(dir, "bash", ["-c", `source "$1" && ${call}`, "_", runner], { env })

export const commitCount = (dir: string) => Number(run(dir, "git", ["rev-list", "--count", "HEAD"]).trim())
