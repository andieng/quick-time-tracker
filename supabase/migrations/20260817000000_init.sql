-- Initial schema. Applied via `supabase db push` (see .github/workflows) —
-- the CLI tracks which migrations have run, so this only executes once per
-- linked project. Written with if-not-exists/idempotent guards anyway as a
-- safety net for manual intervention.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  is_running boolean not null default false,
  started_at timestamptz,
  total_seconds integer not null default 0
);

-- Per-user display number (1, 2, 3, ...), assigned once at creation and
-- never reused or renumbered, even after other activities are deleted.
-- Added as nullable first so this runs safely against a table that already
-- has rows, then backfilled (oldest first, per user) and locked to not null.
alter table public.tasks add column if not exists seq bigint;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at) as rn
  from public.tasks
  where seq is null
)
update public.tasks t set seq = ranked.rn
from ranked
where t.id = ranked.id;

alter table public.tasks alter column seq set not null;

alter table public.tasks enable row level security;

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- Bug reports / feature requests submitted from the app footer. Write-only
-- from the app's perspective: anyone (including guests) can insert, but
-- there's no select policy, so submissions can only be read from the
-- Supabase dashboard (which uses the service role and bypasses RLS).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('bug', 'feature')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
  on public.feedback for insert
  with check (true);
