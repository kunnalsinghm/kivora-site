# Kivora site (Zuvoxiae)

Marketing site plus a small waitlist API for **Kivora, the AI cost-governance platform** (pre-launch), by Zuvoxiae.

The page is about **Kivora Guard** (see and control AI spend), with **Compass** (savings) and **Autopilot** (approved automation) shown as the next two products. Status labels on the page are meant to match what is built: Guard is built and tested in simulation, Compass is a working prototype, Autopilot is an early prototype on simulated data. Keep them honest when you edit.

```
zuvoxia-site/
  server/index.js     Local Express server: static files, strict CSP, the same handlers Vercel runs
  api/                Vercel serverless functions (waitlist, admin/session, admin/waitlist, health, sitemap, robots)
  lib/handlers.js     Request handlers (waitlist, admin sign-in, list, delete)
  lib/auth.js         Admin accounts (scrypt) and signed login cookies
  lib/store.js        Postgres (Neon) on Vercel, SQLite file locally
  scripts/hash-password.js   Makes an admin account entry (npm run admin:hash)
  public/             The site: index.html, admin.html, privacy.html, terms.html, 404.html, css/, js/, img/
  test/               Backend tests (npm test)
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

`POST /api/waitlist` with `{ "email": "...", "company": "...", "notes": "..." }`. Only `email` is required. Emails are validated, de-duplicated, stored (Postgres on Vercel, `data/waitlist.db` locally), and rate-limited (8 attempts per 15 minutes per IP, using a salted hash of the IP). A hidden `website` field catches simple bots.

## Admin (sign-ups, delete, CSV)

`/admin` is a sign-in page for the people you choose. It is switched off until both of these are set:

1. `ADMIN_USERS`: one or more `email:hash` entries, separated by commas. Make an entry with:

   ```powershell
   npm run admin:hash
   ```

   It asks for an email and a password (at least 12 characters, hidden as you type) and prints the entry. The password itself is never stored. Run it once per person.
2. `SESSION_SECRET`: at least 32 random characters, from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Changing it signs everyone out.

Once signed in you can view sign-ups, download a CSV, and delete entries (deleting asks for confirmation and cannot be undone). Sessions last 8 hours. After 5 wrong passwords from one address, sign-in is blocked for 15 minutes. Every delete is written to the host's logs with the admin's email and the entry number.

To remove someone's access, delete their entry from `ADMIN_USERS`. To change a password, make a new entry with `npm run admin:hash` and replace the old one.

## Before you go live

- The public contact address is `connect.kivora@gmail.com` (footer and legal pages). Switch to a domain email once you have one.
- Privacy and Terms pages exist (`public/privacy.html`, `public/terms.html`) and describe what the site collects today. Have a lawyer review them before you promote the site, and update them if you add analytics, new form fields or new services.
- Behind a proxy (Render, Railway, Fly, Nginx) set `TRUST_PROXY=1` so rate limits use the real client IP, and `HOST=0.0.0.0` if the platform needs it.
- The dashboard previews on the page are illustrative and labelled as such. No customer data, logos or statistics are shown.
- Set `SITE_URL` to the final address so `sitemap.xml` and `robots.txt` use it, and add a canonical tag once the domain is fixed.
- Back up `data/waitlist.db`. It is git-ignored on purpose.

## Deploy on Vercel (free tier)

1. Push this folder to a GitHub repository (`.env`, `node_modules` and `data/` are git-ignored on purpose).
2. On vercel.com choose **Add New > Project**, import the repository, and keep the defaults (`vercel.json` sets everything).
3. In the project, open **Storage > Create Database > Neon (Postgres)** and connect it. Vercel adds `DATABASE_URL` for you.
4. In **Settings > Environment Variables** add: `ADMIN_USERS` and `SESSION_SECRET` (see Admin above), `IP_SALT` (a long random string), `GMAIL_USER` (`connect.kivora@gmail.com`) and `GMAIL_APP_PASSWORD`.
5. Redeploy. Sign-ups are saved in the database, emailed to you, and visible at `/admin` (sign in with the account you made).

**Gmail app password:** turn on 2-Step Verification for the Google account, then create an App Password at https://myaccount.google.com/apppasswords and paste the 16 characters (no spaces) as `GMAIL_APP_PASSWORD`. Without it, sign-ups are still saved, you just don't get the email.

**Unknown addresses** show `public/404.html` (Vercel serves it automatically; the local server does the same).

**Locally**, leave `DATABASE_URL` empty and `npm start` uses a SQLite file in `data/`. `npm test` runs the backend tests.
