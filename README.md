# Kivora site (Zuvoxiae)

The marketing site and waitlist API for **Kivora, an AI cost-governance platform** (pre-launch), built by Zuvoxiae.

- **Live site:** https://kivora-site-mu.vercel.app
- **Repository:** https://github.com/kunnalsinghm/kivora-site
- **Contact on the site:** connect.kivora@gmail.com
- **Stack:** plain HTML, CSS and JavaScript (no build step) · Node.js 22.13+ · Express (local server) · Vercel serverless functions · Neon Postgres · Gmail SMTP for sign-up alerts

The page is about **Kivora Guard** (see and control AI spend), with **Compass** (verified savings) and **Autopilot** (approved automation) shown as the next two products. Every status label on the page must match what is actually built:

| Product | Status label shown on the site |
| --- | --- |
| Guard | Built · tested in simulation |
| Compass | Working prototype · real-traffic trial next |
| Autopilot | Early prototype · demo on simulated data |

---

## Contents

1. [Repository layout](#repository-layout)
2. [The website](#the-website)
3. [Design system](#design-system)
4. [How to edit things](#how-to-edit-things)
5. [Security rules the site must obey](#security-rules-the-site-must-obey)
6. [Run it locally](#run-it-locally)
7. [Waitlist API](#waitlist-api)
8. [Admin (sign-ups, delete, CSV)](#admin-sign-ups-delete-csv)
9. [Environment variables](#environment-variables)
10. [Deploy on Vercel](#deploy-on-vercel)
11. [Ship a change safely](#ship-a-change-safely)
12. [Roll back](#roll-back)
13. [Troubleshooting](#troubleshooting)
14. [Testing](#testing)
15. [Content rules](#content-rules)
16. [Before you promote the site](#before-you-promote-the-site)

---

## Repository layout

```
kivora-site/
  server/index.js            Local Express server: static files, strict CSP, the same handlers Vercel runs
  api/                       Vercel serverless functions
                             (waitlist, admin/session, admin/waitlist, health, sitemap, robots)
  lib/handlers.js            Request handlers: waitlist, admin sign-in, list, delete, sitemap, robots
  lib/validate.js            Turns a request body into clean, allow-listed sign-up data
  lib/store.js               Storage: Postgres (Neon) when DATABASE_URL is set, otherwise a local SQLite file
  lib/notify.js              Emails the team for each new sign-up (Gmail SMTP)
  lib/auth.js                Admin accounts (scrypt hashes) and signed login cookies
  scripts/hash-password.js   Makes an admin account entry (npm run admin:hash)
  test/backend.test.js       Backend tests (npm test)
  data/                      Local SQLite file (git-ignored on purpose)
  backup/                    Previous homepage, kept so you can roll back
  vercel.json                Vercel settings: output folder, clean URLs, rewrites, security headers
  .env.example               Copy to .env for local use
  public/                    Everything the browser receives (this is Vercel's output directory)
    index.html               Home page (current design, "halcyon")
    kvr-halcyon-x7q9.css     Styles for the home page (also loaded by the legal pages)
    kvr-halcyon-x7q9.js      All home page behaviour
    kvr-halcyon-legal.css    Small extra styles for privacy, terms and 404
    privacy.html  terms.html  404.html
    admin.html  js/admin.js  Private sign-in and sign-up list (older styling, see Admin)
    favicon.svg  apple-touch-icon.png
    css/styles.css  js/main.js  img/   Left over from the previous design (see note below)
```

> **Old design files.** `public/css/styles.css`, `public/js/main.js` and `public/img/` belong to the previous homepage. `admin.html` may still use `styles.css`, and `backup/public-index-before-halcyon.html` needs all of them to work if you roll back. Check before deleting anything.

---

## The website

`public/index.html` is one page with a fixed header. Sections appear in this order:

| # | Section (anchor id) | What it shows |
| --- | --- | --- |
| – | Hero (`#top`) | "Control the economics of AI infrastructure", plus an interactive request-flow diagram (see below) |
| 01 | The problem (`#problem`) | One provider invoice that you can switch into a breakdown by team, model or application |
| 02 | Cost analytics (`#analytics`) | A spend-versus-budget chart with Week, Month and Quarter filters |
| 03 | How it works (`#how`) | A dark, scroll-driven story: a pinned chart gains one layer per step |
| 04 | Products (`#products`) | Guard, Compass and Autopilot as tabs, each with a working demo |
| 05 | Use cases (`#uses`) | Engineering and Finance scenarios, each tagged with the product that solves it |
| 06 | Pricing (`#pricing`) | Planned plans (not final) plus a Compass savings estimate |
| 07 | Transparency (`#security`) | What is built, what is not finalised, what is planned |
| 08 | Questions (`#faq`) | About Zuvoxiae and five FAQ answers |
| 09 | Early access (`#access`) | The sign-up form |

### Interactive pieces

| Piece | What it does | Where in `kvr-halcyon-x7q9.js` |
| --- | --- | --- |
| Request-flow diagram | Requests from three apps pass through the Kivora gate. A budget slider (0–110%) lights the 50/80/90/100% alerts. At 100% premium requests are downgraded or blocked, depending on the "When the limit is reached" switch. Cached requests never reach a provider. "Play the month" animates the slider. A phone gets a vertical version | `build`, `decide`, `frame` |
| Invoice explorer | Animated segmented bar for Invoice, By team, By model, By application. The three breakdowns all add up to the same $48,210 of usage against a $48,930 invoice | `EX`, `ex` |
| Spend chart | SVG chart with budget line, 50/80/90% lines, alert markers, forecast and a hover/touch readout. Week, Month and Quarter are generated from a seeded random series, so they are stable | `Chart`, `P`, `dat`, `kpi` |
| Scroll story | An observer switches chart layers 1–5 (connect, record, warn, limit, reconcile) as each step passes the middle of the screen. The chart is pinned with `position: sticky` | `Chart` with `layer`, `stps` |
| Guard demo | Type a request and watch personal data (emails, phone numbers, card numbers) get redacted. Known prompt-injection phrases are blocked. Patterns are simplified for illustration | `guard` |
| Compass demo | A cache simulator (send 20 requests, hits turn blue) and an evidence gate that needs 30 points of evidence before you can advance a staged rollout, with rollback | `csend`, `gate` |
| Autopilot demo | An action queue with Approve, Reject and Roll back buttons and an audit log | `Q`, `qr`, `log` |
| Estimate calculator | Three sliders compute spend on repeats, a possible saving, the planned 15–20% fee and what is left. It is arithmetic on the visitor's own assumptions, not a quote | `calc` |
| Early-access form | Posts to `/api/waitlist` (see below) and shows the API's own messages. If the service cannot be reached it opens an email instead | the form block at the end |

All numbers in the charts, bars and demos are **illustrative** and labelled as such. Keep it that way.

### Responsive behaviour and motion

- Breakpoints: 960px (menu replaces the nav links), 900px (side rail and two-column layouts stack), 760px (the hero diagram switches to its vertical version), 700px (charts redraw with larger text).
- Visitors who prefer reduced motion get no headline reveal, no moving dots, no count-up and no chart draw animation. Content is shown in its final state.
- Keyboard: tabs work with the arrow keys, the mobile menu closes with Escape, and there is a "Skip to content" link.

### Legal pages and 404

`privacy.html`, `terms.html` and `404.html` share the home page header, fonts and colours through `kvr-halcyon-legal.css`. Privacy and Terms are `noindex`. Vercel serves `404.html` for unknown addresses and the local server does the same. If you add a form field, analytics or a new service, update `privacy.html` in the same change.

---

## Design system

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#EDEFF2` | Page background |
| `--ink` | `#0D0F14` | Text, borders, the gate in the diagram |
| `--slate` | `#586071` | Secondary text |
| `--rule` | `#D2D6DD` | Thin dividers |
| `--ruby` | `#C4143C` | Primary action, budget line, alerts, blocked requests |
| `--blue` | `#2B6CB0` | Cached requests |
| `--ochre` | `#B7791F` | Downgraded requests |
| `--obs` | `#0B0D12` | Dark sections and the footer |

- **Fonts:** Instrument Serif for headlines and large numbers, Geist for everything else. Both load from Google Fonts, which is the only outside resource the site allows.
- **Shape:** sharp corners (2px at most), thin rules, a numbered left margin on each section, no card grids and no decorative gradients.
- **Colour meaning is consistent:** ink is normal, blue is cached, ochre is downgraded, ruby is a limit or a block. Keep it that way in any new chart.
- **Logo:** an inline SVG in the header and footer: a vertical bar and a ruby chevron. The same artwork is in `favicon.svg` and `apple-touch-icon.png`.

---

## How to edit things

There is no build step. Edit a file and refresh.

- **Words:** `public/index.html`. Keep every status label true and every demo labelled "Illustrative".
- **Colours and fonts:** the variables at the top of `kvr-halcyon-x7q9.css`.
- **Behaviour:** `kvr-halcyon-x7q9.js`. It is one function with a comment marking each block.
- **Form fields:** they must match `lib/validate.js`. If you add or rename a field, change the form, the JavaScript that builds the request body, `validate.js`, `store.js` (a database column), `notify.js` (the alert email) and `privacy.html`, together.
- **Cache busting:** the home page links its CSS and JS by file name. If a change does not appear for returning visitors, rename the files (and the two references in `index.html`) or add a `?v=2` to both links.

---

## Security rules the site must obey

`vercel.json` (and `server/index.js` locally) send a strict Content Security Policy:

```
default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com;
style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:;
connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

What that means when you edit:

- **No inline `<script>` and no inline `<style>` blocks.** They are blocked and the page loses its behaviour or styling. Put code in a `.js` file and styles in a `.css` file. Inline `style="…"` attributes are allowed.
- **No scripts, styles or API calls to other sites.** Only fonts from Google are allowed. A request to another domain fails silently.
- **Images** must be local files or `data:` URLs.
- Also set: HSTS, `nosniff`, a strict referrer policy and `frame-ancestors 'none'` (the site cannot be put in a frame).
- Server data shown in the admin page is inserted as text, never as HTML.

---

## Run it locally

Needs Node 22.13 or newer.

```powershell
npm install
copy .env.example .env
npm start
```

Open http://127.0.0.1:3000. Check the API with:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Leave `DATABASE_URL` empty and `npm start` stores sign-ups in `data/waitlist.db`. `npm run dev` restarts the server when files change.

> **PowerShell note.** Older Windows PowerShell does not understand `&&`. Put each command on its own line, or use `;`.

---

## Waitlist API

`POST /api/waitlist` with a JSON body:

| Field | Required | Rules |
| --- | --- | --- |
| `email` | Yes | A valid address, lower-cased, up to 254 characters |
| `company` | No | Up to 120 characters |
| `role` | No | One of: `Engineering / Platform`, `FinOps / Finance`, `Security / Compliance`, `Leadership`, `Other` |
| `spend_range` | No | One of: `Under $1k`, `$1k–$10k`, `$10k–$50k`, `$50k+`, `Not sure` (the dashes are en dashes) |
| `providers` | No | A list. Allowed: `OpenAI`, `Anthropic`, `Amazon Bedrock`, `Google`, `Self-hosted`, `Other`. Stored as a comma-separated string |
| `notes` | No | Up to 500 characters |
| `website` | No | A hidden bot trap. Leave it empty. If it has content the request gets a normal-looking success and nothing is stored |

Anything not on the allowed lists is dropped, not stored.

| Response | Meaning |
| --- | --- |
| `201 {ok, status:"added"}` | Saved, and an alert email is attempted |
| `200 {ok, status:"exists"}` | That email was already on the list |
| `400 {error}` | Invalid input, for example "Enter a valid work email address." |
| `405` | Not a POST |
| `429 {error}` | More than 8 sign-ups from one address in 15 minutes (a salted hash of the IP is used) |
| `500 {error}` | Storage failed. See Troubleshooting |

Try it:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/waitlist `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","role":"Leadership","providers":["OpenAI"]}'
```

The alert email is sent only for newly added sign-ups. A failed email never blocks or loses a sign-up.

---

## Admin (sign-ups, delete, CSV)

`/admin` is a sign-in page for the people you choose. It is **switched off until both `ADMIN_USERS` and `SESSION_SECRET` are set**; until then the page shows "Admin is switched off".

1. **`ADMIN_USERS`:** one or more `email:hash` entries, separated by commas. Make an entry with:

   ```powershell
   npm run admin:hash
   ```

   It asks for an email and a password (at least 12 characters, hidden as you type) and prints the entry. The password itself is never stored. Run it once per person.
2. **`SESSION_SECRET`:** at least 32 random characters:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Changing it signs everyone out.

Once signed in you can view sign-ups, download a CSV (`/api/admin/waitlist?format=csv`) and delete entries (this asks for confirmation and cannot be undone). Sessions last 8 hours. Sign-in is slowed after repeated wrong passwords (5 from one address, 20 for one account, in 15 minutes). Every delete is written to the host's logs with the admin's email and the entry number.

To remove someone's access, delete their entry from `ADMIN_USERS`. To change a password, make a new entry and replace the old one. The CSV protects against spreadsheet formula injection.

`admin.html` has not been restyled and still uses the older design. It works the same.

---

## Environment variables

Names only. Never commit values, and never paste them into chats or issues. Locally they live in `.env` (git-ignored). On Vercel they go under **Project → Settings → Environment Variables**.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Saving sign-ups on Vercel | Set for you when you connect Neon. If empty, a local SQLite file is used, which does **not** persist on Vercel |
| `DB_PATH` | Local SQLite location | Default `./data/waitlist.db` |
| `ADMIN_USERS` | The admin page | `email:hash` entries from `npm run admin:hash` |
| `SESSION_SECRET` | The admin page | 32+ random characters |
| `IP_SALT` | Rate limiting | Any long random string. Raw IPs are never stored |
| `GMAIL_USER` | Sign-up alert emails | The sending Gmail address |
| `GMAIL_APP_PASSWORD` | Sign-up alert emails | A Gmail **App Password** (needs 2-step verification), not the normal password. Without it sign-ups are saved but no email is sent |
| `NOTIFY_TO` | Sign-up alert emails | Where alerts go. Defaults to `GMAIL_USER` |
| `SITE_URL` | `sitemap.xml`, `robots.txt` | Public address. Normally detected from the request |
| `PORT`, `HOST`, `TRUST_PROXY` | Local server only | Set `TRUST_PROXY=1` behind a proxy so rate limits see the real client IP |

**Gmail app password:** turn on 2-Step Verification on the Google account, create an App Password at https://myaccount.google.com/apppasswords, and paste the 16 characters (no spaces) as `GMAIL_APP_PASSWORD`.

---

## Deploy on Vercel

`vercel.json` already sets what is needed: no framework, `public` as the output folder, clean URLs (`/privacy` instead of `/privacy.html`), rewrites for `/sitemap.xml` and `/robots.txt`, and the security headers.

1. Push the repository to GitHub (`.env`, `node_modules` and `data/` are git-ignored).
2. On vercel.com choose **Add New → Project**, import the repository and keep the defaults.
3. Open **Storage → Create Database → Neon (Postgres)** and connect it. Vercel adds `DATABASE_URL`.
4. Add the other variables from the table above, then redeploy.

**Two Vercel projects deploy from this repository** (`kivora-site` and `kivora-zuvoxiea`). Both rebuild on every push and both comment on pull requests. Check in the Vercel dashboard which address each one serves, and set environment variables on whichever project serves the public site.

Files in the repository root are **not** served. Only `public/` is. A file placed next to `package.json` will 404.

After a deploy, check:

1. The home page loads fully styled, and `/privacy`, `/terms` and a nonsense address (`/xyz`) show their pages.
2. The browser console shows no red errors (on preview links a blocked `vercel.live` script is normal, see Troubleshooting).
3. Send one sign-up with your own email. The form says "Thank you. You're on the list".
4. Open `/admin` (once configured) and confirm the entry arrived with its role, spend range and providers, then delete the test entry. Check your inbox for the alert.

---

## Ship a change safely

Never edit `main` directly.

```powershell
git checkout main
git pull
git checkout -b my-change
# ...edit files...
git add -A
git commit -m "Describe the change"
git push -u origin my-change
```

1. Open the pull request link Git prints.
2. Wait for the Vercel bot comment and open each **Preview** link. Test the **root address** of the preview.
3. **Merge only when the preview is right.** Merging deploys to production within a minute or two.

> If pull requests seem to merge by themselves, check the repository's Actions and Settings → General → "Allow auto-merge" before relying on this step.

---

## Roll back

**Fastest:** open the merged pull request on GitHub, click **Revert**, and merge the pull request it creates.

**Restore the previous homepage by hand** (its CSS and JavaScript are still in the repository):

```powershell
git checkout main
git pull
git checkout -b restore-old-homepage
Copy-Item backup\public-index-before-halcyon.html public\index.html -Force
git add -A
git commit -m "Restore previous homepage"
git push -u origin restore-old-homepage
```

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| A new page or file shows 404 | It must be inside `public/`. Use the clean URL (`/privacy`, not `/privacy.html`) |
| Page has no styling or no behaviour | An inline `<style>` or `<script>` block was added. Move it into a file (see Security rules). Check the console for "violates Content Security Policy" |
| Console error about `vercel.live/_next-live/feedback` on a **preview** link | Vercel's preview toolbar being blocked by the policy. Harmless, preview-only, and it does not appear on the live site |
| `/admin` says "Admin is switched off" | `ADMIN_USERS` and `SESSION_SECRET` are not set on that Vercel project. See Admin |
| No sign-up alert email | `GMAIL_USER` and `GMAIL_APP_PASSWORD` are not both set, or the app password is wrong. Sign-ups are still saved. Check the function logs for "signup email failed" |
| Form shows "Something went wrong on our side" | A `500` from storage, usually a missing or wrong `DATABASE_URL`. Open the project's **Logs** tab, filter `/api/waitlist`, and read the line starting "waitlist failed" |
| Form shows "Too many attempts" | The 8-per-15-minutes limit for one address. Wait, or test from another network |
| Form says "We couldn't reach the sign-up service" and opens an email | The browser could not reach `/api/waitlist` at all (offline, or the API is down) |
| Same email submitted twice | The API answers `200 exists`, and the form shows the normal thank-you message |
| Changes not visible after deploy | Hard refresh with Ctrl+F5, or see "Cache busting" above |
| `LF will be replaced by CRLF` warnings from Git on Windows | Harmless line-ending conversion |
| `sitemap.xml` lists `/privacy` and `/terms` although they are `noindex` | Known quirk in `lib/handlers.js`; harmless |

---

## Testing

- **Backend:** `npm test` runs `test/backend.test.js`.
- **Front end, by hand:** on a local run and on every Vercel preview, work through the checklist in [Deploy on Vercel](#deploy-on-vercel). Also test at phone width (browser developer tools → device toolbar), confirm the page does not scroll sideways, and open it once with "reduce motion" turned on.
- **What to look for in the hero diagram:** dots moving through the gate; dragging the slider to 100% turns the Premium box dashed; switching to Block makes red "Blocked" requests appear.

---

## Content rules

The site is pre-launch and must stay honest:

- No customer logos, testimonials, awards or invented statistics.
- No compliance claims. The transparency section says what is not finalised, and it should keep saying so until it is true.
- Anything planned is labelled planned (PagerDuty, Jira, QuickBooks, NetSuite are planned, not built).
- Kivora covers **AI request traffic**, not cloud or Kubernetes infrastructure cost.
- Demo data is always labelled **Illustrative**.

---

## Before you promote the site

- [ ] Have a qualified person review `privacy.html` and `terms.html`. Update them whenever data collection changes.
- [ ] Switch the public contact address to a domain email when you have one.
- [ ] Set `SITE_URL` to the final address, and add a canonical tag and a social-share image (`og:image`) to `index.html`.
- [ ] Confirm sign-up alerts work (see the deploy checklist) and that someone reads the inbox.
- [ ] Decide which Vercel project owns the public domain and remove the other if it is not needed.
- [ ] Back up the sign-ups. Neon holds them in production; `data/waitlist.db` is local only.
- [ ] Remove the old-design files once you are sure you will not roll back (`public/css/styles.css`, `public/js/main.js`, `public/img/`, `backup/`), after checking `admin.html` does not use them.
