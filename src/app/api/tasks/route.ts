import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stopRunningTasks } from "@/lib/supabase/stop-running-tasks";
import { resolveClientTimestamp } from "@/lib/client-time";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, clientNow } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Task name is required" }, { status: 400 });
  }

  // The browser generates the id up front (instead of waiting on this
  // insert to hand one back) so the UI can let Stop/Delete target the new
  // row immediately — no round trip has to complete before those buttons
  // become usable.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const taskId = typeof id === "string" && uuidPattern.test(id) ? id : undefined;

  const startedAtMs = resolveClientTimestamp(clientNow, Date.now() - 60_000);

  // Every task is created already running (the "Run" button), so this
  // folds in the same stop-other-running-tasks step the start route does —
  // one request instead of create-then-start as two separate round trips.
  const multitask = user.user_metadata?.multitask === true;
  if (!multitask) {
    await stopRunningTasks(supabase, user.id, clientNow);
  }

  const { data: last } = await supabase
    .from("tasks")
    .select("seq")
    .eq("user_id", user.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...(taskId ? { id: taskId } : {}),
      name: name.trim(),
      user_id: user.id,
      seq: (last?.seq ?? 0) + 1,
      is_running: true,
      started_at: new Date(startedAtMs).toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("tasks").delete().eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
