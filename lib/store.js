// store.js - waitlist storage. Uses hosted Postgres when DATABASE_URL is set (Vercel + Neon),
// otherwise a local SQLite file (node:sqlite) so `npm start` works with no setup.
const fs = require("node:fs");
const path = require("node:path");

const PG_SCHEMA = `CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, company TEXT, role TEXT, spend_range TEXT,
  providers TEXT, notes TEXT, ip_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

// Failed admin sign-ins, kept briefly so repeated guesses can be slowed down (works across serverless instances).
const PG_ATTEMPTS = `CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY, bucket TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

// pool: any object with pg's query(text, params) -> { rows, rowCount }
function createPgStore(pool) {
  let ready;
  const init = () => ready || (ready = pool.query(PG_SCHEMA).then(() => pool.query(PG_ATTEMPTS)).catch((e) => { ready = null; throw e; }));
  return {
    async addSignup(d, ipHash) {
      await init();
      try {
        await pool.query(
          "INSERT INTO waitlist (email, company, role, spend_range, providers, notes, ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [d.email, d.company || null, d.role || null, d.spend_range || null, d.providers || null, d.notes || null, ipHash]
        );
        return "added";
      } catch (err) {
        // 23505 = unique_violation: this email is already on the list (also correct if two requests race).
        if (err && (err.code === "23505" || /duplicate key|unique/i.test(String(err.message)))) return "exists";
        throw err;
      }
    },
    async recentByIp(ipHash, minutes) {
      await init();
      const r = await pool.query("SELECT count(*) AS n FROM waitlist WHERE ip_hash = $1 AND created_at > $2", [ipHash, new Date(Date.now() - minutes * 60000)]);
      return Number(r.rows[0].n);
    },
    async list() {
      await init();
      const r = await pool.query("SELECT id, email, company, role, spend_range, providers, notes, created_at FROM waitlist ORDER BY id");
      return r.rows.map((x) => ({ ...x, created_at: new Date(x.created_at).toISOString() }));
    },
    async remove(id) {
      await init();
      const r = await pool.query("DELETE FROM waitlist WHERE id = $1", [id]);
      return r.rowCount > 0;
    },
    async recordAttempt(bucket) {
      await init();
      await pool.query("INSERT INTO login_attempts (bucket) VALUES ($1)", [bucket]);
      await pool.query("DELETE FROM login_attempts WHERE created_at < $1", [new Date(Date.now() - 24 * 3600000)]); // tidy up
    },
    async countAttempts(bucket, minutes) {
      await init();
      const r = await pool.query("SELECT count(*) AS n FROM login_attempts WHERE bucket = $1 AND created_at > $2", [bucket, new Date(Date.now() - minutes * 60000)]);
      return Number(r.rows[0].n);
    },
  };
}

function createSqliteStore() {
  const { DatabaseSync } = require("node:sqlite"); // loaded lazily: not needed on Vercel
  const file = path.resolve(process.env.DB_PATH || "./data/waitlist.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, company TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const have = db.prepare("PRAGMA table_info(waitlist)").all().map((c) => c.name);
  for (const col of ["role", "spend_range", "providers", "notes", "ip_hash"]) {
    if (!have.includes(col)) db.exec(`ALTER TABLE waitlist ADD COLUMN ${col} TEXT`); // constant names, not user input
  }
  db.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const insert = db.prepare("INSERT INTO waitlist (email, company, role, spend_range, providers, notes, ip_hash) VALUES (?,?,?,?,?,?,?)");
  const del = db.prepare("DELETE FROM waitlist WHERE id = ?");
  const addAttempt = db.prepare("INSERT INTO login_attempts (bucket) VALUES (?)");
  const tidyAttempts = db.prepare("DELETE FROM login_attempts WHERE created_at < ?");
  const countRecent = db.prepare("SELECT count(*) AS n FROM login_attempts WHERE bucket = ? AND created_at > ?");
  const recent = db.prepare("SELECT count(*) AS n FROM waitlist WHERE ip_hash = ? AND created_at > ?");
  const all = db.prepare("SELECT id, email, company, role, spend_range, providers, notes, created_at FROM waitlist ORDER BY id");
  return {
    async addSignup(d, ipHash) {
      try { insert.run(d.email, d.company || null, d.role || null, d.spend_range || null, d.providers || null, d.notes || null, ipHash); return "added"; }
      catch (err) { if (/UNIQUE/i.test(String(err.message))) return "exists"; throw err; }
    },
    async recentByIp(ipHash, minutes) { return Number(recent.get(ipHash, new Date(Date.now() - minutes * 60000).toISOString()).n); },
    async list() { return all.all(); },
    async remove(id) { return Number(del.run(id).changes) > 0; },
    async recordAttempt(bucket) { addAttempt.run(bucket); tidyAttempts.run(new Date(Date.now() - 24 * 3600000).toISOString()); },
    async countAttempts(bucket, minutes) { return Number(countRecent.get(bucket, new Date(Date.now() - minutes * 60000).toISOString()).n); },
  };
}

let cached;
function getStore() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { Pool } = require("pg");
    cached = createPgStore(new Pool({ connectionString: url, max: 1 })); // max 1: each serverless instance holds one connection
  } else {
    cached = createSqliteStore();
  }
  return cached;
}

module.exports = { getStore, createPgStore };
