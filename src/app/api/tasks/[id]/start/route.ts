import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stopRunningTasks } from "@/lib/supabase/stop-running-tasks";
import { resolveClientTimestamp } from "@/lib/client-time";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientNow } = await request.json().catch(() => ({ clientNow: undefined }));
  const startedAtMs = resolveClientTimestamp(clientNow, Date.now() - 60_000);

  const multitask = user.user_metadata?.multitask === true;
  if (!multitask) {
    await stopRunningTasks(supabase, user.id, clientNow);
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ is_running: true, started_at: new Date(startedAtMs).toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
