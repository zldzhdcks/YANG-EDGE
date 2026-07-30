"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  type UserStatus,
  type TaskStateEntry,
  getAllTaskStatesForDate,
  setTaskUserStatus,
  setTaskNote,
  resetTaskState,
  resetAllTasksForDate,
  isStorageCorrupted,
} from "@/lib/internal/research-task-state";

const CHANGE_EVENT = "yang-edge:research-task-state-change";

function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

let snapshotCache: { key: string; data: Record<string, TaskStateEntry> } = {
  key: "",
  data: {},
};

function getSnapshot(dateKst: string): () => Record<string, TaskStateEntry> {
  return () => {
    const newData = getAllTaskStatesForDate(dateKst);
    const newKey = JSON.stringify(newData);
    if (newKey !== snapshotCache.key) {
      snapshotCache = { key: newKey, data: newData };
    }
    return snapshotCache.data;
  };
}

const serverSnapshot: Record<string, TaskStateEntry> = {};

export function useResearchTaskState(dateKst: string) {
  const snap = getSnapshot(dateKst);
  const states = useSyncExternalStore(subscribe, snap, () => serverSnapshot);

  const corrupted = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isStorageCorrupted();
  }, []);

  const updateStatus = useCallback(
    (
      taskKey: string,
      taskType: string,
      relatedEntityId: string,
      userStatus: UserStatus,
    ) => {
      setTaskUserStatus(taskKey, taskType, dateKst, relatedEntityId, userStatus);
      emitChange();
    },
    [dateKst],
  );

  const updateNote = useCallback((taskKey: string, note: string) => {
    setTaskNote(taskKey, note);
    emitChange();
  }, []);

  const reset = useCallback((taskKey: string) => {
    resetTaskState(taskKey);
    emitChange();
  }, []);

  const resetAll = useCallback(() => {
    resetAllTasksForDate(dateKst);
    emitChange();
  }, [dateKst]);

  return { states, corrupted, updateStatus, updateNote, reset, resetAll };
}
