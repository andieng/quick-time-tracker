"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";

export function useLiveSeconds(task: Task | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!task?.is_running || !task.started_at) return;
    const startedAtMs = new Date(task.started_at).getTime();

    // Align ticks to the actual second boundaries of started_at, rather
    // than to whenever this effect happened to run. A plain 1s interval
    // drifts out of phase with real elapsed time, so the displayed number
    // can lag up to ~1s behind — e.g. showing "13" for a moment after the
    // real elapsed time has already ticked over to 14, causing Pause to
    // record a different number than what was on screen when clicked.
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const msIntoSecond = (current - startedAtMs) % 1000;
      timeout = setTimeout(tick, 1000 - msIntoSecond);
    };
    timeout = setTimeout(tick, 0);
    return () => clearTimeout(timeout);
  }, [task?.is_running, task?.started_at]);

  if (!task) return 0;
  if (!task.is_running || !task.started_at) return task.total_seconds;
  const elapsed = Math.floor((now - new Date(task.started_at).getTime()) / 1000);
  return task.total_seconds + Math.max(0, elapsed);
}
