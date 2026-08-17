import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

// Fixed-window counter keyed by an arbitrary identifier (e.g. a user id or
// hashed IP). Read-then-write, so two requests arriving in the same
// instant could both slip through — an acceptable trade-off for throttling
// a low-stakes feedback form, not a hard security boundary.
export async function isRateLimited(key: string): Promise<boolean> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: row } = await admin
    .from("feedback_rate_limit")
    .select("window_start, count")
    .eq("id", key)
    .maybeSingle();

  if (!row || now - new Date(row.window_start).getTime() > WINDOW_MS) {
    await admin
      .from("feedback_rate_limit")
      .upsert({ id: key, window_start: new Date(now).toISOString(), count: 1 });
    return false;
  }

  if (row.count >= MAX_PER_WINDOW) {
    return true;
  }

  await admin
    .from("feedback_rate_limit")
    .update({ count: row.count + 1 })
    .eq("id", key);
  return false;
}
