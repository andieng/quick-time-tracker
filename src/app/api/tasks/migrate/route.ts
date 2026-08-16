import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MigrateTask = {
  name: string;
  total_seconds: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tasks } = (await request.json()) as { tasks: MigrateTask[] };
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  const { data: last } = await supabase
    .from("tasks")
    .select("seq")
    .eq("user_id", user.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = (last?.seq ?? 0) + 1;
  const rows = tasks
    .filter((t) => typeof t.name === "string" && t.name.trim())
    .map((t) => ({
      user_id: user.id,
      seq: nextSeq++,
      name: t.name.trim(),
      total_seconds: Math.max(0, Math.floor(t.total_seconds) || 0),
    }));

  const { data, error } = await supabase.from("tasks").insert(rows).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}
