# Deframer for Claude Code

Turn a published Framer site you own into a TypeScript project, without leaving Claude Code. Ask
"convert my Framer site to Next.js" and the plugin checks the site, converts it with Deframer
(deframer.co), sends you to deframer.co to preview and unlock the download, then downloads the
project and unzips it into your repository.

Frameworks: Next.js, TanStack Start, Astro, React Router, Vite and Nuxt, or Static HTML (the built
pages, ready to upload). Assets can stay on Framer's CDN or be downloaded into the project.

## Install

```
/plugin marketplace add Designify101/deframer-claude-plugin
/plugin install deframer@deframer
```

Then ask Claude, or use the commands:

- `/deframer:login` connects your Deframer account: open the address it shows, sign in, and type
  the code. The token is saved in `~/.config/deframer/credentials.json`, readable by you only.
- `/deframer:convert <site-url> [next|start|astro|react-router|vite|nuxt|html] [cdn|project]`
- `/deframer:download <job-id> [folder]`
- `/deframer:logout` revokes the token.

Requires Node 18 or later.

## Credits and payment

Converting is free. A download is unlocked on deframer.co: 1 credit when the site carries your
ownership tag, free with the lifetime deal. Credits are only bought and spent on deframer.co. This
plugin's token can't spend them: it can read your account, convert, and download what you
unlocked. You can disconnect it any time under Dashboard → Connected apps.

## Privacy

The plugin sends deframer.co the site addresses you convert and your token. It stores nothing else.
Privacy policy: https://deframer.co/privacy · Terms: https://deframer.co/terms · Support:
https://deframer.co/contact

Only for sites you own or have the owner's permission to convert. Deframer is independent of Framer
and is not authorized by, endorsed by, sponsored by or affiliated with Framer. Framer is a trademark
of its owner.

## Development

`node --test test/*.test.mjs` runs the script against a local mock of the API.
`claude plugin validate . --strict` checks the manifest. `DEFRAMER_API=https://staging…` points the
script at another deployment.
