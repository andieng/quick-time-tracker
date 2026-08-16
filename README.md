# Quick Time Tracker

A minimal time tracker: add a task, hit start/stop. One timer runs at a time. There's no login gate — the tracker itself is the landing page.

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

3. **Run the schema** — open the SQL editor in your Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql). This creates the `tasks` table and its row-level security policies.

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

Connect the repo to Vercel and set the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in the Vercel project settings. Vercel deploys automatically on push; a GitHub Actions quality gate (`.github/workflows/quality-gate.yml`) runs lint, typecheck, build, and tests on every push/PR to `main`.

Also add your deployed origin's callback URL (`https://<your-domain>/auth/callback`) to the Supabase Auth redirect allow list.
