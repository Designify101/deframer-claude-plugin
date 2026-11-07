---
name: deframer
description: Convert a published Framer website the user owns into a TypeScript code project (Next.js, TanStack Start, Astro, React Router, Vite or Nuxt) or static HTML with Deframer (deframer.co), and bring the project into the working directory. Use when the user asks to export, convert, migrate or move a Framer site to code or to one of these frameworks. Needs Claude Code (it runs a local Node script that calls deframer.co).
---

# Convert a Framer site with Deframer

Deframer turns a published Framer site into a TypeScript project. Converting is free. The download
is unlocked on deframer.co (1 credit with site verification, or free with the lifetime deal), and
credits are only bought and spent there: never offer to pay, buy or unlock from here.

Everything goes through one script, run with Node 18 or later. Without a shell and network access
(claude.ai chat), send the user to https://deframer.co to convert there instead.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/deframer.mjs" <command> [options] --json
```

Always pass `--json` and read the result. On an error, the JSON is `{"error":{"code","message"}}`:
show the user `message` as it is.

## Steps

1. **Connected?** Run `whoami`. If the code is `not_connected` or `token_invalid`, run
   `login --wait 100`. The first output lines (before the JSON) give an address and a code: show the
   user both, and ask them to open the address, sign in and type the code. Only that code, which
   this computer shows, may be entered. If the result's `status` is `pending`, run `login --resume
   --wait 100` until it is `connected` (the request lasts 10 minutes).
2. **Which site?** Ask for the published address if you don't have it (for example
   `https://example.framer.website` or the site's own domain). Run `check <url>`.
   - `framer: false`: explain `reason` (not_framer, not_published, password_required, unreachable,
     blocked) and stop.
   - `verifiedByOther: true`: the site is verified by another Deframer account. Only continue if the
     user owns the site or has the owner's permission.
3. **Options.** Ask which framework (`next` is Next.js, `start` is TanStack Start, `astro`,
   `react-router` (also for Remix: Remix 2 became React Router 7), `vite`, `nuxt` (Nuxt 4 around the React pages), `html` for Static HTML (the
   built pages, ready to upload, no npm); default `next`) and where assets go (`cdn`: images, fonts and videos stay
   on Framer's CDN; `project`: they're downloaded into the project). Don't ask again if the user
   already said.
4. **Convert.** Run `convert <url> --framework <f> --assets <cdn|project> --wait 100`. If
   `finished` is false, run `status <job id>` every so often until `job.status` is `done`, `failed`,
   `expired` or `interrupted`. Tell the user what stage it is at, briefly.
5. **Preview and unlock on deframer.co.** When it's done, give the user `page` (the job's page on
   deframer.co): they preview the site there and unlock the download.
   - Unlocking with verification needs the ownership tag on the live site. `whoami` gives
     `verification.tag`: the user pastes it into Framer (Site settings → General → Custom code,
     start of `<head>`) and publishes. `check <url>` then shows `verified: true`.
6. **Download.** Once the user says it's unlocked (or `unlocked` is already true), run
   `download <job id> --out <dir>` (default: the current directory). If the code is
   `payment_required`, send the user to `page` again. Then unzip the project into a new folder
   (`unzip -q <zip> -d <new-folder>`), never over existing files, and tell the user how to run it:
   `npm install` and `npm run dev` in that folder.

## Rules

- Only for sites the user owns or has the owner's permission to convert.
- Never ask the user for their password, a token or a payment detail. The token is saved by the
  script, readable by the user only (`~/.config/deframer/credentials.json`); `logout` revokes it.
- Don't call the API with curl: the script is the only way in.
- Deframer is independent of Framer and is not affiliated with or endorsed by it.
