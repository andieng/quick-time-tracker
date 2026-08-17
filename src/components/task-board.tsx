"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_TASKS,
  getLocalTasks,
  saveLocalTasks,
  clearLocalTasks,
  createLocalTask,
  startLocalTask,
  stopLocalTask,
  deleteLocalTask,
  renameLocalTask,
  keepMostRecentRunning,
  backfillMissingSeq,
  autoTaskName,
  subscribeLocalTasks,
  getLocalMode,
  setLocalMode,
  subscribeLocalMode,
} from "@/lib/local-tasks";
import { TaskHero } from "@/components/task-hero";
import { TaskRow } from "@/components/task-row";
import { FeedbackModal } from "@/components/feedback-modal";
import { Spinner } from "@/components/spinner";
import type { Task } from "@/lib/types";

type TaskBoardProps = {
  initialTasks: Task[];
  userEmail: string;
  isSignedIn: boolean;
  initialMultitask: boolean;
};

export function TaskBoard({ initialTasks, userEmail, isSignedIn, initialMultitask }: TaskBoardProps) {
  const [signedInTasks, setSignedInTasks] = useState(initialTasks);
  const guestTasks = useSyncExternalStore(subscribeLocalTasks, getLocalTasks, () => EMPTY_TASKS);
  const tasks = isSignedIn ? signedInTasks : guestTasks;
  const runningTasks = tasks.filter((t) => t.is_running);
  const idleTasks = tasks.filter((t) => !t.is_running);

  const [signedInMultitask, setSignedInMultitask] = useState(initialMultitask);
  const guestMultitask = useSyncExternalStore(subscribeLocalMode, getLocalMode, () => false);
  const multitask = isSignedIn ? signedInMultitask : guestMultitask;

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Which background action (if any) is in flight for a given task id.
  // Drives per-row pending UI: only the button that was actually clicked
  // shows a spinner, its sibling on the same row just goes disabled.
  const [pendingActions, setPendingActions] = useState<Record<string, "start" | "stop" | "delete">>(
    {},
  );
  const [signInError, setSignInError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature">("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const migrated = useRef(false);
  const seqBackfilled = useRef(false);
  // In-flight create requests, keyed by the task id the browser generated
  // for them. Stop/Delete on a task id that's still being created await
  // the matching entry before firing their own request, so the insert is
  // guaranteed to land first — invisibly, with no extra spinner or delay.
  const creationRequests = useRef(new Map<string, Promise<boolean>>());
  const router = useRouter();

  // One-time self-heal: guest activities created before "seq" existed don't
  // have one yet — assign them one in creation order, same as the Supabase
  // migration does for signed-in accounts.
  useEffect(() => {
    if (isSignedIn || seqBackfilled.current) return;
    seqBackfilled.current = true;
    const current = getLocalTasks();
    if (current.some((t) => !t.seq)) {
      saveLocalTasks(backfillMissingSeq(current));
    }
  }, [isSignedIn]);

  // One-time migration: a guest who just signed in with Google may have
  // tasks sitting in localStorage from before they had an account.
  useEffect(() => {
    if (!isSignedIn || migrated.current) return;
    const local = getLocalTasks();
    if (local.length === 0) return;

    migrated.current = true;
    // Migrate oldest-first so the new account's seq numbers preserve the
    // order these were originally created in as a guest.
    const chronological = [...local].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    fetch("/api/tasks/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: chronological.map((t) => ({ name: t.name, total_seconds: t.total_seconds })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.tasks?.length) {
          setSignedInTasks((prev) => [...data.tasks, ...prev]);
          clearLocalTasks();
        }
      });
  }, [isSignedIn]);

  useEffect(() => {
    if (!confirmingClear) return;
    const timeout = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirmingClear]);

  useEffect(() => {
    if (!actionError) return;
    const timeout = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(timeout);
  }, [actionError]);

  useEffect(() => {
    if (feedbackStatus !== "sent") return;
    const timeout = setTimeout(() => {
      setFeedbackOpen(false);
      setFeedbackStatus("idle");
    }, 1500);
    return () => clearTimeout(timeout);
  }, [feedbackStatus]);

  const setPending = (taskId: string, action: "start" | "stop" | "delete") => {
    setPendingActions((prev) => ({ ...prev, [taskId]: action }));
  };
  const clearPending = (taskId: string) => {
    setPendingActions((prev) => {
      if (!(taskId in prev)) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const runTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const taskName = name.trim() || autoTaskName();

    if (!isSignedIn) {
      const task = createLocalTask(taskName, guestTasks);
      saveLocalTasks(startLocalTask([task, ...guestTasks], task.id, multitask));
      setName("");
      return;
    }

    // The id is generated here instead of waiting for the server to hand
    // one back, so the new row is immediately a real, addressable task —
    // Stop/Delete can target it right away with no round trip to wait on.
    const id = crypto.randomUUID();
    const now = Date.now();
    const clientNow = new Date(now).toISOString();
    const maxSeq = tasks.reduce((max, t) => Math.max(max, t.seq || 0), 0);
    const optimisticTask: Task = {
      id,
      user_id: "",
      seq: maxSeq + 1,
      name: taskName,
      created_at: clientNow,
      is_running: true,
      started_at: clientNow,
      total_seconds: 0,
    };

    setSubmitting(true);
    setName("");
    setSignedInTasks((prev) => [
      optimisticTask,
      ...prev.map((t) =>
        !multitask && t.is_running ? { ...t, is_running: false, started_at: null } : t,
      ),
    ]);

    // Any Stop/Delete fired on this id before the insert lands still needs
    // to happen after it server-side, or it would 404 or silently no-op —
    // tracked here so those actions can wait on it invisibly (no spinner,
    // no disabled button) instead of blocking the click itself.
    const creation = (async () => {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: taskName, clientNow }),
        });
        if (!res.ok) {
          setSignedInTasks((prev) => prev.filter((t) => t.id !== id));
          setActionError("Couldn't start activity — try again.");
          return false;
        }
        const { task } = await res.json();
        setSignedInTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        return true;
      } catch {
        setSignedInTasks((prev) => prev.filter((t) => t.id !== id));
        setActionError("Couldn't start activity — try again.");
        return false;
      } finally {
        setSubmitting(false);
        creationRequests.current.delete(id);
      }
    })();
    creationRequests.current.set(id, creation);
  };

  const renameTask = async (task: Task, newName: string) => {
    if (!isSignedIn) {
      saveLocalTasks(renameLocalTask(guestTasks, task.id, newName));
      return;
    }

    setSignedInTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, name: newName } : t)));
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
  };

  const toggleTask = async (task: Task) => {
    if (!isSignedIn) {
      const next = task.is_running
        ? stopLocalTask(guestTasks, task.id)
        : startLocalTask(guestTasks, task.id, multitask);
      saveLocalTasks(next);
      return;
    }

    const now = Date.now();
    const clientNow = new Date(now).toISOString();
    const action = task.is_running ? "stop" : "start";
    const snapshot = signedInTasks;

    // Optimistic: reflect the click instantly instead of waiting on the
    // round trip, so the displayed time matches what the user actually saw.
    setSignedInTasks((prev) =>
      prev.map((t) => {
        if (t.id === task.id) {
          return task.is_running
            ? {
                ...t,
                is_running: false,
                started_at: null,
                total_seconds:
                  t.total_seconds + Math.floor((now - new Date(t.started_at ?? now).getTime()) / 1000),
              }
            : { ...t, is_running: true, started_at: clientNow };
        }
        if (!multitask && action === "start" && t.is_running) {
          return { ...t, is_running: false, started_at: null };
        }
        return t;
      }),
    );
    setPending(task.id, action);

    try {
      // If this task's create request is still in flight, its row may not
      // exist yet — wait for it to land first. In practice this resolves
      // immediately, since a human click always trails the create request
      // that put the row on screen.
      const stillCreating = creationRequests.current.get(task.id);
      if (stillCreating && !(await stillCreating)) return;

      const res = await fetch(`/api/tasks/${task.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientNow }),
      });
      if (res.ok) {
        const { task: updated } = await res.json();
        setSignedInTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        setSignedInTasks(snapshot);
        setActionError("Couldn't update activity — try again.");
      }
    } catch {
      setSignedInTasks(snapshot);
      setActionError("Couldn't update activity — try again.");
    } finally {
      clearPending(task.id);
    }
  };

  const setMode = async (nextMultitask: boolean) => {
    // Focus mode only allows one running activity: switching back to it
    // stops all but the most recently started one, preserving their time.
    if (!nextMultitask && runningTasks.length > 1) {
      if (!isSignedIn) {
        saveLocalTasks(keepMostRecentRunning(guestTasks));
      } else {
        const mostRecentId = runningTasks.reduce((a, b) =>
          new Date(a.started_at ?? 0) > new Date(b.started_at ?? 0) ? a : b,
        ).id;
        const toStop = runningTasks.filter((t) => t.id !== mostRecentId);
        const clientNow = new Date().toISOString();

        const results = await Promise.all(
          toStop.map((t) =>
            fetch(`/api/tasks/${t.id}/stop`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientNow }),
            }).then((r) => (r.ok ? r.json() : null)),
          ),
        );
        setSignedInTasks((prev) =>
          prev.map((t) => {
            const stopped = results.find((r) => r?.task?.id === t.id);
            return stopped ? stopped.task : t;
          }),
        );
      }
    }

    if (!isSignedIn) {
      setLocalMode(nextMultitask);
      return;
    }
    setSignedInMultitask(nextMultitask);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { multitask: nextMultitask } });
  };

  const deleteTask = async (task: Task) => {
    if (!isSignedIn) {
      saveLocalTasks(deleteLocalTask(guestTasks, task.id));
      return;
    }

    const snapshot = signedInTasks;
    setSignedInTasks((prev) => prev.filter((t) => t.id !== task.id));
    setPending(task.id, "delete");
    try {
      // See toggleTask: wait for this task's create request to land first
      // if it's still in flight, so a delete can't reach the server before
      // the row it's deleting exists.
      const stillCreating = creationRequests.current.get(task.id);
      if (stillCreating && !(await stillCreating)) return;

      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        setSignedInTasks(snapshot);
        setActionError("Couldn't delete activity — try again.");
      }
    } catch {
      setSignedInTasks(snapshot);
      setActionError("Couldn't delete activity — try again.");
    } finally {
      clearPending(task.id);
    }
  };

  const clearAll = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);

    if (!isSignedIn) {
      clearLocalTasks();
      return;
    }

    const res = await fetch("/api/tasks", { method: "DELETE" });
    if (res.ok) setSignedInTasks([]);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim() || feedbackStatus === "sending") return;

    setFeedbackStatus("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: feedbackType, message: feedbackMessage.trim() }),
    });

    if (res.ok) {
      setFeedbackStatus("sent");
      setFeedbackMessage("");
    } else {
      setFeedbackStatus("error");
    }
  };

  const signInWithGoogle = async () => {
    setSignInError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setSignInError(error.message);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <Image src="/logo.svg" alt="" width={32} height={32} />
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">
          Quick Time Tracker
        </h1>
        <div
          className="relative ml-auto flex items-center rounded-full bg-panel-hi p-1"
          role="group"
          aria-label="Tracking mode"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-20 rounded-full bg-panel shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
              multitask ? "translate-x-20" : "translate-x-0"
            }`}
          />
          <button
            onClick={() => setMode(false)}
            aria-pressed={!multitask}
            title="Starting an activity stops whatever else was running"
            className={`relative z-10 w-20 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors duration-200 ${
              !multitask ? "text-ink" : "text-mist hover:text-ink"
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => setMode(true)}
            aria-pressed={multitask}
            title="Multiple activities can run at the same time"
            className={`relative z-10 w-20 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors duration-200 ${
              multitask ? "text-ink" : "text-mist hover:text-ink"
            }`}
          >
            Multitask
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6">
        {actionError && <p className="font-sans text-xs text-danger">{actionError}</p>}
        {runningTasks.length === 0 ? (
          <TaskHero task={null} onStop={toggleTask} onRename={renameTask} pending={false} />
        ) : (
          <div className="flex flex-col gap-3">
            {runningTasks.map((task) => (
              <TaskHero
                key={task.id}
                task={task}
                index={task.seq || 0}
                onStop={toggleTask}
                onRename={renameTask}
                pending={pendingActions[task.id] === "stop"}
              />
            ))}
          </div>
        )}

        {(multitask || runningTasks.length === 0) && (
          <form onSubmit={runTask} className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              aria-label="Run"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-signal to-signal-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_24px_-8px_rgba(129,114,242,0.65)] transition-all duration-150 hover:brightness-110 active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_8px_-2px_rgba(129,114,242,0.5)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {submitting ? (
                <Spinner size={18} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <polygon points="2,1 13,7 2,13" />
                </svg>
              )}
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this activity… (optional)"
              className="min-w-0 flex-1 border-b border-panel-hi bg-transparent px-1 py-2 font-sans text-sm text-mist outline-none focus-visible:border-signal focus-visible:text-ink"
            />
          </form>
        )}

        {idleTasks.length === 0 && runningTasks.length === 0 ? (
          <p className="font-sans text-sm text-mist">
            Nothing tracked yet. Press the button above to start your first activity.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.length > 0 && (
              <button
                onClick={clearAll}
                className={`self-end font-sans text-xs underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                  confirmingClear ? "font-medium text-danger" : "text-mist hover:text-ink"
                }`}
              >
                {confirmingClear ? "Click again to clear all activities" : "Clear all"}
              </button>
            )}
            <ul className="flex flex-col gap-2">
              {idleTasks.map((task) => {
                const rowAction = pendingActions[task.id];
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={task.seq || 0}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onRename={renameTask}
                    pendingAction={rowAction === "start" || rowAction === "delete" ? rowAction : null}
                  />
                );
              })}
            </ul>
          </div>
        )}
      </main>

      <footer className="mt-16 flex flex-col gap-4 border-t border-panel-hi pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2 font-sans text-xs text-mist sm:flex-1">
            {isSignedIn ? (
              <>
                <span>{userEmail}</span>
                <button
                  onClick={signOut}
                  className="self-start text-mist underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Guest — activities reset if you clear browser data or switch devices</span>
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-1 font-medium text-signal underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  <svg width="12" height="12" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
                    />
                  </svg>
                  Sign in with Google
                </button>
                {signInError && <span className="text-danger">{signInError}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 font-sans text-xs text-mist sm:flex-1 sm:items-end">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                onClick={() => setFeedbackOpen(true)}
                className="underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Feedback
              </button>
              <span aria-hidden="true">|</span>
              <a
                href="https://github.com/andieng"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z" />
                </svg>
                Thuy Nguyen
              </a>
            </div>
            <span>© {new Date().getFullYear()} Quick Time Tracker</span>
          </div>
        </div>

      </footer>

      <FeedbackModal
        open={feedbackOpen}
        type={feedbackType}
        message={feedbackMessage}
        status={feedbackStatus}
        onTypeChange={setFeedbackType}
        onMessageChange={setFeedbackMessage}
        onSubmit={submitFeedback}
        onClose={() => {
          setFeedbackOpen(false);
          setFeedbackStatus("idle");
        }}
      />
    </div>
  );
}
