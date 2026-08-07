# Enhanced Mutual Insurance — backend

A small real backend for the website: user accounts, hashed passwords,
login sessions (JWT), and storage for quote requests and contact
messages. It also serves the website itself, so the whole thing runs
from one process with no separate frontend host needed.

## What's real here

- **Accounts** — `/api/register` and `/api/login` create and authenticate
  real users. Passwords are hashed with bcrypt, never stored in plain text.
- **Sessions** — login returns a JWT; the browser stores it and sends it
  back on `Self Care` actions. Sessions last 7 days.
- **Self Care dashboard** — pulls the logged-in user's real policy data
  from the database and shows it. Quick actions (statement, beneficiary,
  pay premium, claim) are logged server-side per user.
- **Quote and contact forms** — submissions are saved to the database.

## What's still a placeholder

- New accounts get an auto-generated demo policy (Legacy Security Plan,
  US$18,000 cover). There's no real underwriting or policy issuance
  behind it yet.
- Storage is a single JSON file (`data/db.json`), not a production
  database. Fine for a demo or soft launch; swap it for Postgres/MySQL
  before handling real customer data at scale (see "Swapping in a real
  database" below).
- No email sending yet — "forgot password" and quote/contact confirmations
  are UI-only. Wire in an email provider (e.g. Postmark, SES, SendGrid)
  when you're ready to send real emails.
- No HTTPS, rate limiting, or production hardening — needed before this
  touches real customer data on the public internet.

## Run it

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000** — that's the actual website, now
talking to the real backend. Register an account, log out, log back in,
submit the quote form — it's all real and persisted in `data/db.json`.

## Project layout

```
backend/
  server.js       — the whole API + static file server
  package.json
  data/db.json    — auto-created on first run; your "database"
  public/         — the website (index.html) that gets served
```

## Environment variables (optional)

- `PORT` — defaults to 4000
- `JWT_SECRET` — defaults to a dev value; **set a real random secret
  before deploying anywhere public**, e.g.:
  ```bash
  export JWT_SECRET="$(openssl rand -hex 32)"
  ```

## Deploying

Any Node hosting works (Render, Railway, Fly.io, a VPS, etc.):

1. Push this `backend/` folder to your host.
2. Set `JWT_SECRET` as an environment variable.
3. Run `npm install && npm start`.
4. Point your domain at it.

If you deploy the frontend separately from the backend (different
domains), update `API_BASE` near the top of the form-handling script in
`public/index.html` to your backend's full URL, and make sure CORS is
configured for your frontend's origin (the server currently allows all
origins via `cors()` — tighten this to your real domain before going
live).

## Swapping in a real database

Everything reads and writes through two functions in `server.js`:
`readDB()` and `writeDB()`. Replace those with calls to your database of
choice (Postgres, MySQL, MongoDB, etc.) and the rest of the routes don't
need to change.
