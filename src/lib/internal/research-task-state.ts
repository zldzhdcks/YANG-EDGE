/**
 * Research Lab Task State — localStorage persistence.
 *
 * Stores user task statuses (TODO/IN_PROGRESS/ACKNOWLEDGED/DEFERRED/COMPLETED)
 * separately from system-computed statuses (OPEN/RESOLVED/STALE/UNKNOWN).
 * Browser-only. No server sync. No auth.
 */

const STORAGE_KEY = "yang-edge:research-lab-task-state:v1";
const SCHEMA_VERSION = 1;
const MAX_NOTE_LENGTH = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "ACKNOWLEDGED"
  | "DEFERRED"
  | "COMPLETED";

export type SystemStatus = "OPEN" | "RESOLVED" | "STALE" | "UNKNOWN";

export type TaskStateEntry = {
  taskKey: string;
  taskType: string;
  targetDate: string;
  relatedEntityId: string;
  userStatus: UserStatus;
  acknowledgedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  deferredAt: string | null;
  note: string;
  lastSeenAt: string;
};

type StorageRoot = {
  schemaVersion: number;
  entries: Record<string, TaskStateEntry>;
};

// ---------------------------------------------------------------------------
// Task key generation
// ---------------------------------------------------------------------------

export function buildTaskKey(
  targetDate: string,
  taskType: string,
  relatedEntityId: string,
): string {
  return `${targetDate}:${taskType}:${relatedEntityId}`;
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

function readStorage(): StorageRoot {
  if (typeof window === "undefined") {
    return { schemaVersion: SCHEMA_VERSION, entries: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, entries: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("schemaVersion" in parsed) ||
      !("entries" in parsed)
    ) {
      return { schemaVersion: SCHEMA_VERSION, entries: {} };
    }
    const root = parsed as StorageRoot;
    if (root.schemaVersion !== SCHEMA_VERSION) {
      // Future: migration. For now safe fallback.
      return { schemaVersion: SCHEMA_VERSION, entries: {} };
    }
    return root;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, entries: {} };
  }
}

function writeStorage(root: StorageRoot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch {
    // Storage full or blocked — silently fail
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTaskState(taskKey: string): TaskStateEntry | null {
  const root = readStorage();
  return root.entries[taskKey] ?? null;
}

export function getAllTaskStatesForDate(
  targetDate: string,
): Record<string, TaskStateEntry> {
  const root = readStorage();
  const result: Record<string, TaskStateEntry> = {};
  for (const [key, entry] of Object.entries(root.entries)) {
    if (entry.targetDate === targetDate) {
      result[key] = entry;
    }
  }
  return result;
}

export function setTaskUserStatus(
  taskKey: string,
  taskType: string,
  targetDate: string,
  relatedEntityId: string,
  userStatus: UserStatus,
): TaskStateEntry {
  const root = readStorage();
  const now = new Date().toISOString();
  const existing = root.entries[taskKey];

  const entry: TaskStateEntry = {
    taskKey,
    taskType,
    targetDate,
    relatedEntityId,
    userStatus,
    acknowledgedAt:
      userStatus === "ACKNOWLEDGED" && !existing?.acknowledgedAt
        ? now
        : existing?.acknowledgedAt ?? null,
    startedAt:
      userStatus === "IN_PROGRESS" && !existing?.startedAt
        ? now
        : existing?.startedAt ?? null,
    completedAt:
      userStatus === "COMPLETED" && !existing?.completedAt
        ? now
        : existing?.completedAt ?? null,
    deferredAt:
      userStatus === "DEFERRED" && !existing?.deferredAt
        ? now
        : existing?.deferredAt ?? null,
    note: existing?.note ?? "",
    lastSeenAt: now,
  };

  root.entries[taskKey] = entry;
  writeStorage(root);
  return entry;
}

export function setTaskNote(taskKey: string, note: string): void {
  const root = readStorage();
  const entry = root.entries[taskKey];
  if (!entry) return;
  entry.note = note.slice(0, MAX_NOTE_LENGTH);
  entry.lastSeenAt = new Date().toISOString();
  writeStorage(root);
}

export function resetTaskState(taskKey: string): void {
  const root = readStorage();
  delete root.entries[taskKey];
  writeStorage(root);
}

export function resetAllTasksForDate(targetDate: string): void {
  const root = readStorage();
  for (const key of Object.keys(root.entries)) {
    if (root.entries[key].targetDate === targetDate) {
      delete root.entries[key];
    }
  }
  writeStorage(root);
}

export function isStorageCorrupted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    JSON.parse(raw);
    return false;
  } catch {
    return true;
  }
}
