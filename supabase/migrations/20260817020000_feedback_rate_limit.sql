-- Caps how large a single feedback submission can be (app-level validation
-- mirrors this, this is the defense-in-depth backstop).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'feedback_message_length'
  ) then
    alter table public.feedback
      add constraint feedback_message_length check (char_length(message) <= 2000);
  end if;
end $$;

-- Tracks submission counts per identifier (signed-in user id, or a hashed
-- IP for guests) for rate limiting /api/feedback. Deliberately NOT granted
-- to anon/authenticated: this table is only ever touched by the server
-- using the secret key, which bypasses RLS. If it were writable via
-- the public API (even behind an RLS policy scoped to "own rows"), a
-- client could reset or inflate its own counter directly through
-- PostgREST and bypass the limit entirely — the whole point is that only
-- the app's own server code can touch it.
create table if not exists public.feedback_rate_limit (
  id text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 1
);

alter table public.feedback_rate_limit enable row level security;
