// The plugin's CLI (scripts/deframer.mjs) against a local mock of the Deframer client API: login
// through the connect flow (the token saved readable by the user only), convert and poll, a 402 on
// download sends the user to deframer.co, an unlocked download is saved, a revoked token signs out.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { main } from "../scripts/deframer.mjs";

const TOKEN = `dfk_${"t".repeat(43)}`;
const JOB = "0b9f0c1e-2c1d-4d4e-9f00-123456789abc";
const state = { polls: 0, jobPolls: 0, unlocked: false, revoked: false, seen: /** @type {Array<{ method: string, url: string, body: any, token?: string }>} */ ([]) };
let origin = "";

const server = createServer(async (request, response) => {
  let text = "";
  for await (const chunk of request) text += chunk;
  const body = text ? JSON.parse(text) : undefined;
  const token = /** @type {string | undefined} */ (request.headers["x-deframer-token"]);
  state.seen.push({ method: request.method ?? "", url: request.url ?? "", body, token });
  const send = (status, data) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(data));
  };
  const job = (status) => ({ id: JOB, url: "https://acme.framer.website/", status, stage: status === "done" ? "done" : "converting", progress: status === "done" ? 1 : 0.5, framework: "next", assets: "cdn", createdAt: 1, download: { filename: "../acme next.zip", bytes: 4, files: 12, available: true } });
  if (request.url !== "/api/connect/start" && request.url !== "/api/connect/poll" && !request.url?.startsWith("/api/client/download/")) {
    if (token !== TOKEN || state.revoked) return send(401, { error: { code: "token_invalid", message: "Connect again." } });
  }
  switch (`${request.method} ${request.url}`) {
    case "POST /api/connect/start":
      assert.equal(body.client, "claude-code");
      return send(201, { requestId: "req1", pollSecret: "secret", userCode: "BCDF-GHJK", verifyUrl: `${origin}/connect/req1`, interval: 0.01, expiresAt: Date.now() + 600_000 });
    case "POST /api/connect/poll":
      return ++state.polls < 2 ? send(202, { status: "pending" }) : send(200, { status: "approved", token: TOKEN, account: { email: "owner@example.com", credits: 3 } });
    case "GET /api/client/me":
      return send(200, { email: "owner@example.com", name: null, credits: 3, lifetime: false, verification: { code: "dfv_x", metaName: "deframer-verification", tag: '<meta name="deframer-verification" content="dfv_x">' }, costs: { verifiedDownload: 1, directDownload: 10 }, links: {} });
    case "POST /api/client/site":
      return send(200, { url: body.url, framer: true, verified: false, verifiedByOther: false, title: "Acme" });
    case "POST /api/jobs":
      return send(202, { job: job("running") });
    case `GET /api/jobs/${JOB}`:
      return send(200, { job: job(++state.jobPolls < 2 ? "running" : "done"), unlocked: state.unlocked });
    case `POST /api/jobs/${JOB}/download-link`:
      return state.unlocked ? send(200, { url: `${origin}/api/client/download/${"s".repeat(43)}`, expiresAt: Date.now() + 300_000 }) : send(402, { error: { code: "payment_required", message: "Unlock it." } });
    case `GET /api/client/download/${"s".repeat(43)}`:
      response.writeHead(200, { "content-type": "application/zip" });
      return response.end("PK..");
    case "POST /api/connect/revoke":
      state.revoked = true;
      response.writeHead(204);
      return response.end();
    default:
      return send(404, { error: { code: "not_found", message: "No such route." } });
  }
});

before(async () => {
  await new Promise((done) => server.listen(0, "127.0.0.1", () => done(undefined)));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(() => server.close());

const config = mkdtempSync(join(tmpdir(), "deframer-plugin-"));
const run = async (...argv) => {
  let out = "";
  let err = "";
  const code = await main([...argv, "--json"], { DEFRAMER_API: origin, DEFRAMER_CONFIG_DIR: config }, { out: (text) => (out += text), err: (text) => (err += text) });
  return { code, data: JSON.parse(out.trim().split("\n").pop() || "{}"), err };
};

test("not connected: a clear error", async () => {
  const { code, data } = await run("whoami");
  assert.equal(code, 1);
  assert.equal(data.error.code, "not_connected");
});

test("login through the connect flow; the token is saved for the user only", async () => {
  const { code, data } = await run("login", "--wait", "5");
  assert.equal(code, 0);
  assert.equal(data.status, "connected");
  assert.equal(data.userCode, "BCDF-GHJK");
  const file = join(config, "credentials.json");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).token, TOKEN);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal((await run("whoami")).data.email, "owner@example.com");
});

test("check, convert and poll; the download needs an unlock on deframer.co", async () => {
  assert.equal((await run("check", "acme.framer.website")).data.url, "https://acme.framer.website/");
  const converted = await run("convert", "https://acme.framer.website", "--framework", "nextjs", "--assets", "project", "--wait", "10");
  assert.equal(converted.code, 0);
  assert.equal(converted.data.job.status, "done");
  assert.equal(converted.data.page, `${origin}/jobs/${JOB}`);
  const created = state.seen.find((call) => call.url === "/api/jobs");
  assert.deepEqual(created?.body, { url: "https://acme.framer.website/", framework: "next", includeAssets: true, source: "claude-code" });

  const locked = await run("download", JOB, "--out", config);
  assert.equal(locked.data.error.code, "payment_required");
  assert.match(locked.data.error.message, /deframer\.co first/);
  assert.ok(!state.seen.some((call) => call.url.includes("/unlock")), "never unlocks");

  state.unlocked = true;
  const saved = await run("download", JOB, "--out", config);
  assert.equal(saved.code, 0);
  assert.ok(saved.data.saved.startsWith(config) && saved.data.saved.endsWith("acme-next.zip"), "a plain file name in the folder asked for");
  assert.equal(readFileSync(saved.data.saved, "utf8"), "PK..");
  assert.equal((await run("convert", "x", "--framework", "angular")).data.error.code, "invalid_request");
});

test("a revoked token signs out; logout forgets it", async () => {
  state.revoked = true;
  assert.equal((await run("whoami")).data.error.code, "token_invalid");
  assert.ok(!readdirSync(config).includes("credentials.json"));
  assert.equal((await run("logout")).data.status, "signed_out");
});

test("only https, or http on localhost", async () => {
  let out = "";
  const code = await main(["whoami", "--json"], { DEFRAMER_API: "http://deframer.co", DEFRAMER_CONFIG_DIR: config }, { out: (text) => (out += text), err: () => {} });
  assert.equal(code, 1);
  assert.match(JSON.parse(out).error.message, /https/);
});
