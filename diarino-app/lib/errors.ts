// ↔ AUDIT FIX: AdminManagement.tsx / AdminUsers.tsx previously showed
// `err?.message` straight from Supabase/Postgres in an Alert — which can
// include raw column/constraint/RLS-policy names. Every other error path
// in the app already logs the real detail via console.warn and shows a
// fixed, safe Arabic message to the user; this centralizes that pattern
// so it can't regress. `logAndGetSafeMessage` takes the *fallback* text
// the caller wants shown (e.g. "تعذر منح الصلاحية") and always returns
// that, while writing the real `unknown` error to the console for
// debugging.

export function logAndGetSafeMessage(context: string, err: unknown, fallbackMessage: string): string {
  console.warn(`${context}:`, err);
  return fallbackMessage;
}
