import { useSyncExternalStore } from "react";

// ↔ the "قارن" basket — a person picks up to 4 properties while browsing
// the feed/search, then opens app/compare.tsx to see them side by side.
// Deliberately NOT persisted to Supabase: this is a short-lived, one-session
// tool (nobody expects "properties I was comparing" to survive a relaunch
// the way favorites do), so a plain module-level store is enough — same
// useSyncExternalStore + module-level-state shape already used for the
// admin dashboard in useAdminDB.ts, reused here for a much smaller case.

const MAX_COMPARE = 4;

let selected: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() {
  return selected;
}

function toggle(propertyId: string): "added" | "removed" | "full" {
  if (selected.includes(propertyId)) {
    selected = selected.filter((id) => id !== propertyId);
    emit();
    return "removed";
  }
  if (selected.length >= MAX_COMPARE) return "full";
  selected = [...selected, propertyId];
  emit();
  return "added";
}

function clear() {
  selected = [];
  emit();
}

// ↔ called from signOut() directly (not through the hook) — see
// lib/queryClient.ts's header comment: this is another module-level
// store that otherwise survives a sign-out untouched. Low-severity on
// its own (property ids are public data anyway, see the properties RLS
// policy), but there's no reason to hand the next person on this device
// someone else's half-built compare list either.
export const clearCompareSelection = clear;

export function useCompareSelection() {
  const ids = useSyncExternalStore(subscribe, getSnapshot);
  return { ids, count: ids.length, max: MAX_COMPARE, isSelected: (id: string) => ids.includes(id), toggle, clear };
}
