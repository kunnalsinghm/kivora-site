// validate.js - turns a raw request body into clean, allow-listed signup data.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(["Engineering / Platform", "FinOps / Finance", "Security / Compliance", "Leadership", "Other"]);
const SPENDS = new Set(["Under $1k", "$1k–$10k", "$10k–$50k", "$50k+", "Not sure"]);
const PROVIDERS = new Set(["OpenAI", "Anthropic", "Amazon Bedrock", "Google", "Self-hosted", "Other"]);

const clean = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const pick = (v, allowed) => (allowed.has(String(v)) ? String(v) : "");

// Returns { honeypot: true } for bots, { error } for bad input, or { data } for a valid signup.
function parseSignup(body) {
  const b = body && typeof body === "object" ? body : {};
  if (clean(b.website, 200)) return { honeypot: true }; // hidden field real people never fill
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid work email address." };
  const providers = (Array.isArray(b.providers) ? b.providers : []).map(String).filter((p) => PROVIDERS.has(p));
  return {
    data: {
      email,
      company: clean(b.company, 120),
      role: pick(b.role, ROLES),
      spend_range: pick(b.spend_range, SPENDS),
      providers: [...new Set(providers)].join(", "),
      notes: clean(b.notes, 500),
    },
  };
}

module.exports = { parseSignup, clean };
