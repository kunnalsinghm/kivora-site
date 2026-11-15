const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { newDb } = require("pg-mem");
const { parseSignup } = require("../lib/validate");
const { createPgStore } = require("../lib/store");
const { waitlistHandler, adminSessionHandler, adminWaitlistHandler, toCsv } = require("../lib/handlers");
const { notifySignup } = require("../lib/notify");
const auth = require("../lib/auth");

const fakeRes = () => ({ statusCode: 0, body: null, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } });
const req = (body, extra = {}) => ({ method: "POST", body, headers: { "x-forwarded-for": "203.0.113.9" }, ...extra });
const memStore = () => {
  const rows = [], attempts = []; let nextId = 1;
  return {
    rows, attempts,
    async addSignup(d) { if (rows.some((r) => r.email === d.email)) return "exists"; rows.push({ id: nextId++, ...d, created_at: "2026-01-01T00:00:00.000Z" }); return "added"; },
    async recentByIp() { return rows.length; },
    async list() { return rows; },
    async remove(id) { const i = rows.findIndex((r) => r.id === id); if (i < 0) return false; rows.splice(i, 1); return true; },
    async recordAttempt(bucket) { attempts.push(bucket); },
    async countAttempts(bucket) { return attempts.filter((b) => b === bucket).length; },
  };
};

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

