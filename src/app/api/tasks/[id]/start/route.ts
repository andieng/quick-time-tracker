import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // In focus mode only one task can run at a time: stop whichever one is
  // currently running and fold its elapsed time into total_seconds before
  // starting the new one. Multitask mode skips this and leaves others running.
  const multitask = user.user_metadata?.multitask === true;

  if (!multitask) {
    const { data: runningTasks } = await supabase
      .from("tasks")
      .select("id, started_at, total_seconds")
      .eq("user_id", user.id)
      .eq("is_running", true);

    for (const running of runningTasks ?? []) {
      const elapsed = Math.floor(
        (Date.now() - new Date(running.started_at!).getTime()) / 1000,
      );
      await supabase
        .from("tasks")
        .update({
          is_running: false,
          started_at: null,
          total_seconds: running.total_seconds + elapsed,
        })
        .eq("id", running.id)
        .eq("user_id", user.id);
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ is_running: true, started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}
