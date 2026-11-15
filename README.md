# Kivora site (Zuvoxiae)

Marketing site plus a small waitlist API for **Kivora, the AI cost-governance platform** (pre-launch).

```
zuvoxia-site/
  server/index.js     Express server: static files, strict CSP, rate-limited waitlist API, CSV export
  server/db.js        SQLite storage (node:sqlite, built in, no native build)
  public/index.html   The page
  public/css/styles.css
  public/js/main.js   Mobile menu + waitlist form
  .env.example        Copy to .env
```

## Run it

Needs Node 22.13 or newer (the same Node your other projects use).

```powershell
npm install
copy .env.example .env
npm start
```

Open http://127.0.0.1:3000. Check the API with `curl http://127.0.0.1:3000/api/health`.

## Waitlist

`POST /api/waitlist` with `{ "email": "...", "company": "..." }`. Emails are validated, de-duplicated, stored in `data/waitlist.db`, and rate-limited (8 attempts per 15 minutes per IP). A hidden `website` field catches simple bots.

To download sign-ups, set `ADMIN_TOKEN` in `.env` (a long random string), restart, then:

```powershell
curl -H "x-admin-token: YOUR_TOKEN" http://127.0.0.1:3000/api/admin/waitlist.csv -o waitlist.csv
```

If `ADMIN_TOKEN` is empty the export is disabled.

## Before you go live

- The public contact address is `connect.kivora@gmail.com` (footer and legal pages). Switch to a domain email once you have one.
- Add a Privacy Policy and Terms page and link them in the footer. The form says the email is used only to contact people about Kivora access, so keep it true.
- Behind a proxy (Render, Railway, Fly, Nginx) set `TRUST_PROXY=1` so rate limits use the real client IP, and `HOST=0.0.0.0` if the platform needs it.
- The dashboard previews on the page are illustrative. No customer data, logos or statistics are shown.
- Back up `data/waitlist.db`. It is git-ignored on purpose.

## Deploy on Vercel (free tier)

1. Push this folder to a GitHub repository (`.env`, `node_modules` and `data/` are git-ignored on purpose).
2. On vercel.com choose **Add New > Project**, import the repository, and keep the defaults (`vercel.json` sets everything).
3. In the project, open **Storage > Create Database > Neon (Postgres)** and connect it. Vercel adds `DATABASE_URL` for you.
4. In **Settings > Environment Variables** add: `ADMIN_TOKEN` (a long random string), `IP_SALT` (any random string), `GMAIL_USER` (`connect.kivora@gmail.com`) and `GMAIL_APP_PASSWORD`.
5. Redeploy. Sign-ups are saved in the database, emailed to you, and visible at `/admin` (enter your `ADMIN_TOKEN`).

**Gmail app password:** turn on 2-Step Verification for the Google account, then create an App Password at https://myaccount.google.com/apppasswords and paste the 16 characters (no spaces) as `GMAIL_APP_PASSWORD`. Without it, sign-ups are still saved, you just don't get the email.

**Locally**, leave `DATABASE_URL` empty and `npm start` uses a SQLite file in `data/`. `npm test` runs the backend tests.
