#!/usr/bin/env node
// @ts-check
// The Deframer plugin's command line: the skill and commands run it with Node 18 or later. No
// dependencies. It talks to the Deframer client API (clients/shared/src/contract.ts) with a `dfk_`
// token from the connect flow: the user approves on deframer.co by typing the code shown here.
//
//   login [--resume] [--wait S]   connect this computer (the token is saved, readable by you only)
//   whoami                        the account: email, credits, the verification tag
//   check <url>                   is it a published Framer site, does it carry your tag
//   convert <url> [--framework next|start|astro|react-router|vite|nuxt|html] [--assets cdn|project] [--fresh] [--wait S]
//   status <job-id>
//   download <job-id> [--out DIR] a download unlocked on deframer.co, saved as a .zip
//   logout                        revoke the token and forget it
//
// Every command takes --json (one JSON object on stdout). Credits are never spent here: a download
// is unlocked (and paid for) on deframer.co, on the job's page.
//
// Environment: DEFRAMER_API (default https://deframer.co; https, or http on localhost),
// DEFRAMER_CONFIG_DIR (default ~/.config/deframer), DEFRAMER_TOKEN (use this token, save nothing).

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FRAMEWORKS = ["next", "start", "astro", "react-router", "vite", "nuxt", "html"];
const FRAMEWORK_ALIASES = { nextjs: "next", "next.js": "next", tanstack: "start", "tanstack-start": "start", reactrouter: "react-router", remix: "react-router", static: "html", "static-html": "html", nuxtjs: "nuxt", "nuxt.js": "nuxt" };
const TOKEN_SHAPE = /^dfk_[A-Za-z0-9_-]{43}$/;
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_ZIP_BYTES = 512 * 1024 * 1024;

