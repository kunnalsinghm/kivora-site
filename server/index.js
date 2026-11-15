// index.js - local dev server: static site + the same handlers Vercel runs in /api.
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const { waitlistHandler, adminSessionHandler, adminWaitlistHandler, sitemapHandler, robotsHandler } = require("../lib/handlers");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");

// Strict CSP (mirrored in vercel.json): own scripts only, Google Fonts for type, inline style="" attributes allowed.
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"],
  styleSrc: ["'self'", "https://fonts.googleapis.com"], styleSrcAttr: ["'unsafe-inline'"],
  fontSrc: ["https://fonts.gstatic.com"], imgSrc: ["'self'", "data:"], connectSrc: ["'self'"],
  formAction: ["'self'"], objectSrc: ["'none'"] } } }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/waitlist", (req, res) => waitlistHandler(req, res));
app.all("/api/admin/session", (req, res) => adminSessionHandler(req, res));
app.all("/api/admin/waitlist", (req, res) => adminWaitlistHandler(req, res));
app.get("/robots.txt", robotsHandler);
app.get("/sitemap.xml", sitemapHandler);

app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"], maxAge: 0 })); // no caching, so edits show on refresh (Vercel serves the live site)
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, "..", "public", "404.html")));

app.listen(PORT, HOST, () => console.log(`Kivora site running at http://${HOST}:${PORT}`));
