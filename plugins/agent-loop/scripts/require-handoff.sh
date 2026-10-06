#!/usr/bin/env bash
# Stop hook: in loop runs, keeps the orchestrator from ending a session until it
# has rewritten agent/HANDOFF.md within its size caps and committed agent/. The
# next session starts from those files alone. bin/agent-loop touches the
# session.start marker before each session.
#
# The caps live here, not only in the orchestrator's prompt: written-down
# limits drifted in practice (an 83-line handoff against a cap of 60).
#
# Tunables (environment):
#   AGENT_HANDOFF_MAX_LINES      lines in agent/HANDOFF.md           (default 60)
#   AGENT_RECENT_MAX             bullets under "## Recently done"    (default 5)
#   AGENT_WATCH_MAX              lines under "## Watch out"          (default 15)
#   AGENT_FOR_HUMAN_MAX_LINES    lines in agent/FOR-HUMAN.md         (default 25)

[ "${AGENT_LOOP:-}" = "1" ] || exit 0

input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
# Only the orchestrator owns the handoff; other main-thread agents end freely.
# Plugin agents arrive namespaced (agent-loop:orchestrator, or with a plugin: prefix).
case "$(jq -r '.agent_type // empty' <<<"$input")" in
  orchestrator | *:orchestrator) ;;
  *) exit 0 ;;
esac

root=${CLAUDE_PROJECT_DIR:-$PWD}
marker="$root/agent/runtime/session.start"
[ -f "$marker" ] || exit 0
handoff="$root/agent/HANDOFF.md"

# Non-blank lines under a "## <name>" heading, up to the next "## " heading.
section_lines() {
  awk -v h="## $2" '$0 == h { on = 1; next } /^## / { on = 0 } on && NF' "$1"
}

problems=""
[ "$handoff" -nt "$marker" ] || problems="agent/HANDOFF.md has not been rewritten this session. "
if [ -f "$handoff" ]; then
  lines=$(wc -l <"$handoff" | tr -d ' ')
  max=${AGENT_HANDOFF_MAX_LINES:-60}
  [ "$lines" -le "$max" ] || problems="${problems}agent/HANDOFF.md is $lines lines (cap $max). "
  recent=$(section_lines "$handoff" "Recently done" | grep -c '^- ')
  max=${AGENT_RECENT_MAX:-5}
  [ "$recent" -le "$max" ] || problems="${problems}\"Recently done\" has $recent entries (cap $max); git log holds the rest. "
  watch=$(section_lines "$handoff" "Watch out" | wc -l | tr -d ' ')
  max=${AGENT_WATCH_MAX:-15}
  [ "$watch" -le "$max" ] ||
    problems="${problems}\"Watch out\" is $watch lines (cap $max); move lasting lessons to the files named in agent/PROJECT.md \"Knowledge\". "
fi
if [ -f "$root/agent/FOR-HUMAN.md" ]; then
  lines=$(wc -l <"$root/agent/FOR-HUMAN.md" | tr -d ' ')
  max=${AGENT_FOR_HUMAN_MAX_LINES:-25}
  [ "$lines" -le "$max" ] || problems="${problems}agent/FOR-HUMAN.md is $lines lines (cap $max); keep the top items. "
fi
[ -z "$(git -C "$root" status --porcelain -- agent 2>/dev/null)" ] ||
  problems="${problems}agent/ has uncommitted changes. "
[ -z "$problems" ] && exit 0

jq -n --arg r "Before ending the session: ${problems}Run the Hand off step of your procedure." \
  '{decision: "block", reason: $r}'
