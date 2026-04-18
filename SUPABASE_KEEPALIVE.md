# Supabase Free Tier Keep-Alive Setup
Keep your Supabase project alive using GitHub Actions (free cron job).
Pings your database once a week so it never goes inactive.

---

## How it works
A GitHub Action runs every Sunday at midnight UTC.
It calls your Django `/api/auth/login/` endpoint.
This counts as activity and resets Supabase's 7-day inactivity timer.

---

## Step 1 — Get your Railway URL
You already have this:
```
https://skillbridge-production-1e3c.up.railway.app
```
If it changes in the future, update the GitHub secret (Step 2).

---

## Step 2 — Add your Railway URL as a GitHub Secret
1. Go to your GitHub repo (skillbridge-backend)
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add this secret:
   - **Name:** `RAILWAY_URL`
   - **Value:** `https://skillbridge-production-1e3c.up.railway.app`
5. Click **Add secret**

---

## Step 3 — Create the GitHub Action file
In your backend project, create this folder and file:

```
skillbridge-backend/
└── .github/
    └── workflows/
        └── supabase-keepalive.yml
```

Paste this exact content into `supabase-keepalive.yml`:

```yaml
name: Supabase Keep-Alive

on:
  schedule:
    - cron: '0 0 * * 0'   # Every Sunday at midnight UTC
  workflow_dispatch:        # Allow manual trigger from GitHub UI

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Railway backend (keeps Supabase alive)
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ secrets.RAILWAY_URL }}/api/auth/login/)
          echo "Response status: $STATUS"
          if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 500 ]; then
            echo "✅ Ping successful - Supabase is alive"
          else
            echo "❌ Ping failed with status $STATUS"
            exit 1
          fi
```

---

## Step 4 — Commit and push
Run these commands in your backend folder:

```bash
mkdir -p .github/workflows
git add .github/workflows/supabase-keepalive.yml
git commit -m "add supabase keep-alive github action"
git push
```

---

## Step 5 — Verify it works
1. Go to your GitHub repo
2. Click the **"Actions"** tab
3. You should see **"Supabase Keep-Alive"** in the list
4. Click it → click **"Run workflow"** → click the green **"Run workflow"** button
5. Wait a few seconds and refresh — it should show a green checkmark ✅

---

## Step 6 — Check the Supabase dashboard
After the action runs:
1. Go to [supabase.com](https://supabase.com) → your project
2. Check that the project status is still **Active**
3. The "Last active" date should be updated

---

## Schedule Options
You can change how often it runs by editing the cron expression:

| Cron Expression | Meaning |
|----------------|---------|
| `0 0 * * 0` | Every Sunday midnight UTC (default) |
| `0 0 */3 * *` | Every 3 days (safer option) |
| `0 0 * * 1,4` | Every Monday and Thursday |

To change it, edit the `cron:` line in `supabase-keepalive.yml` and push.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Action fails with connection error | Check that `RAILWAY_URL` secret is correct and Railway is running |
| Supabase still pauses | Change cron to `0 0 */3 * *` (every 3 days) |
| Action doesn't appear in Actions tab | Make sure the file is inside `.github/workflows/` folder |
| Red X on action run | Click the run → click the job → read the error log |
| `curl: command not found` | The `ubuntu-latest` runner always has curl — this shouldn't happen |

---

## Notes
- The cron runs every Sunday — well within the 7-day inactivity limit
- The 90-day data loss only happens if the project stays **paused** for 90 days
- Keeping it active (not paused) prevents data loss completely
- `workflow_dispatch` lets you trigger the ping manually anytime
  from GitHub → Actions tab → Run workflow button
- This is completely free — GitHub Actions gives 2,000 free minutes/month
  and this job uses less than 1 minute per run
