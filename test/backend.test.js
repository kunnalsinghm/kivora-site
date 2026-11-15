const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { newDb } = require("pg-mem");
const { parseSignup } = require("../lib/validate");
const { createPgStore } = require("../lib/store");
const { waitlistHandler, adminListHandler, toCsv } = require("../lib/handlers");
const { notifySignup } = require("../lib/notify");

const fakeRes = () => ({ statusCode: 0, body: null, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } });
const req = (body, extra = {}) => ({ method: "POST", body, headers: { "x-forwarded-for": "203.0.113.9" }, ...extra });
const memStore = () => { const rows = []; return { rows, async addSignup(d) { if (rows.some((r) => r.email === d.email)) return "exists"; rows.push({ id: rows.length + 1, ...d, created_at: "2026-01-01T00:00:00.000Z" }); return "added"; }, async recentByIp() { return rows.length; }, async list() { return rows; } }; };

test("validation: normalises, allow-lists and rejects", () => {
  assert.equal(parseSignup({ email: "nope" }).error, "Enter a valid work email address.");
  assert.ok(parseSignup({ email: "a@b.co", website: "spam" }).honeypot);
  const { data } = parseSignup({ email: " Me@Example.COM ", role: "Nope", spend_range: "$1k–$10k", providers: ["OpenAI", "Bogus", "OpenAI", "Anthropic"], notes: "x".repeat(900) });
  assert.equal(data.email, "me@example.com"); assert.equal(data.role, ""); assert.equal(data.providers, "OpenAI, Anthropic"); assert.equal(data.notes.length, 500);
});

test("postgres store: add, duplicate, rate-limit count, list", async () => {
  const { Pool } = newDb().adapters.createPg();
  const store = createPgStore(new Pool());
  assert.equal(await store.addSignup({ email: "a@x.com", company: "A", providers: "OpenAI" }, "h1"), "added");
  assert.equal(await store.addSignup({ email: "a@x.com" }, "h1"), "exists");
  assert.equal(await store.addSignup({ email: "b@x.com" }, "h2"), "added");
  assert.equal(await store.recentByIp("h1", 15), 1);
  const rows = await store.list();
  assert.equal(rows.length, 2); assert.equal(rows[0].company, "A"); assert.match(rows[0].created_at, /^\d{4}-\d\d-\d\dT/);
});

test("sqlite store (local dev) works and migrates an old table", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kv-")), file = path.join(dir, "t.db");
  const { DatabaseSync } = require("node:sqlite");
  const old = new DatabaseSync(file); old.exec("CREATE TABLE waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, company TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))"); old.prepare("INSERT INTO waitlist (email) VALUES (?)").run("old@x.com"); old.close();
  process.env.DB_PATH = file; delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  delete require.cache[require.resolve("../lib/store")];
  const store = require("../lib/store").getStore();
  assert.equal(await store.addSignup({ email: "new@x.com", role: "Other" }, "h"), "added");
  assert.equal(await store.addSignup({ email: "NEW@x.com" }, "h"), "exists");
  assert.equal((await store.list()).length, 2);
});

test("waitlist handler: created, duplicate, bad email, honeypot, wrong method, throttle, notify", async () => {
  const store = memStore(), sent = []; const notify = async (d) => sent.push(d.email);
  let r = fakeRes(); await waitlistHandler(req({ email: "a@x.com" }), r, { store, notify }); assert.equal(r.statusCode, 201); assert.deepEqual(sent, ["a@x.com"]);
  r = fakeRes(); await waitlistHandler(req({ email: "a@x.com" }), r, { store, notify }); assert.equal(r.statusCode, 200); assert.equal(r.body.status, "exists"); assert.equal(sent.length, 1);
  r = fakeRes(); await waitlistHandler(req({ email: "bad" }), r, { store, notify }); assert.equal(r.statusCode, 400);
  r = fakeRes(); await waitlistHandler(req({ email: "b@x.com", website: "spam" }), r, { store, notify }); assert.equal(r.statusCode, 200); assert.equal(store.rows.length, 1);
  r = fakeRes(); await waitlistHandler(req({}, { method: "GET" }), r, { store, notify }); assert.equal(r.statusCode, 405);
  const busy = { ...memStore(), async recentByIp() { return 8; } };
  r = fakeRes(); await waitlistHandler(req({ email: "c@x.com" }), r, { store: busy, notify }); assert.equal(r.statusCode, 429);
  const broken = { async recentByIp() { throw new Error("db down"); } };
  r = fakeRes(); await waitlistHandler(req({ email: "d@x.com" }), r, { store: broken, notify }); assert.equal(r.statusCode, 500);
});

test("admin: disabled without token, 401 on wrong token, json and csv with right token", async () => {
  const store = memStore(); await store.addSignup({ email: "a@x.com", notes: "=cmd|calc" });
  const get = (token, url = "/api/admin/waitlist") => { const r = fakeRes(); return adminListHandler({ method: "GET", url, headers: token ? { "x-admin-token": token } : {} }, r, { store }).then(() => r); };
  delete process.env.ADMIN_TOKEN; assert.equal((await get("x")).statusCode, 404);
  process.env.ADMIN_TOKEN = "secret-token";
  assert.equal((await get("wrong")).statusCode, 401); assert.equal((await get()).statusCode, 401);
  const ok = await get("secret-token"); assert.equal(ok.statusCode, 200); assert.equal(ok.body.count, 1);
  const csv = await get("secret-token", "/api/admin/waitlist?format=csv"); assert.match(csv.headers["Content-Type"], /text\/csv/); assert.match(csv.body, /"'=cmd\|calc"/);
  delete process.env.ADMIN_TOKEN;
});

test("notify: sends plain text via the transport and never throws", async () => {
  const sent = []; const ok = { sendMail: async (m) => sent.push(m) };
  process.env.GMAIL_USER = "connect.kivora@gmail.com";
  assert.equal((await notifySignup({ email: "a@x.com", notes: "<b>hi</b>" }, ok)).sent, true);
  assert.equal(sent[0].to, "connect.kivora@gmail.com"); assert.match(sent[0].subject, /a@x\.com/); assert.ok(!("html" in sent[0]));
  assert.equal((await notifySignup({ email: "a@x.com" }, { sendMail: async () => { throw new Error("smtp down"); } })).sent, false);
  assert.equal((await notifySignup({ email: "a@x.com" }, null)).sent, false);
});
