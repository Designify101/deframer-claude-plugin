---
description: Convert a published Framer site into a TypeScript project with Deframer
argument-hint: <site-url> [next|start|astro|react-router|vite|nuxt|html] [cdn|project]
allowed-tools: Bash(node:*), Bash(unzip:*)
---

Convert the published Framer site $0 with Deframer, following the deframer skill.
Framework: $1 (ask if empty; default next). Assets: $2 (ask if empty; cdn or project).

Use `node "${CLAUDE_PLUGIN_ROOT}/scripts/deframer.mjs" <command> --json` for every step: whoami
(log in first if needed), check, convert, then give the user the job page on deframer.co to
preview and unlock. Credits are only spent on deframer.co.
