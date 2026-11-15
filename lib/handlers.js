// handlers.js - request handlers shared by the local Express server and the Vercel functions in /api.
const crypto = require("node:crypto");
const { parseSignup } = require("./validate");
const { getStore } = require("./store");
const { notifySignup } = require("./notify");

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

function adminStatus(req) {
  const token = process.env.ADMIN_TOKEN || "";
  if (!token) return 404; // export is disabled until a token is set
  const given = Buffer.from(String(req.headers["x-admin-token"] || "")), want = Buffer.from(token);
  return given.length === want.length && crypto.timingSafeEqual(given, want) ? 200 : 401;
}

async function adminListHandler(req, res, deps = {}) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const code = adminStatus(req);
  if (code !== 200) return res.status(code).json({ error: code === 404 ? "Not found" : "Unauthorized" });
  try {
    const rows = await (deps.store || getStore()).list();
    res.setHeader("Cache-Control", "no-store");
    if (new URL(req.url || "/", "http://localhost").searchParams.get("format") === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="kivora-waitlist.csv"');
      return res.status(200).send(toCsv(rows));
    }
    return res.status(200).json({ count: rows.length, rows });
  } catch (err) {
    console.error("admin list failed:", err);
    return res.status(500).json({ error: "Could not read the waitlist." });
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

module.exports = { waitlistHandler, adminListHandler, sitemapHandler, robotsHandler, toCsv };
