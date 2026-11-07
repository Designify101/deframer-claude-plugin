---
description: Download a Deframer project you unlocked on deframer.co and unzip it here
argument-hint: <job-id> [folder]
allowed-tools: Bash(node:*), Bash(unzip:*)
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/deframer.mjs" download $0 --out . --json`.
If the error code is `payment_required`, give the user the job page from the message: the download
is unlocked there. Otherwise unzip the saved file into a new folder ($1 if given, else a folder
named after the zip), never over existing files, and tell the user to run `npm install` and
`npm run dev` there.
