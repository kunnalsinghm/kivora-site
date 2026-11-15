// store.js - waitlist storage. Uses hosted Postgres when DATABASE_URL is set (Vercel + Neon),
// otherwise a local SQLite file (node:sqlite) so `npm start` works with no setup.
const fs = require("node:fs");
const path = require("node:path");

const PG_SCHEMA = `CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, company TEXT, role TEXT, spend_range TEXT,
  providers TEXT, notes TEXT, ip_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

// pool: any object with pg's query(text, params) -> { rows, rowCount }
function createPgStore(pool) {
  let ready;
  const init = () => ready || (ready = pool.query(PG_SCHEMA).catch((e) => { ready = null; throw e; }));
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
  const insert = db.prepare("INSERT INTO waitlist (email, company, role, spend_range, providers, notes, ip_hash) VALUES (?,?,?,?,?,?,?)");
  const recent = db.prepare("SELECT count(*) AS n FROM waitlist WHERE ip_hash = ? AND created_at > ?");
  const all = db.prepare("SELECT id, email, company, role, spend_range, providers, notes, created_at FROM waitlist ORDER BY id");
  return {
    async addSignup(d, ipHash) {
      try { insert.run(d.email, d.company || null, d.role || null, d.spend_range || null, d.providers || null, d.notes || null, ipHash); return "added"; }
      catch (err) { if (/UNIQUE/i.test(String(err.message))) return "exists"; throw err; }
    },
    async recentByIp(ipHash, minutes) { return Number(recent.get(ipHash, new Date(Date.now() - minutes * 60000).toISOString()).n); },
    async list() { return all.all(); },
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
