---
description: Connect Claude Code to your Deframer account
allowed-tools: Bash(node:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/deframer.mjs" login --wait 100 --json`. Show the user the
address and code it prints first: they open the address, sign in to deframer.co and type that
code. If the result's status is `pending`, run it again with `--resume`. When connected, say which
account (email) is connected.
