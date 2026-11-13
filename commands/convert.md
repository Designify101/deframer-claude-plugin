---
description: Convert a published Framer site into a TypeScript project with Deframer
argument-hint: "<site-url> [next|start|astro|react-router|vite|nuxt|html] [cdn|project]"
---

Convert the published Framer site $0 with Deframer, following the deframer skill.
Framework: $1 (ask if empty; default next). Assets: $2 (ask if empty; cdn keeps images on Framer's
CDN, project puts them in the project).

Use the Deframer MCP tools: check_site, then start_conversion, then get_conversion until it is done,
waiting the `checkAfterSeconds` each result gives between calls (6 seconds once the usual time has
passed). Give the user the live preview link when the result has one, and the project page on
deframer.co, where they compare, unlock and download. If it isn't unlocked, say once what the
download costs, from the result's `cost` line.
