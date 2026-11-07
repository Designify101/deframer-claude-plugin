---
name: deframer
description: Convert a published Framer website the user owns into a TypeScript code project (Next.js, TanStack Start, Astro, React Router, Vite or Nuxt) or static HTML with Deframer (deframer.co), and bring the project into the working directory. Use when the user asks to export, convert, migrate or move a Framer site to code or to one of these frameworks.
---

# Convert a Framer site with Deframer

Deframer turns a published Framer site into a TypeScript project. Converting is free. The download
is unlocked on deframer.co, and credits are only bought and spent there: never offer to pay, buy or
unlock from here.

This plugin connects Claude Code to Deframer's MCP server (`deframer`, at https://deframer.co/mcp).
The first time a tool is used, Claude Code asks the user to sign in to deframer.co and approve the
connection (or run `/mcp` and choose deframer → Authenticate). No password or token ever passes
through the chat.

## Steps

1. **Connected?** Call `get_account`. It shows the account's email, credits and the site ownership
   tag. If it isn't authenticated yet, ask the user to run `/mcp` and authenticate deframer.
2. **Which site?** Ask for the published address if you don't have it (for example
   `https://example.framer.website` or the site's own domain). Call `check_site`.
   - Not a Framer site, not published, password-protected or unreachable: explain it and stop.
   - Verified by another Deframer account: only continue if the user owns the site or has the
     owner's permission.
3. **Options.** Ask which framework: `next` (Next.js, default), `start` (TanStack Start), `astro`,
   `react-router` (also for Remix), `vite`, `nuxt`, or `html` (Static HTML: built pages to upload,
   no npm). Ask whether images, fonts and videos stay on Framer's CDN (`includeAssets: false`) or go
   into the project (`includeAssets: true`). Don't ask again if the user already said.
4. **Convert.** Call `start_conversion`, then `get_conversion` every few seconds until the status is
   `done`, `failed`, `expired` or `interrupted`. Tell the user the stage briefly.
5. **Preview, unlock and download on deframer.co.** When it's done, give the user the job's `page`.
   They preview the site there, unlock it and download the zip.
   - Unlocking with verification needs the ownership tag on the live site: `get_account` gives it.
     The user pastes it into Framer (Site settings → General → Custom code, start of `<head>`) and
     publishes. `check_site` then shows the site as verified.
6. **Bring it in.** When the user has the zip, unzip it into a new folder in the working directory
   (never over existing files), and tell them to run `npm install` and `npm run dev` there.

## Rules

- Only for sites the user owns or has the owner's permission to convert.
- Never ask the user for a password, a token or a payment detail.
- Deframer is independent of Framer and is not affiliated with or endorsed by it.
