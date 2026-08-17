"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format-duration";
import { useLiveSeconds } from "@/lib/use-live-seconds";
import { Spinner } from "@/components/spinner";
import type { Task } from "@/lib/types";

type TaskRowProps = {
  task: Task;
  index: number;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onRename: (task: Task, name: string) => void;
  // Which action is syncing in the background for this row, if any. Only
  // the matching button spins — its sibling just goes disabled, since it
  // isn't the action that was actually clicked.
  pendingAction: "start" | "delete" | null;
};

export function TaskRow({
  task,
  index,
  onToggle,
  onDelete,
  onRename,
  pendingAction,
}: TaskRowProps) {
  const liveSeconds = useLiveSeconds(task);
  const [isEditing, setIsEditing] = useState(false);
  const isBusy = pendingAction !== null;

  return (
    <li className="group flex items-center justify-between gap-3 rounded-md border border-panel-hi bg-panel py-4 pr-4 pl-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel-hi font-mono text-[11px] tabular-nums text-mist"
          aria-hidden="true"
        >
          {index}
        </span>
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
            className="-mx-2 -my-1 min-w-0 flex-1 rounded-md border border-signal bg-void px-2 py-1 font-sans text-sm text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="-mx-2 -my-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-panel-hi focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <span className="min-w-0 flex-1 truncate font-sans text-sm text-ink">
              {task.name}
            </span>
            <svg
              width="12"
              height="12"
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
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-lg tabular-nums text-ink">
          {formatDuration(liveSeconds)}
        </span>
        <button
          onClick={() => onToggle(task)}
          disabled={isBusy}
          aria-label={`Start ${task.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-hi text-signal transition-colors hover:bg-signal-dim disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          {pendingAction === "start" ? (
            <Spinner />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <polygon points="2,1 13,7 2,13" />
            </svg>
          )}
        </button>
        <button
          onClick={() => onDelete(task)}
          disabled={isBusy}
          aria-label={`Delete ${task.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-danger opacity-70 transition-opacity hover:bg-danger-dim hover:opacity-100 focus-visible:bg-danger-dim focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-30"
        >
          {pendingAction === "delete" ? (
            <Spinner />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 2L12 12M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>
    </li>
  );
}
