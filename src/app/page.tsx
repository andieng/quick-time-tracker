import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/task-board";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tasks = user
    ? (
        await supabase.from("tasks").select("*").order("created_at", { ascending: false })
      ).data ?? []
    : [];

  return (
    <TaskBoard
      initialTasks={tasks}
      userEmail={user?.email ?? ""}
      isSignedIn={!!user}
      initialMultitask={user?.user_metadata?.multitask === true}
    />
  );
}
