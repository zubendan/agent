#!/usr/bin/env bash
# PostToolUse hook: measures how much of its context window the calling agent
# (orchestrator or subagent) has used, and tells it to wrap up as it nears the
# loop's budget. Active only in loop runs (AGENT_LOOP=1, set by bin/agent-loop),
# so interactive sessions are never nagged.
#
# The transcript is flushed slightly behind the live conversation, so the
# reading trails by about one model call (the first call of a session reads
# nothing). The WARN threshold leaves headroom for that lag.
#
# Each successful reading touches agent/runtime/budget/measured-main or
# measured-sub. The runner warns when a session ends without them: the
# transcript layout read here is Claude Code's, not a public contract.
#
# Tunables (environment):
#   AGENT_CONTEXT_BUDGET_PCT   budget as % of the window        (default 30)
#   AGENT_CONTEXT_WINDOW       window size in tokens            (default 1000000)
#   AGENT_CONTEXT_WARN_RATIO   fraction of budget that warns    (default 0.8)
#   AGENT_HOOK_DEBUG           file to append hook input and readings to

[ "${AGENT_LOOP:-}" = "1" ] || exit 0

input=$(cat)
[ -n "${AGENT_HOOK_DEBUG:-}" ] && printf '%s\n' "$input" >>"$AGENT_HOOK_DEBUG"
budget_pct=${AGENT_CONTEXT_BUDGET_PCT:-30}
window=${AGENT_CONTEXT_WINDOW:-1000000}
warn_ratio=${AGENT_CONTEXT_WARN_RATIO:-0.8}

transcript=$(jq -r '.transcript_path // empty' <<<"$input")
session=$(jq -r '.session_id // "unknown"' <<<"$input")
agent_id=$(jq -r '.agent_id // empty' <<<"$input")
[ -n "$transcript" ] || exit 0

state_dir="${CLAUDE_PROJECT_DIR:-$PWD}/agent/runtime/budget"
mkdir -p "$state_dir"

# Subagents write their own transcript at <session>/subagents/agent-<id>.jsonl.
# The main thread (an --agent main thread also carries agent_id) has none, so
# it falls back to transcript_path.
file=$transcript
kind=main
if [ -n "$agent_id" ]; then
  sub="${transcript%.jsonl}/subagents/agent-${agent_id}.jsonl"
  [ -f "$sub" ] && { file=$sub; kind=sub; }
fi
[ -f "$file" ] || exit 0

# Context in use = everything sent as input on the latest model call.
used=$(grep -F '"type":"assistant"' "$file" | tail -n 1 |
  jq '.message.usage | (.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)' 2>/dev/null)
[ -n "${AGENT_HOOK_DEBUG:-}" ] && echo "measured used=${used:-none} kind=$kind file=$file" >>"$AGENT_HOOK_DEBUG"
[ -n "$used" ] || exit 0
touch "$state_dir/measured-$kind"

level=$(awk -v u="$used" -v w="$window" -v b="$budget_pct" -v r="$warn_ratio" 'BEGIN {
  p = u * 100 / w
  if (p >= b) print "HARD"; else if (p >= b * r) print "WARN"; else print "OK"
}')
[ "$level" = "OK" ] && exit 0

pct=$(awk -v u="$used" -v w="$window" 'BEGIN { printf "%.1f", u * 100 / w }')

# WARN is said once per agent; HARD repeats on every tool call.
marker="$state_dir/${session}-${agent_id:-main}.warned"
if [ "$level" = "WARN" ]; then
  [ -f "$marker" ] && exit 0
  touch "$marker"
  msg="Context budget WARN: ${pct}% of the window used (budget ${budget_pct}%). Finish the step in hand, then wrap up. Orchestrator: finish the current task, then run your Hand off step. Subagent: get the checks passing, commit, and return a PARTIAL report listing the remaining steps."
else
  msg="Context budget HARD: ${pct}% of the window used, at or over the ${budget_pct}% budget. Stop starting new work now. Orchestrator: run your Hand off step and end the session. Subagent: return your report now."
fi

jq -n --arg msg "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
