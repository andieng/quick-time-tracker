"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";

export function useLiveSeconds(task: Task | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!task?.is_running) return;
    // `now` may predate this task's started_at (it was last set whenever
    // this hook last rendered), which would show negative elapsed time
    // until the first interval tick. Resync on the next macrotask instead
    // of calling setState synchronously in the effect body.
    const resync = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(resync);
      clearInterval(interval);
    };
  }, [task?.is_running, task?.started_at]);

  if (!task) return 0;
  if (!task.is_running || !task.started_at) return task.total_seconds;
  const elapsed = Math.floor((now - new Date(task.started_at).getTime()) / 1000);
  return task.total_seconds + Math.max(0, elapsed);
}
