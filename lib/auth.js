// auth.js - admin accounts and sessions, using only Node's built-in crypto.
//
// Accounts:  ADMIN_USERS="email:hash,email2:hash2"  (make a hash with `npm run admin:hash`).
// Sessions:  a signed, expiring cookie (HMAC-SHA256 with SESSION_SECRET). Nothing is stored on the server,
//            so removing someone from ADMIN_USERS, or changing SESSION_SECRET, signs them out.
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);

const COOKIE = "kivora_admin";
const COOKIE_PATH = "/api/admin";
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

// Stored format: scrypt$N$r$p$saltHex$hashHex
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("hex"), key.toString("hex")].join("$");
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const sane = [N, r, p].every(Number.isInteger) && N >= 2 ** 12 && N <= 2 ** 16 && (N & (N - 1)) === 0 && r >= 1 && r <= 8 && p >= 1 && p <= 4;
  if (!sane) return false;
  const salt = Buffer.from(parts[4], "hex"), want = Buffer.from(parts[5], "hex");
  if (!salt.length || !want.length) return false;
  const got = await scrypt(String(password), salt, want.length, { N, r, p, maxmem: 256 * N * r });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Used when the email is unknown, so a wrong email takes as long to reject as a wrong password.
let dummy;
const dummyHash = () => dummy || (dummy = hashPassword("not-a-real-password"));

function parseUsers(raw = process.env.ADMIN_USERS) {
  const users = new Map();
  for (const entry of String(raw || "").split(",")) {
    const i = entry.lastIndexOf(":"); // hashes never contain ":"
    if (i < 3) continue;
    const email = entry.slice(0, i).trim().toLowerCase(), hash = entry.slice(i + 1).trim();
    if (email.includes("@") && hash.startsWith("scrypt$")) users.set(email, hash);
  }
  return users;
}

const secret = () => { const s = process.env.SESSION_SECRET || ""; return s.length >= 32 ? s : ""; };
// The admin area is switched off until at least one account and a strong session secret are set.
const enabled = () => parseUsers().size > 0 && secret() !== "";

const sign = (body) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

function createSession(email, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ e: email, exp: now + SESSION_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

const parseCookies = (header) => Object.fromEntries(String(header || "").split(";").map((c) => {
  const i = c.indexOf("=");
  return i < 0 ? ["", ""] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
}));

// Returns the signed-in admin's email, or null.
function readSession(cookieHeader, now = Date.now()) {
  if (!enabled()) return null;
  const raw = parseCookies(cookieHeader)[COOKIE];
  if (!raw) return null;
  const [body, sig, extra] = raw.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (!data || typeof data.e !== "string" || !(data.exp > now)) return null;
  return parseUsers().has(data.e) ? data.e : null;
}

const cookie = (value, secure, maxAgeSeconds) =>
  `${COOKIE}=${value}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
const sessionCookie = (email, secure) => cookie(createSession(email), secure, SESSION_MS / 1000);
const clearCookie = (secure) => cookie("", secure, 0);

module.exports = { COOKIE, hashPassword, verifyPassword, dummyHash, parseUsers, enabled, createSession, readSession, sessionCookie, clearCookie };
