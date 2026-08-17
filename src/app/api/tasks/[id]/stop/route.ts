import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("started_at, total_seconds, is_running")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: fetchError?.message ?? "Task not found" }, { status: 404 });
  }

  if (!task.is_running || !task.started_at) {
    return NextResponse.json({ error: "Task is not running" }, { status: 409 });
  }

  const { clientNow } = await request.json().catch(() => ({ clientNow: undefined }));
  const startedAtMs = new Date(task.started_at).getTime();
  const stoppedAtMs = resolveClientTimestamp(clientNow, startedAtMs);
  const elapsed = Math.floor((stoppedAtMs - startedAtMs) / 1000);

  const { data, error } = await supabase
    .from("tasks")
    .update({
      is_running: false,
      started_at: null,
      total_seconds: task.total_seconds + elapsed,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
