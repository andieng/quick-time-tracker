import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClientTimestamp } from "@/lib/client-time";

// In focus mode only one task can run at a time: stop whichever one is
// currently running and fold its elapsed time into total_seconds. Shared
// between the start route and the create+start route (Run), since both
// need this before starting a new task. clientNow is the same click-time
// timestamp used for starting the new task — the same instant is when the
// previous one visually stopped, so it applies to both.
export async function stopRunningTasks(
  supabase: SupabaseClient,
  userId: string,
  clientNow?: unknown,
): Promise<void> {
  const { data: runningTasks } = await supabase
    .from("tasks")
    .select("id, started_at, total_seconds")
    .eq("user_id", userId)
    .eq("is_running", true);

  for (const running of runningTasks ?? []) {
    const startedAtMs = new Date(running.started_at!).getTime();
    const stoppedAtMs = resolveClientTimestamp(clientNow, startedAtMs);
    const elapsed = Math.floor((stoppedAtMs - startedAtMs) / 1000);
    await supabase
      .from("tasks")
      .update({
        is_running: false,
        started_at: null,
        total_seconds: running.total_seconds + elapsed,
      })
      .eq("id", running.id)
      .eq("user_id", userId);
  }
}
