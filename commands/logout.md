---
description: Disconnect Claude Code from your Deframer account
allowed-tools: Bash(node:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/deframer.mjs" logout --json` and tell the user this
computer is disconnected (the token is revoked on deframer.co).