class CliError extends Error {
  /** @param {string} message @param {string} [code] @param {Record<string, unknown>} [extra] */
  constructor(message, code = "error", extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

/** @param {NodeJS.ProcessEnv} env */
function apiOrigin(env) {
  const raw = env.DEFRAMER_API || "https://deframer.co";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError(`DEFRAMER_API is not a URL: ${raw}`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new CliError("DEFRAMER_API must be https (or http on localhost).");
  return url.origin;
}

/** @param {NodeJS.ProcessEnv} env */
function configDir(env) {
  return env.DEFRAMER_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "deframer");
}

/** Writes JSON readable by the user only. @param {string} file @param {unknown} data */
function writePrivate(file, data) {
  mkdirSync(resolve(file, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

/** @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** The saved credentials for this API origin. @param {NodeJS.ProcessEnv} env */
function savedToken(env) {
  if (env.DEFRAMER_TOKEN) return env.DEFRAMER_TOKEN.trim();
  const saved = readJson(join(configDir(env), "credentials.json"));
  return saved && saved.origin === apiOrigin(env) && typeof saved.token === "string" ? saved.token : undefined;
}

/** @param {NodeJS.ProcessEnv} env */
function requireToken(env) {
  const token = savedToken(env);
  if (!token || !TOKEN_SHAPE.test(token)) throw new CliError("Not connected to Deframer. Run the login command first.", "not_connected");
  return token;
}

/**
 * A request to the API. Errors become CliError with the server's message (written for the user).
 * @param {NodeJS.ProcessEnv} env @param {string} method @param {string} path @param {{ body?: unknown, token?: string }} [options]
 */
async function api(env, method, path, options = {}) {
  /** @type {Record<string, string>} */
  const headers = { accept: "application/json", "user-agent": "deframer-claude-plugin/1.1" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.token) headers["x-deframer-token"] = options.token;
  let response;
  try {
    response = await fetch(apiOrigin(env) + path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: "error", signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new CliError(`Couldn't reach Deframer (${error instanceof Error ? error.message : error}).`, "offline");
  }
  const text = await response.text();
  /** @type {any} */
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}
  if (response.status === 401 && options.token) {
    if (!env.DEFRAMER_TOKEN) rmSync(join(configDir(env), "credentials.json"), { force: true });
    throw new CliError("This connection was revoked or has expired. Run the login command again.", "token_invalid");
  }
  return { status: response.status, data, retryAfter: response.headers.get("retry-after") };
}

/** @param {{ status: number, data: any }} reply */
function fail(reply) {
  const error = reply.data && reply.data.error;
  throw new CliError(error?.message || `Deframer answered HTTP ${reply.status}.`, error?.code || `http_${reply.status}`, error?.verification ? { verification: error.verification } : {});
}

const sleep = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms));

/** @param {string} id @param {NodeJS.ProcessEnv} env */
const jobPage = (id, env) => `${apiOrigin(env)}/jobs/${encodeURIComponent(id)}`;

/** @param {string} value */
function siteUrl(value) {
  if (!value) throw new CliError("Give the published site's address, e.g. https://example.framer.website", "invalid_request");
  const text = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(text).toString();
  } catch {
    throw new CliError(`That isn't an address: ${value}`, "invalid_request");
  }
}

/** @param {string} value */
function framework(value) {
  const name = (value || "next").toLowerCase();
  const resolved = /** @type {Record<string, string>} */ (FRAMEWORK_ALIASES)[name] || name;
  if (!FRAMEWORKS.includes(resolved)) throw new CliError(`Framework: one of ${FRAMEWORKS.join(", ")}.`, "invalid_request");
  return resolved;
}

// ---- commands

/** @param {NodeJS.ProcessEnv} env @param {{ resume?: boolean, wait: number }} options @param {(line: string) => void} say */
async function login(env, options, say) {
  const dir = configDir(env);
  const pendingFile = join(dir, "pending.json");
  let pending = options.resume ? readJson(pendingFile) : undefined;
  if (options.resume && (!pending || pending.origin !== apiOrigin(env) || pending.expiresAt <= Date.now())) throw new CliError("No connection is waiting. Run login again.", "expired");
  if (!pending) {
    const reply = await api(env, "POST", "/api/connect/start", { body: { client: "claude-code", name: `Claude Code · ${hostname().slice(0, 40)}` } });
    if (reply.status !== 201) fail(reply);
    pending = { origin: apiOrigin(env), requestId: reply.data.requestId, pollSecret: reply.data.pollSecret, userCode: reply.data.userCode, verifyUrl: reply.data.verifyUrl, interval: reply.data.interval, expiresAt: reply.data.expiresAt };
    writePrivate(pendingFile, pending);
  }
  say(`Open ${pending.verifyUrl}`);
  say(`and enter this code: ${pending.userCode}`);
  const until = Math.min(Date.now() + options.wait * 1000, pending.expiresAt);
  while (Date.now() < until) {
    await sleep(Math.max(1, pending.interval || 2) * 1000);
    const reply = await api(env, "POST", "/api/connect/poll", { body: { requestId: pending.requestId, pollSecret: pending.pollSecret } });
    if (reply.status === 202) continue;
    rmSync(pendingFile, { force: true });
    if (reply.status === 200 && reply.data.status === "approved" && TOKEN_SHAPE.test(reply.data.token)) {
      writePrivate(join(dir, "credentials.json"), { origin: apiOrigin(env), token: reply.data.token, email: reply.data.account?.email ?? null, savedAt: new Date().toISOString() });
      return { status: "connected", email: reply.data.account?.email ?? null, credits: reply.data.account?.credits ?? null, verifyUrl: pending.verifyUrl, userCode: pending.userCode };
    }
    if (reply.status === 410) throw new CliError(reply.data.status === "denied" ? "The connection was denied on deframer.co." : "The connection request expired. Run login again.", reply.data.status || "expired");
    fail(reply);
  }
  return { status: "pending", verifyUrl: pending.verifyUrl, userCode: pending.userCode, next: "Run login --resume once the code is entered." };
}

/** @param {NodeJS.ProcessEnv} env */
async function whoami(env) {
  const reply = await api(env, "GET", "/api/client/me", { token: requireToken(env) });
  if (reply.status !== 200) fail(reply);
  return reply.data;
}

/** @param {NodeJS.ProcessEnv} env @param {string} url */
async function check(env, url) {
  const reply = await api(env, "POST", "/api/client/site", { token: requireToken(env), body: { url: siteUrl(url) } });
  if (reply.status !== 200) fail(reply);
  return reply.data;
}

/** @param {NodeJS.ProcessEnv} env @param {string} id */
async function status(env, id) {
  if (!JOB_ID.test(id || "")) throw new CliError("Give a conversion id (a UUID).", "invalid_request");
  const reply = await api(env, "GET", `/api/jobs/${id}`, { token: requireToken(env) });
  if (reply.status !== 200) fail(reply);
  return { ...reply.data, page: jobPage(id, env) };
}

/**
 * @param {NodeJS.ProcessEnv} env @param {string} url
 * @param {{ framework: string, assets: string, fresh: boolean, wait: number }} options @param {(line: string) => void} say
 */
async function convert(env, url, options, say) {
  const token = requireToken(env);
  if (options.assets !== "cdn" && options.assets !== "project") throw new CliError("Assets: cdn (stay on Framer's CDN) or project (downloaded into the project).", "invalid_request");
  const body = { url: siteUrl(url), framework: framework(options.framework), includeAssets: options.assets === "project", ...(options.fresh ? { fresh: true } : {}), source: "claude-code" };
  const reply = await api(env, "POST", "/api/jobs", { token, body });
  if (reply.status !== 202 && reply.status !== 200) fail(reply);
  let job = reply.data.job;
  say(`${reply.data.reused ? "Reusing a recent conversion" : "Converting"} ${job.url} → ${job.framework ?? body.framework} (${job.id})`);
  const until = Date.now() + options.wait * 1000;
  let unlocked = false;
  while (!["done", "failed", "expired", "interrupted"].includes(job.status) && Date.now() < until) {
    await sleep(2000);
    const next = await status(env, job.id);
    job = next.job;
    unlocked = next.unlocked;
  }
  if (job.status === "done" && !unlocked) unlocked = (await status(env, job.id)).unlocked;
  return { job, unlocked, page: jobPage(job.id, env), finished: ["done", "failed", "expired", "interrupted"].includes(job.status) };
}

/** @param {NodeJS.ProcessEnv} env @param {string} id @param {{ out: string }} options */
async function download(env, id, options) {
  const token = requireToken(env);
  const { job } = await status(env, id);
  if (job.status !== "done" || !job.download?.available) throw new CliError(job.status === "done" ? "This project's files are gone. Convert the site again." : "This conversion isn't finished yet.", "not_ready");
  const reply = await api(env, "POST", `/api/jobs/${id}/download-link`, { token });
  if (reply.status === 402) throw new CliError(`Unlock the download on deframer.co first (credits are only used there): ${jobPage(id, env)}`, "payment_required", { page: jobPage(id, env) });
  if (reply.status !== 200) fail(reply);
  const link = new URL(reply.data.url);
  if (link.origin !== apiOrigin(env) || !link.pathname.startsWith("/api/client/download/")) throw new CliError("Unexpected download address.", "invalid_response");
  const file = await fetch(link, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!file.ok || !file.body) throw new CliError(`The download failed (HTTP ${file.status}). Try again.`, "download_failed");
  const declared = Number(file.headers.get("content-length") || 0);
  if (declared > MAX_ZIP_BYTES) throw new CliError("The download is larger than expected.", "too_large");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_ZIP_BYTES) throw new CliError("The download is larger than expected.", "too_large");
  // The name the server gave, reduced to a plain file name.
  const name = basename(String(job.download.filename || `deframer-${id}.zip`)).replace(/[^A-Za-z0-9._-]/g, "-").replace(/^\.+/, "") || `deframer-${id}.zip`;
  const dir = resolve(options.out || ".");
  mkdirSync(dir, { recursive: true });
  let target = join(dir, name.endsWith(".zip") ? name : `${name}.zip`);
  for (let n = 2; existsSync(target); n++) target = join(dir, name.replace(/(\.zip)?$/, `-${n}.zip`));
  writeFileSync(target, bytes, { flag: "wx" });
  return { saved: target, bytes: bytes.length, files: job.download.files ?? null };
}

/** @param {NodeJS.ProcessEnv} env */
async function logout(env) {
  const token = savedToken(env);
  if (token && TOKEN_SHAPE.test(token)) await api(env, "POST", "/api/connect/revoke", { token }).catch(() => undefined);
  if (!env.DEFRAMER_TOKEN) rmSync(join(configDir(env), "credentials.json"), { force: true });
  rmSync(join(configDir(env), "pending.json"), { force: true });
  return { status: "signed_out" };
}

// ---- the command line

/** @param {string[]} argv */
function parse(argv) {
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) flags[key] = inline;
    else if (["json", "resume", "fresh"].includes(key)) flags[key] = true;
    else flags[key] = argv[++i] ?? "";
  }
  return { positional, flags };
}

