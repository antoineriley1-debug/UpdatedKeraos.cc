# Priority Tasks — MedStar Facilities Console (v1.5)

Production-ready Next.js dashboard for the **Priority Tasks** Smartsheet. Real reads, real writes, multi-user login.

## What it does

- **Live view** of every row in the Smartsheet, refreshed every 60s.
- **Add Task** creates new rows. Owner / Category / Status fields autocomplete from values already in the sheet.
- **Edit Task** — open any task, click Edit, change any field, click Save. Writes back to Smartsheet.
- **Mark Complete** stamps `Status="Completed"`, fills `End Date` with today if blank, appends `[Closed YYYY-MM-DD by Your Name]` to Notes.
- **Reopen** appends `[Reopened YYYY-MM-DD by Your Name]` to Notes and sets Status back to `In Progress`.
- **Multi-user login**. Each person signs in with their own email + password. Closures stamp **their actual name**.
- **Works with the existing 8 columns** — no schema changes required.

## Deploy

### 1. Push the code to GitHub

```bash
cd medstar-console
git init
git add .
git commit -m "Initial commit"
# Create a private repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/medstar-priority-console.git
git branch -M main
git push -u origin main
```

### 2. Generate auth secrets locally

You need a `SESSION_SECRET` and at least one user entry. Run this once:

```bash
# Session secret (any 32+ char random string works)
openssl rand -hex 32
# Copy the output — that's your SESSION_SECRET

# Then for each user:
npm install
npm run add-user
# Prompts for email, name, password, role. Outputs a JSON entry.
```

The `add-user` script outputs something like:
```json
{
  "email": "antoine.riley@crothall.com",
  "name": "Antoine Riley",
  "role": "admin",
  "passwordHash": "ab12cd34...:ef56gh78..."
}
```

For your first deploy, copy the **JSON array** version (with the square brackets) — that's your `USERS` env var value.

To add more users later, run `npm run add-user` again, then add the new entry to the existing array in Vercel.

### 3. Generate a Smartsheet API token

Smartsheet → avatar → Personal Settings → Apps & Integrations → API Access → Generate new access token.
Copy it. Smartsheet only shows it once.

### 4. Deploy to Vercel

1. Sign in at vercel.com.
2. Add New → Project → import the repo.
3. Before deploying, add these environment variables (Production + Preview + Development):

| Variable | Value |
|---|---|
| `SMARTSHEET_TOKEN` | Token from step 3 |
| `SMARTSHEET_SHEET_ID` | `8870685098069892` |
| `SESSION_SECRET` | Output of `openssl rand -hex 32` |
| `USERS` | JSON array of users from `npm run add-user` |
| `NEXT_PUBLIC_DISPLAY_NAME` | `Priority Tasks` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `60000` |

4. Click Deploy.

### 5. Sign in

Visit your Vercel URL. Sign in with the email + password you set during `add-user`. Stays logged in for 30 days per device.

## Roles (v1.5)

Four roles defined: `admin`, `manager`, `user`, `readonly`. Right now in v1.5, the only role that's actually restricted is `readonly` — they see the dashboard but can't create, edit, close, or reopen. The other three roles are equivalent. Per-role granularity is a v2 add-on.

## Local dev

```bash
cp .env.example .env.local
# Edit .env.local with real values
npm install
npm run dev
```

Open http://localhost:3000.

## Adding more users after launch

```bash
npm run add-user
```

Copy the JSON entry, paste it into Vercel's `USERS` env var alongside the existing ones (it's a JSON array — add a comma and the new object). Redeploy or wait for Vercel to pick it up.

To **revoke** access: remove that user's entry from the `USERS` env var and redeploy. Their session cookie becomes invalid on the next request.

To **rotate** a password: re-run `npm run add-user` for that email, replace the entry in `USERS`, redeploy.

## File map

```
medstar-console/
├── README.md
├── package.json
├── .env.example
├── next.config.mjs
├── jsconfig.json
├── .gitignore
├── scripts/
│   └── add-user.js              ← password hasher CLI
├── app/
│   ├── layout.jsx, page.jsx, globals.css
│   └── api/
│       ├── auth/
│       │   ├── login/route.js   ← POST email+password → session cookie
│       │   ├── logout/route.js
│       │   └── me/route.js
│       ├── sheet/version/route.js
│       └── tasks/
│           ├── route.js          ← GET list, POST create
│           └── [rowId]/
│               ├── route.js     ← PATCH edit
│               ├── close/route.js
│               └── reopen/route.js
├── components/
│   ├── Dashboard.jsx
│   └── LoginPage.jsx
└── lib/
    ├── auth.js                   ← scrypt + HMAC sessions, no deps
    ├── permissions.js
    ├── smartsheet.js
    └── normalize.js
```

## Common issues

**"Invalid email or password"** — check the email exactly matches the entry in `USERS`. Case-insensitive but no whitespace. If lost, re-run `npm run add-user` with the same email to generate a new password hash.

**"Failed to load" right after sign-in** — `SMARTSHEET_TOKEN` is missing or invalid. Check Vercel env vars and redeploy.

**Logged out unexpectedly** — `SESSION_SECRET` was changed on the server, invalidating all sessions. Sign in again. Don't rotate this casually.

**Adding a new user but they can't sign in** — Vercel needs a redeploy after env var changes. Go to Vercel → Deployments → click "Redeploy" on the latest deployment.

## Cost

**$0/month.** Vercel Hobby + Smartsheet's existing API allowance. No external auth service.
