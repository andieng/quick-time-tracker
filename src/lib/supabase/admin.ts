import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Secret-key client for server-only bookkeeping (currently: feedback rate
// limiting) that must not be reachable through the public API at all — not
// even behind an RLS policy scoped to "own rows", since that would still
// let a client call PostgREST directly and reset its own counter. Never
// import this into anything that runs in the browser: the secret key
// bypasses RLS entirely.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
