// lib/queryClient.ts
//
// A single, module-level QueryClient instance, imported both by
// app/_layout.tsx (to hand to <QueryClientProvider>) and by
// lib/hooks/useAuth.ts's signOut() (to call .clear() on it directly).
// signOut() is a plain async function, not a component or a hook, so it
// has no way to reach useQueryClient() — it needs the same instance
// available as a plain import instead.
//
// ↔ React Query / data-security audit finding: nothing previously reset
// the query cache on sign-out. Every user-scoped query does key by
// user.id (useLikes, useFavorites, useNotifications, useChatsDB, etc. —
// see that audit's hook-by-hook table), so a *different* signed-in user
// on the same device would get their own correctly-keyed queries, not
// literally see the previous user's data under the same key. But admin
// dashboard data (useAdminDB.ts) and any query still sitting in the
// in-memory cache from the just-signed-out session stay resident in
// memory regardless — clearing on sign-out is the simple, correct fix:
// there's no legitimate reason to keep ANY cached query around across a
// sign-out, and the next screens simply refetch whatever they need under
// the new session's RLS.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
