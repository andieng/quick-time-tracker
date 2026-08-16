-- Newer Supabase projects default to NOT auto-exposing new tables to the
-- anon/authenticated API roles. RLS policies only control which rows a role
-- can touch — they don't substitute for the base table-level grant, which
-- is why inserts were failing with "permission denied for table feedback"
-- even though RLS was correctly configured. Grants only what the app
-- actually uses for each role.

grant select, insert, update, delete on public.tasks to authenticated;
grant insert on public.feedback to anon, authenticated;
