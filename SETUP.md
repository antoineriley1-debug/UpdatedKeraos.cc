# Priority Tasks — Setup Guide

**What you'll have at the end:** A live web app at a URL like `priority-tasks.vercel.app` where you and your team sign in with email + password, see all 18+ Smartsheet rows live, and create / edit / close / reopen tasks. Every action writes back to Smartsheet in real time.

**Total time: ~30 minutes.**

**What you need before starting:**
- A computer with Node.js installed ([nodejs.org](https://nodejs.org) — pick the LTS version if you don't have it)
- A GitHub account ([github.com](https://github.com) — free)
- A Vercel account ([vercel.com](https://vercel.com) — free, sign in with GitHub)
- The `medstar-console.zip` file (you have this)

---

## PHASE 1 — Get the code on GitHub (5 min)

### Step 1.1 — Unzip the project

1. Double-click `medstar-console.zip` to unzip it.
2. You should now have a folder called `medstar-console`.

### Step 1.2 — Create a new private GitHub repo

1. Go to **https://github.com/new**
2. **Repository name:** `priority-tasks`
3. **Privacy:** click **Private**
4. Leave everything else unchecked.
5. Click **Create repository**.
6. **Keep this page open** — you'll need the URL it shows you.

### Step 1.3 — Upload the code

1. On the new repo page, click the link that says **"uploading an existing file"** (it's in the quick-setup section).
2. Drag the entire `medstar-console` folder into the upload area. Wait for files to finish uploading (about 30 seconds).
3. Scroll down. In the "Commit changes" box, leave defaults.
4. Click **Commit changes**.

✅ Your code is now on GitHub.

---

## PHASE 2 — Create your admin login (3 min)

### Step 2.1 — Open Terminal in the project folder

**On Mac:** Right-click the `medstar-console` folder → New Terminal at Folder.
**On Windows:** Shift+right-click inside the folder → Open PowerShell window here.

### Step 2.2 — Install the project once

In the terminal, type this and press Enter:

```
npm install
```

Wait ~60 seconds. You'll see a lot of text scroll. When the prompt comes back, you're done.

### Step 2.3 — Create your user

Type this and press Enter:

```
npm run add-user
```

Answer the prompts:
- **Email:** `antoine.riley@crothall.com`
- **Full name:** `Antoine Riley`
- **Password:** (pick a strong one — write it down)
- **Role:** type `admin` and press Enter

The script outputs two boxes of JSON. **Copy the bottom one** (the one inside square brackets `[...]`). It looks something like:

```
[{"email":"antoine.riley@crothall.com","name":"Antoine Riley","role":"admin","passwordHash":"abc123:def456..."}]
```

📋 **Save that text somewhere** (a sticky note app is fine) — you'll paste it in Phase 4.

### Step 2.4 — Generate a session secret

Type this and press Enter:

**On Mac:**
```
openssl rand -hex 32
```

**On Windows PowerShell:**
```
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```

You'll get a long random string like `7f3a2b...`. 📋 **Save it** alongside the user JSON.

---

## PHASE 3 — Get your Smartsheet token (2 min)

### Step 3.1 — Open Smartsheet API settings

1. Log into Smartsheet.
2. Click your avatar (top-right circle with your initials).
3. Click **Personal Settings**.
4. In the left menu, click **Apps & Integrations**.
5. Click **API Access**.

### Step 3.2 — Generate the token

1. Click **Generate new access token**.
2. **Name:** `Priority Tasks Console`
3. Click **OK**.
4. **Copy the token immediately.** Smartsheet only shows it once.

📋 **Save it** alongside your other secrets.

---

## PHASE 4 — Deploy to Vercel (5 min)

### Step 4.1 — Import the project

1. Go to **https://vercel.com/new**
2. You'll see a list of your GitHub repos. Find **priority-tasks** and click **Import** next to it.
3. **Project name:** leave as `priority-tasks`.
4. **Framework Preset:** should auto-detect as **Next.js**. If not, pick Next.js.
5. **Don't click Deploy yet.** Scroll down to **Environment Variables**.

### Step 4.2 — Add the environment variables

You need to add **6 variables**. For each one: type the name in the left field, paste the value in the right field, click **Add**.

| Name | Value |
|---|---|
| `SMARTSHEET_TOKEN` | The Smartsheet token from Step 3.2 |
| `SMARTSHEET_SHEET_ID` | `8870685098069892` |
| `SESSION_SECRET` | The random string from Step 2.4 |
| `USERS` | The user JSON array from Step 2.3 (the one in `[...]`) |
| `NEXT_PUBLIC_DISPLAY_NAME` | `Priority Tasks` |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | `60000` |

### Step 4.3 — Deploy

Click the big **Deploy** button at the bottom. Wait ~90 seconds. You'll see a build log scroll. When it's done, you'll see a celebration screen with your live URL (like `priority-tasks-abc123.vercel.app`).

✅ Your app is live.

---

## PHASE 5 — Sign in (1 min)

1. Click the live URL Vercel gave you.
2. You'll see the login screen.
3. Email: `antoine.riley@crothall.com` (or whatever you used in Step 2.3).
4. Password: the one you set in Step 2.3.
5. Click **Sign In**.

You should see your Priority Tasks dashboard with all 18+ rows from the Smartsheet.

🎉 Done.

---

## Adding teammates later (~2 min per person)

### Each time you want to add someone:

1. Open Terminal in the `medstar-console` folder.
2. Run `npm run add-user`.
3. Answer the prompts for the new person (their email, name, your-chosen password, role).
4. Copy the **top JSON object** (the one with just curly braces `{...}`, not the array).
5. Go to **vercel.com** → your project → **Settings** → **Environment Variables**.
6. Find `USERS` and click **Edit**.
7. The value looks like `[{...existing user...}]`. Add a comma after the last `}`, paste your new object, so it becomes `[{...existing...},{...new user...}]`.
8. Click **Save**.
9. Go to **Deployments** → click the **⋯** menu on the latest deployment → **Redeploy**.
10. Tell the new person their email + password and the URL.

### To remove someone:

Same as above, but in step 7, **delete their JSON object** (and the comma before/after it) instead of adding. Redeploy. Their session dies on next request.

---

## Quick troubleshooting

**"Invalid email or password" when I try to sign in**
- Email is wrong, or password is wrong, or `USERS` env var has a typo. Check the JSON in Vercel is valid (paste it into [jsonlint.com](https://jsonlint.com) to verify).

**Dashboard loads but says "Failed to load"**
- `SMARTSHEET_TOKEN` is missing or wrong. Go to Vercel → Settings → Environment Variables → check the value → if you changed anything, redeploy.

**Build fails on Vercel**
- Open the build log and scroll up to the first red error line. Usually it's a missing env var. Add it and redeploy.

**"Logged out" message keeps appearing**
- `SESSION_SECRET` was changed and your session cookie is now invalid. Sign in again with email + password.

**Need to change your own password**
- Run `npm run add-user` again with the same email. Replace your old JSON object in the `USERS` env var with the new one. Redeploy.

---

## What it costs

**$0/month forever** at this scale. Vercel free tier covers ~100 GB/month bandwidth (you'll use a few MB). Smartsheet API is free under your existing plan.

If you ever want a custom domain like `priority.crothall.com`, that's ~$12/year for the domain — set it in Vercel → Domains.
