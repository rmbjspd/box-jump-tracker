# Project 36-Inch Counter — Deployment Guide

## Step 1: Set up your Supabase database

1. Go to https://supabase.com/dashboard/project/tuwmswxfwnxjzujuignq/sql
2. Click **"New query"**
3. Paste the entire contents of `supabase-schema.sql`
4. Click **"Run"**

That creates the `sessions` table and seeds your baseline session.

---

## Step 2: Push code to GitHub

1. Create a free account at https://github.com if you don't have one
2. Click **"New repository"** → name it `box-jump-tracker` → set to **Private** → click Create
3. On your computer, open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
# Navigate to the project folder (wherever you saved it)
cd box-jump-tracker

# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/box-jump-tracker.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3: Deploy to Vercel (free)

1. Go to https://vercel.com and sign up **with your GitHub account**
2. Click **"Add New Project"**
3. Find and select your `box-jump-tracker` repository
4. Vercel will auto-detect it as a React app — click **"Deploy"**
5. Wait ~60 seconds — your app is live! 🎉

Vercel gives you a URL like: `https://box-jump-tracker-abc123.vercel.app`

---

## Step 4: Every future update

Any time you want to update the app:

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel auto-redeploys in ~30 seconds. No manual steps needed.

---

## Troubleshooting

**"Sessions not loading"** — make sure you ran the SQL schema in Step 1.

**"Build failed on Vercel"** — check that `package.json` is in the root of the repo (not inside a subfolder).

**"Can't connect to Supabase"** — the anon key and URL are already hardcoded in `src/supabase.js`. No environment variables needed for a personal app.
