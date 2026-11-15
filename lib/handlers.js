// handlers.js - request handlers shared by the local Express server and the Vercel functions in /api.
const crypto = require("node:crypto");
const { parseSignup } = require("./validate");
const { getStore } = require("./store");
const { notifySignup } = require("./notify");
const auth = require("./auth");

const clientIp = (req) => String((req.headers && req.headers["x-forwarded-for"]) || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim();
const ipHash = (req) => crypto.createHash("sha256").update((process.env.IP_SALT || "kivora-local-salt") + clientIp(req)).digest("hex").slice(0, 32);
const origin = (req) => (process.env.SITE_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`).replace(/\/$/, "");

async function waitlistHandler(req, res, deps = {}) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const parsed = parseSignup(req.body);
  if (parsed.honeypot) return res.status(200).json({ ok: true, status: "added" }); // bots learn nothing
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const store = deps.store || getStore(), notify = deps.notify || notifySignup, h = ipHash(req);
  try {
    if ((await store.recentByIp(h, 15)) >= 8) return res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
    const status = await store.addSignup(parsed.data, h);
    if (status === "added") await notify(parsed.data);
    return res.status(status === "added" ? 201 : 200).json({ ok: true, status });
  } catch (err) {
    console.error("waitlist failed:", err);
    return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  }
}

const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (rows) => ["id,email,company,role,spend_range,providers,notes,created_at", ...rows.map((r) => [r.id, r.email, r.company, r.role, r.spend_range, r.providers, r.notes, r.created_at].map(csvCell).join(","))].join("\n");

// ---- Admin: sign-in, session, list, delete -------------------------------------------------------
const SIGNIN_WINDOW_MIN = 15, MAX_FAILS_PER_IP = 5, MAX_FAILS_PER_ACCOUNT = 20;
const salted = (s) => crypto.createHash("sha256").update((process.env.IP_SALT || "kivora-local-salt") + s).digest("hex").slice(0, 32);
const isHttps = (req) => String((req.headers && req.headers["x-forwarded-proto"]) || (req.socket && req.socket.encrypted ? "https" : "http")).split(",")[0].trim() === "https";
// Browsers can't add this header to a cross-site request without our permission, so it blocks CSRF (the cookie is also SameSite=Strict).
const csrfOk = (req) => (req.headers && req.headers["x-requested-with"]) === "kivora-admin";
const jsonBody = (req) => {
  const b = req.body;
  if (b && typeof b === "object") return b;
  try { const j = JSON.parse(b); return j && typeof j === "object" ? j : {}; } catch { return {}; }
};

// GET = who am I, POST = sign in, DELETE = sign out.
async function adminSessionHandler(req, res, deps = {}) {
  res.setHeader("Cache-Control", "no-store");
  if (!auth.enabled()) return res.status(404).json({ error: "Not found" }); // admin is off until accounts are configured
  if (req.method === "GET") {
    const email = auth.readSession(req.headers && req.headers.cookie);
    return email ? res.status(200).json({ ok: true, email }) : res.status(401).json({ error: "Not signed in" });
  }
  if (!["POST", "DELETE"].includes(req.method)) { res.setHeader("Allow", "GET, POST, DELETE"); return res.status(405).json({ error: "Method not allowed" }); }
  if (!csrfOk(req)) return res.status(403).json({ error: "Forbidden" });
  if (req.method === "DELETE") { res.setHeader("Set-Cookie", auth.clearCookie(isHttps(req))); return res.status(200).json({ ok: true }); }

  const b = jsonBody(req), email = String(b.email ?? "").trim().toLowerCase().slice(0, 254), password = String(b.password ?? "");
  if (!email || !password || password.length > 200) return res.status(400).json({ error: "Enter your email and password." });
  const ipKey = `ip:${salted(clientIp(req))}`, accountKey = `acct:${salted(email)}`;
  try {
    const store = deps.store || getStore();
    if ((await store.countAttempts(ipKey, SIGNIN_WINDOW_MIN)) >= MAX_FAILS_PER_IP || (await store.countAttempts(accountKey, SIGNIN_WINDOW_MIN)) >= MAX_FAILS_PER_ACCOUNT) {
      return res.status(429).json({ error: `Too many sign-in attempts. Try again in ${SIGNIN_WINDOW_MIN} minutes.` });
    }
    const stored = auth.parseUsers().get(email);
    const valid = await auth.verifyPassword(password, stored || (await auth.dummyHash())); // same work either way
    if (!stored || !valid) {
      await store.recordAttempt(ipKey); await store.recordAttempt(accountKey);
      return res.status(401).json({ error: "Wrong email or password." }); // never says which one was wrong
    }
    res.setHeader("Set-Cookie", auth.sessionCookie(email, isHttps(req)));
    return res.status(200).json({ ok: true, email });
  } catch (err) {
    console.error("admin sign-in failed:", err);
    return res.status(500).json({ error: "Could not sign in right now. Please try again." });
  }
}

// GET = list (or CSV with ?format=csv), DELETE ?id=N = remove one sign-up. Needs a signed-in admin.
async function adminWaitlistHandler(req, res, deps = {}) {
  res.setHeader("Cache-Control", "no-store");
  if (!auth.enabled()) return res.status(404).json({ error: "Not found" });
  const admin = auth.readSession(req.headers && req.headers.cookie);
  if (!admin) return res.status(401).json({ error: "Unauthorized" });
  if (!["GET", "DELETE"].includes(req.method)) { res.setHeader("Allow", "GET, DELETE"); return res.status(405).json({ error: "Method not allowed" }); }
  const query = new URL(req.url || "/", "http://localhost").searchParams;
  try {
    const store = deps.store || getStore();
    if (req.method === "DELETE") {
      if (!csrfOk(req)) return res.status(403).json({ error: "Forbidden" });
      const raw = query.get("id") || "", id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
      if (!id) return res.status(400).json({ error: "Invalid id." });
      if (!(await store.remove(id))) return res.status(404).json({ error: "Not found" });
      console.log(`admin delete: ${admin} removed waitlist entry #${id}`); // audit trail in the host's logs
      return res.status(200).json({ ok: true });
    }
    const rows = await store.list();
    if (query.get("format") === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="kivora-waitlist.csv"');
      return res.status(200).send(toCsv(rows));
    }
    return res.status(200).json({ count: rows.length, rows });
  } catch (err) {
    console.error("admin waitlist failed:", err);
    return res.status(500).json({ error: "Could not complete that request." });
  }
}

const sitemapHandler = (req, res) => {
  const o = origin(req), urls = ["/", "/privacy", "/terms"].map((p) => `  <url><loc>${o}${p}</loc></url>`).join("\n");
  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
};
const robotsHandler = (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin(req)}/sitemap.xml\n`);
};

module.exports = { waitlistHandler, adminSessionHandler, adminWaitlistHandler, sitemapHandler, robotsHandler, toCsv };
