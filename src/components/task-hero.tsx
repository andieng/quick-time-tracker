"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import { useLiveSeconds } from "@/lib/use-live-seconds";
import type { Task } from "@/lib/types";

type TaskHeroProps = {
  task: Task | null;
  index?: number;
  onStop: (task: Task) => void;
  onRename: (task: Task, name: string) => void;
  pending: boolean;
};

export function TaskHero({ task, index, onStop, onRename, pending }: TaskHeroProps) {
  const liveSeconds = useLiveSeconds(task);
  const [isEditing, setIsEditing] = useState(false);

  if (!task) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-panel-hi bg-panel px-5 py-4">
        <span className="h-2 w-2 shrink-0 rounded-full bg-mist" aria-hidden="true" />
        <p className="font-sans text-sm text-mist">
          Nothing running — start an activity below to begin tracking.
        </p>
      </div>
    );
  }

  const startedAtLabel = task.started_at
    ? new Date(task.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="rounded-xl bg-gradient-to-br from-signal to-signal-2 p-px shadow-[0_20px_60px_-20px_rgba(129,114,242,0.45)]">
      <div className="flex flex-col gap-4 rounded-[calc(0.75rem-1px)] bg-panel px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="pulse-signal h-2 w-2 rounded-full bg-signal" />
            <span className="font-sans text-xs font-medium tracking-[0.2em] text-signal">
              NOW
            </span>
            {index !== undefined && (
              <span className="font-mono text-xs text-mist" aria-hidden="true">
                #{index}
              </span>
            )}
          </div>
          {isEditing ? (
            <input
              autoFocus
              defaultValue={task.name}
              aria-label="Activity name"
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = task.name;
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => {
                const next = e.currentTarget.value.trim();
                if (next && next !== task.name) onRename(task, next);
                setIsEditing(false);
              }}
              className="-mx-2 -my-1 w-full min-w-0 rounded-md border border-signal bg-void px-2 py-1 font-display text-2xl font-bold tracking-tight text-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="group -mx-2 -my-1 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-panel-hi focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            >
              <span className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight text-ink">
                {task.name}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-mist opacity-0 transition-opacity group-hover:opacity-100"
              >
                <path
                  d="M9.5 1.5L12.5 4.5L4.5 12.5L1 13L1.5 9.5L9.5 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {startedAtLabel && (
            <span className="font-mono text-xs tabular-nums text-mist">
              Started {startedAtLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <span className="font-mono text-4xl font-medium tabular-nums text-ink sm:text-5xl">
            {formatDuration(liveSeconds)}
          </span>
          <button
            onClick={() => onStop(task)}
            disabled={pending}
            aria-label={`Stop ${task.name}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-signal to-signal-2 text-ink transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="1" y="1" width="4.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="4.5" height="12" rx="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