test("postgres store: delete a sign-up and count sign-in attempts", async () => {
  const { Pool } = newDb().adapters.createPg();
  const store = createPgStore(new Pool());
  await store.addSignup({ email: "a@x.com" }, "h1"); await store.addSignup({ email: "b@x.com" }, "h1");
  const [first] = await store.list();
  assert.equal(await store.remove(first.id), true);
  assert.equal(await store.remove(first.id), false); // already gone
  assert.deepEqual((await store.list()).map((r) => r.email), ["b@x.com"]);
  await store.recordAttempt("ip:1"); await store.recordAttempt("ip:1"); await store.recordAttempt("ip:2");
  assert.equal(await store.countAttempts("ip:1", 15), 2); assert.equal(await store.countAttempts("ip:2", 15), 1); assert.equal(await store.countAttempts("ip:3", 15), 0);
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
  const [row] = await store.list();
  assert.equal(await store.remove(row.id), true); assert.equal(await store.remove(row.id), false); assert.equal((await store.list()).length, 1);
  await store.recordAttempt("ip:9"); await store.recordAttempt("ip:9");
  assert.equal(await store.countAttempts("ip:9", 15), 2); assert.equal(await store.countAttempts("ip:8", 15), 0);
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

const SECRET = "test-session-secret-that-is-at-least-32-chars";
const setAdmin = async (users) => {
  const list = [];
  for (const [email, pw] of users) list.push(`${email}:${await auth.hashPassword(pw)}`);
  process.env.ADMIN_USERS = list.join(","); process.env.SESSION_SECRET = SECRET;
};
const clearAdmin = () => { delete process.env.ADMIN_USERS; delete process.env.SESSION_SECRET; };
const CSRF = { "x-requested-with": "kivora-admin" };
const call = (handler, { method = "GET", url = "/", headers = {}, body } = {}, deps = {}) => {
  const r = fakeRes();
  return handler({ method, url, body, headers: { "x-forwarded-for": "203.0.113.50", ...headers } }, r, deps).then(() => r);
};
const signIn = (store, email, password, extra = {}) => call(adminSessionHandler, { method: "POST", headers: CSRF, body: { email, password }, ...extra }, { store });
const cookieOf = (r) => String(r.headers["Set-Cookie"]).split(";")[0];

test("auth: password hashes verify, reject wrong and malformed, and are salted", async () => {
  const h = await auth.hashPassword("correct horse battery"), h2 = await auth.hashPassword("correct horse battery");
  assert.match(h, /^scrypt\$16384\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/); assert.notEqual(h, h2);
  assert.equal(await auth.verifyPassword("correct horse battery", h), true);
  assert.equal(await auth.verifyPassword("wrong", h), false);
  for (const bad of ["", "plain", "scrypt$1$2$3$aa$bb", "scrypt$16384$8$1$$", "md5$x"]) assert.equal(await auth.verifyPassword("x", bad), false);
});

test("auth: ADMIN_USERS parsing and signed sessions (tampered, expired, removed user, wrong secret)", async () => {
  await setAdmin([["Boss@Example.com", "a-long-password-1"]]);
  assert.deepEqual([...auth.parseUsers().keys()], ["boss@example.com"]);
  assert.equal(auth.parseUsers("junk,no-at:scrypt$x,a@b.co:nothash").size, 0);
  const c = auth.sessionCookie("boss@example.com", true);
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Secure/); assert.match(c, /Path=\/api\/admin/);
  const value = c.split(";")[0];
  assert.equal(auth.readSession(value), "boss@example.com");
  assert.equal(auth.readSession(value.slice(0, -2) + "xx"), null); // tampered signature
  const [body] = value.split("=")[1].split(".");
  const forged = Buffer.from(JSON.stringify({ e: "boss@example.com", exp: Date.now() + 1e9 })).toString("base64url");
  assert.equal(auth.readSession(`${auth.COOKIE}=${forged}.${value.split(".")[1]}`), null); // payload swapped, signature reused
  assert.ok(body.length > 0);
  assert.equal(auth.readSession(value, Date.now() + 9 * 3600000), null); // expired after 8 hours
  process.env.SESSION_SECRET = "a-different-secret-that-is-also-32-chars!"; assert.equal(auth.readSession(value), null); // secret changed
  process.env.SESSION_SECRET = SECRET; process.env.ADMIN_USERS = ""; assert.equal(auth.readSession(value), null); // account removed
  clearAdmin();
});

test("admin: switched off until accounts and a strong secret are set", async () => {
  clearAdmin();
  assert.equal((await call(adminSessionHandler)).statusCode, 404);
  assert.equal((await call(adminWaitlistHandler)).statusCode, 404);
  await setAdmin([["boss@example.com", "a-long-password-1"]]); process.env.SESSION_SECRET = "too-short";
  assert.equal((await call(adminSessionHandler)).statusCode, 404);
  clearAdmin();
});

test("admin sign-in: success sets a safe cookie; wrong email or password gives one generic error", async () => {
  await setAdmin([["boss@example.com", "a-long-password-1"]]);
  const store = memStore();
  const ok = await signIn(store, " Boss@Example.com ", "a-long-password-1", { headers: { ...CSRF, "x-forwarded-proto": "https" } });
  assert.equal(ok.statusCode, 200); assert.equal(ok.body.email, "boss@example.com");
  assert.match(ok.headers["Set-Cookie"], /HttpOnly; SameSite=Strict/); assert.match(ok.headers["Set-Cookie"], /Secure/);
  const who = await call(adminSessionHandler, { headers: { cookie: cookieOf(ok) } }); assert.equal(who.statusCode, 200); assert.equal(who.body.email, "boss@example.com");
  assert.equal((await call(adminSessionHandler)).statusCode, 401); // no cookie
  const wrongPw = await signIn(store, "boss@example.com", "not-the-password"), wrongUser = await signIn(store, "nobody@example.com", "a-long-password-1");
  assert.equal(wrongPw.statusCode, 401); assert.equal(wrongUser.statusCode, 401); assert.deepEqual(wrongPw.body, wrongUser.body);
  assert.equal(wrongPw.headers["Set-Cookie"], undefined);
  assert.equal((await signIn(store, "", "")).statusCode, 400);
  assert.equal((await call(adminSessionHandler, { method: "POST", body: { email: "boss@example.com", password: "a-long-password-1" } }, { store })).statusCode, 403); // no CSRF header
  assert.equal((await call(adminSessionHandler, { method: "PUT" })).statusCode, 405);
  const out = await call(adminSessionHandler, { method: "DELETE", headers: CSRF }); assert.equal(out.statusCode, 200); assert.match(out.headers["Set-Cookie"], /Max-Age=0/);
  clearAdmin();
});

test("admin sign-in: locks out after 5 wrong tries from one address, even with the right password", async () => {
  await setAdmin([["boss@example.com", "a-long-password-1"]]);
  const store = memStore();
  for (let i = 0; i < 5; i++) assert.equal((await signIn(store, "boss@example.com", "guess-" + i)).statusCode, 401);
  const locked = await signIn(store, "boss@example.com", "a-long-password-1"); assert.equal(locked.statusCode, 429); assert.equal(locked.headers["Set-Cookie"], undefined);
  const other = await signIn(store, "boss@example.com", "a-long-password-1", { headers: { ...CSRF, "x-forwarded-for": "198.51.100.7" } });
  assert.equal(other.statusCode, 200); // a different address is not locked out by the first one
  clearAdmin();
});

test("admin waitlist: needs a session; lists, exports CSV, and deletes with CSRF protection", async () => {
  await setAdmin([["boss@example.com", "a-long-password-1"]]);
  const store = memStore(); await store.addSignup({ email: "a@x.com", notes: "=cmd|calc" }); await store.addSignup({ email: "b@x.com" });
  assert.equal((await call(adminWaitlistHandler, { url: "/api/admin/waitlist" }, { store })).statusCode, 401);
  assert.equal((await call(adminWaitlistHandler, { method: "DELETE", url: "/api/admin/waitlist?id=1", headers: CSRF }, { store })).statusCode, 401);
  const cookie = cookieOf(await signIn(store, "boss@example.com", "a-long-password-1")), h = { cookie };
  const list = await call(adminWaitlistHandler, { url: "/api/admin/waitlist", headers: h }, { store }); assert.equal(list.statusCode, 200); assert.equal(list.body.count, 2);
  const csv = await call(adminWaitlistHandler, { url: "/api/admin/waitlist?format=csv", headers: h }, { store }); assert.match(csv.headers["Content-Type"], /text\/csv/); assert.match(csv.body, /"'=cmd\|calc"/);
  const del = (id, headers = { ...h, ...CSRF }) => call(adminWaitlistHandler, { method: "DELETE", url: `/api/admin/waitlist?id=${id}`, headers }, { store });
  assert.equal((await del(1, h)).statusCode, 403); assert.equal(store.rows.length, 2); // cookie alone is not enough
  for (const bad of ["", "abc", "-1", "0", "1;DROP", "99999999999"]) assert.equal((await del(bad)).statusCode, 400);
  assert.equal((await del(1)).statusCode, 200); assert.deepEqual(store.rows.map((r) => r.email), ["b@x.com"]);
  assert.equal((await del(1)).statusCode, 404);
  assert.equal((await call(adminWaitlistHandler, { method: "POST", headers: h }, { store })).statusCode, 405);
  clearAdmin();
});

test("notify: sends plain text via the transport and never throws", async () => {
  const sent = []; const ok = { sendMail: async (m) => sent.push(m) };
  process.env.GMAIL_USER = "connect.kivora@gmail.com";
  assert.equal((await notifySignup({ email: "a@x.com", notes: "<b>hi</b>" }, ok)).sent, true);
  assert.equal(sent[0].to, "connect.kivora@gmail.com"); assert.match(sent[0].subject, /a@x\.com/); assert.ok(!("html" in sent[0]));
  assert.equal((await notifySignup({ email: "a@x.com" }, { sendMail: async () => { throw new Error("smtp down"); } })).sent, false);
  assert.equal((await notifySignup({ email: "a@x.com" }, null)).sent, false);
});