/** @param {string | boolean | undefined} value @param {number} fallback */
function seconds(value, fallback) {
  const n = Number(value);
  return typeof value === "string" && Number.isFinite(n) && n >= 0 ? Math.min(n, 540) : fallback;
}

/**
 * Runs one command; the exit code. @param {string[]} argv @param {NodeJS.ProcessEnv} env
 * @param {{ out: (text: string) => void, err: (text: string) => void }} io
 */
export async function main(argv, env = process.env, io = { out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text) }) {
  const { positional, flags } = parse(argv);
  const [command, arg] = positional;
  const json = flags.json === true;
  const say = (/** @type {string} */ line) => {
    if (!json) io.out(`${line}\n`);
  };
  try {
    /** @type {any} */
    let result;
    // The API's address is checked before anything else: https, or http on localhost.
    apiOrigin(env);
    switch (command) {
      case "login":
        result = await login(env, { resume: flags.resume === true, wait: seconds(flags.wait, 100) }, say);
        if (!json) say(result.status === "connected" ? `Connected${result.email ? ` as ${result.email}` : ""}.` : result.next);
        break;
      case "whoami":
        result = await whoami(env);
        if (!json) say(`${result.email} · ${result.lifetime ? "lifetime deal" : `${result.credits} credits`}\nOwnership tag: ${result.verification.tag}`);
        break;
      case "check":
        result = await check(env, arg);
        if (!json) say(`${result.url}: ${result.framer ? "a published Framer site" : `can't be converted (${result.reason})`}${result.framer ? (result.verified ? " · ownership verified" : result.verifiedByOther ? " · verified by another account" : " · ownership not verified yet") : ""}`);
        break;
      case "convert":
        result = await convert(env, arg, { framework: String(flags.framework ?? "next"), assets: String(flags.assets ?? "cdn"), fresh: flags.fresh === true, wait: seconds(flags.wait, 100) }, say);
        if (!json) {
          const job = result.job;
          if (job.status === "done") say(`Done. Preview, unlock and download: ${result.page}${result.unlocked ? " (already unlocked: the download command can fetch it)" : ""}`);
          else if (result.finished) say(`It stopped (${job.status}): ${job.error?.message ?? "see the job page"} ${result.page}`);
          else say(`Still converting (${Math.round(job.progress * 100)}%). Check again with: status ${job.id}`);
        }
        break;
      case "status":
        result = await status(env, arg);
        if (!json) say(`${result.job.status} · ${result.job.stage} · ${Math.round(result.job.progress * 100)}% · ${result.unlocked ? "unlocked" : "not unlocked"} · ${result.page}`);
        break;
      case "download":
        result = await download(env, arg, { out: String(flags.out ?? ".") });
        if (!json) say(`Saved ${result.saved} (${result.bytes} bytes).`);
        break;
      case "logout":
        result = await logout(env);
        if (!json) say("Signed out of Deframer on this computer.");
        break;
      default:
        io.err("Usage: deframer.mjs login|whoami|check <url>|convert <url> [--framework next] [--assets cdn|project]|status <id>|download <id> [--out dir]|logout [--json]\n");
        return 2;
    }
    if (json) io.out(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const known = error instanceof CliError;
    const body = { error: { code: known ? error.code : "error", message: error instanceof Error ? error.message : String(error), ...(known ? error.extra : {}) } };
    if (json) io.out(`${JSON.stringify(body)}\n`);
    else io.err(`${body.error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
