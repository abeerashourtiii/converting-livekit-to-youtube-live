import { useEffect, useState } from "react";

// ↔ used by app/(tabs)/search.tsx's text search box — now that filtering
// happens server-side (real pagination), every keystroke would otherwise
// fire its own network request. This delays updating the returned value
// until typing pauses, so a person typing "شقة" fires one request instead
// of four. The input itself stays fully responsive either way — only the
// value fed into the query is delayed, never what's shown on screen.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
