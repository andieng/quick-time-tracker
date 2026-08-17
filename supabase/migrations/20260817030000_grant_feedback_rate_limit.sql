-- RLS bypass and table-level GRANT are separate checks — service_role
-- bypasses RLS, but still needs the base grant to touch the table at all,
-- same root cause as the earlier tasks/feedback grant fix. Scoped to
-- service_role only: anon/authenticated deliberately get nothing here (see
-- 20260817020000_feedback_rate_limit.sql for why).
grant select, insert, update on public.feedback_rate_limit to service_role;
