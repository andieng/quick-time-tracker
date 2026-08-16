import type { Task } from "@/lib/types";

const STORAGE_KEY = "quick-time-tracker:guest-tasks";
export const EMPTY_TASKS: Task[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyLocalTasksChanged() {
  listeners.forEach((listener) => listener());
}

// For useSyncExternalStore: re-render subscribers when another tab changes
// guest tasks (the native "storage" event) or this tab does (our own calls
// notify directly, since "storage" only fires in *other* tabs).
export function subscribeLocalTasks(listener: Listener) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    listeners.delete(listener);
  };
}

// useSyncExternalStore requires getSnapshot to return a stable reference
// when the underlying data hasn't changed, or it loops. JSON.parse always
// allocates a new array, so the parsed result is cached against the raw
// string and only re-parsed when localStorage actually changed.
let cachedRaw: string | null = null;
let cachedTasks: Task[] = EMPTY_TASKS;

export function getLocalTasks(): Task[] {
  if (typeof window === "undefined") return EMPTY_TASKS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedTasks;
    cachedRaw = raw;
    cachedTasks = raw ? (JSON.parse(raw) as Task[]) : EMPTY_TASKS;
    return cachedTasks;
  } catch {
    return EMPTY_TASKS;
  }
}

export function saveLocalTasks(tasks: Task[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    notifyLocalTasksChanged();
    return true;
  } catch {
    // Quota exceeded or storage unavailable (e.g. private browsing) — the
    // in-memory state still reflects the change, it just won't persist.
    return false;
  }
}

export function clearLocalTasks(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  notifyLocalTasksChanged();
}

export function createLocalTask(name: string, existingTasks: Task[]): Task {
  // Guard against pre-existing localStorage data from before "seq" existed.
  const nextSeq = existingTasks.reduce((max, t) => Math.max(max, t.seq || 0), 0) + 1;
  return {
    id: crypto.randomUUID(),
    user_id: "guest",
    seq: nextSeq,
    name,
    created_at: new Date().toISOString(),
    is_running: false,
    started_at: null,
    total_seconds: 0,
  };
}

// Backfills seq for guest tasks created before this field existed, in their
// original creation order — the localStorage equivalent of the one-time
// Supabase migration that does the same for signed-in accounts.
export function backfillMissingSeq(tasks: Task[]): Task[] {
  const missing = tasks.filter((t) => !t.seq);
  if (missing.length === 0) return tasks;

  let nextSeq = tasks.reduce((max, t) => Math.max(max, t.seq || 0), 0);
  const sorted = [...missing].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const assigned = new Map(sorted.map((t) => [t.id, ++nextSeq]));

  return tasks.map((t) => (assigned.has(t.id) ? { ...t, seq: assigned.get(t.id)! } : t));
}

function foldElapsed(task: Task): Task {
  if (!task.is_running || !task.started_at) return task;
  const elapsed = Math.floor((Date.now() - new Date(task.started_at).getTime()) / 1000);
  return { ...task, is_running: false, started_at: null, total_seconds: task.total_seconds + elapsed };
}

export function startLocalTask(tasks: Task[], id: string, multitask = false): Task[] {
  return tasks.map((task) => {
    if (task.id === id) {
      return { ...task, is_running: true, started_at: new Date().toISOString() };
    }
    // In focus mode only one task can run at a time; multitask mode leaves
    // other running tasks untouched.
    return !multitask && task.is_running ? foldElapsed(task) : task;
  });
}

export function stopLocalTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? foldElapsed(task) : task));
}

// Used when switching from multitask back to focus mode: focus mode only
// allows one running activity, so all but the most recently started one get
// stopped (elapsed time preserved, not discarded).
export function keepMostRecentRunning(tasks: Task[]): Task[] {
  const running = tasks.filter((t) => t.is_running);
  if (running.length <= 1) return tasks;

  const mostRecentId = running.reduce((a, b) =>
    new Date(a.started_at ?? 0) > new Date(b.started_at ?? 0) ? a : b,
  ).id;

  return tasks.map((task) =>
    task.is_running && task.id !== mostRecentId ? foldElapsed(task) : task,
  );
}

export function deleteLocalTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

export function renameLocalTask(tasks: Task[], id: string, name: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, name } : task));
}

export function autoTaskName(): string {
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Activity ${time}`;
}

const MODE_KEY = "quick-time-tracker:multitask";
const modeListeners = new Set<Listener>();

function notifyLocalModeChanged() {
  modeListeners.forEach((listener) => listener());
}

export function subscribeLocalMode(listener: Listener) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  modeListeners.add(listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    modeListeners.delete(listener);
  };
}

export function getLocalMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MODE_KEY) === "1";
}

export function setLocalMode(multitask: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, multitask ? "1" : "0");
  notifyLocalModeChanged();
}
