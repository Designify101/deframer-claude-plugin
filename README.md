# Deframer for Claude Code

Turn a published Framer site you own into a TypeScript project, without leaving Claude Code. Ask
"convert my Framer site to Next.js" and Claude checks the site, converts it with Deframer
(deframer.co) and follows the conversion. You preview, unlock and download the project on
deframer.co, and Claude unzips it into your repository.

Frameworks: Next.js, TanStack Start, Astro, React Router, Vite and Nuxt, or Static HTML (the built
pages, ready to upload). Assets can stay on Framer's CDN or be downloaded into the project.

## Install

```
/plugin marketplace add Designify101/deframer-claude-plugin
/plugin install deframer@deframer
```

The plugin adds Deframer's MCP server (`https://deframer.co/mcp`). The first time you use it, run
`/mcp`, choose **deframer** and **Authenticate**: you sign in on deframer.co and approve the
connection. Then ask Claude, or use the commands:

- `/deframer:convert <site-url> [next|start|astro|react-router|vite|nuxt|html] [cdn|project]`
- `/deframer:download [zip-path] [folder]` unzips a project you downloaded from deframer.co.

## Credits and payment

Converting is free. Downloads are unlocked on deframer.co, and credits are only bought and spent
there. The connection can read your account, check sites and start conversions; it can't spend
credits, unlock or download. Disconnect it any time under Dashboard → Connected apps.

## Privacy

The plugin sends deframer.co the site addresses you convert. Sign-in is OAuth: no password or token
goes through the chat, and the plugin stores nothing itself.
Privacy policy: https://deframer.co/privacy · Terms: https://deframer.co/terms · Support:
https://deframer.co/contact

Only for sites you own or have the owner's permission to convert. Deframer is independent of Framer
and is not authorized by, endorsed by, sponsored by or affiliated with Framer. Framer is a trademark
of its owner.
