# Quick Time Tracker

A minimal time tracker: add a task, hit start/stop. One timer runs at a time. There's no login gate — the tracker itself is the landing page.

Vibe-coded with [Claude Code](https://claude.com/claude-code) — the app, its Supabase backend, and its CI/CD pipeline were all built through conversation, not hand-written line by line.

- **Just show up** — tasks are tracked immediately, stored in the browser's `localStorage`. No account, no server round-trip. Clearing browser data or switching devices resets guest data.
- **Sign in with Google** (a link in the header, or in the guest banner) — any tasks already tracked as a guest are migrated into the account automatically on first sign-in. From then on, data is stored in Supabase and safe across a cleared cache, a different browser, or a new device.

## Stack

- Next.js (App Router, TypeScript)
- Supabase — Postgres (data) + Auth (Google OAuth) + Row Level Security, for signed-in users
- Browser `localStorage`, for guest users
- Tailwind CSS

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), then copy the Project URL and **publishable key** (Project Settings → API Keys — this is the client-safe key; never use the **secret key** in this app, since it bypasses row-level security).

3. **Run the schema** — apply the migration in [`supabase/migrations/`](./supabase/migrations/), either with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`supabase link --project-ref <ref>` then `supabase db push`), or by pasting its contents into your Supabase project's SQL editor. This creates the `tasks` and `feedback` tables and their row-level security policies.

4. **Enable Google sign-in**
   - In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth client (Web application), and add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
   - In your Supabase project's Auth → Providers settings, enable Google and paste the client ID/secret.

5. **Set environment variables** — copy `.env.example` to `.env.local` and fill in your Supabase URL and publishable key:

   ```bash
   cp .env.example .env.local
   ```

6. **Run the app**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploying

Connect the repo to Vercel and set the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in the Vercel project settings — scope prod values to Production and dev-project values to Preview/Development, since `main` and `develop` map to separate Supabase projects (see below). Vercel deploys automatically on push.

Also add your deployed origin's callback URL (`https://<your-domain>/auth/callback`) to each Supabase project's Auth redirect allow list.

### CI/CD

`.github/workflows/quality-gate.yml` runs on every push/PR to `main` or `develop`:

- **Quality Gate** — lint, typecheck, build, test.
- **Run Supabase Migration** — only on an actual push (not PRs) to `main` or `develop`, never any other branch. Uses the Supabase CLI (`supabase link` + `supabase db push`) to apply `supabase/migrations/` against the matching project: `main` → prod, `develop` → dev.

Repo-level (Settings → Secrets and variables → Actions):

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` (variable) | Used for the build step's smoke test |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (secret) | Used for the build step's smoke test |
| `SUPABASE_ACCESS_TOKEN` (secret) | Personal access token from your [Supabase account settings](https://supabase.com/dashboard/account/tokens) — account-level, shared across both projects |

The migration job also needs two [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) (Settings → Environments), named **exactly** `Production` and `Development` (the workflow selects between them by branch, and the name must match exactly). Each needs its own **Environment secrets** (not repo-level secrets) with the same two names — `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` resolve to whichever environment the job runs under:

| Environment | Used on push to | `SUPABASE_PROJECT_REF` | `SUPABASE_DB_PASSWORD` |
|---|---|---|---|
| `Production` | `main` | prod project ref | prod project's DB password |
| `Development` | `develop` | dev project ref | dev project's DB password |
