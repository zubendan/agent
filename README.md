# agent

Personal Claude Code skills and plugins, published as a local plugin marketplace named `agent`.

```bash
claude plugin marketplace add ~/projects/agent   # once per machine
claude plugin install <plugin>@agent
```

The marketplace is a local directory, so installed plugins load in place: edit them here and the next session picks the change up.

| Plugin | What it does |
|---|---|
| [`agent-loop`](plugins/agent-loop/README.md) | Unattended agent loop: fresh sessions that resume from a file baton, with context budgets, review, and checkpoints. Set up a project with `/agent-loop:init`. |

Add a plugin under `plugins/<name>/` and list it in `.claude-plugin/marketplace.json`. `bun test` runs every plugin's tests; `bun run validate` checks the manifests.
