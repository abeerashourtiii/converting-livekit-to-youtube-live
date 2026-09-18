// @ts-nocheck
// supabase/functions/youtube-oauth-connect/index.ts
//
// Called once when a host connects their YouTube account (before their
// first broadcast, or if their refresh_token was ever revoked). The
// client obtains a Google "offline access" authorization code via
// @react-native-google-signin/google-signin (native) or Google Identity
// Services (web) with scope `https://www.googleapis.com/auth/youtube.force-ssl`,
// then hands that one-time code to this function — which is the only
// place that ever talks to Google's token endpoint with the app's
// client secret.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithCors } from "../_shared/cors.ts";
import { exchangeAuthCodeForTokens } from "../_shared/googleAuth.ts";

serveWithCors(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const user = userData.user;

  let body: { authCode?: string; redirectUri?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { authCode, redirectUri } = body;
  if (!authCode) {
    return new Response(JSON.stringify({ error: "authCode is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ↔ Native Google Sign-In's "serverAuthCode" (offline access) uses an
  // empty/"postmessage" redirect_uri, not a real URL — the web
  // (Google Identity Services) code flow needs the exact redirect_uri
  // registered on the OAuth Client. See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md.
  let tokens;
  try {
    tokens = await exchangeAuthCodeForTokens(authCode, redirectUri || "postmessage");
  } catch (err) {
    console.error("[youtube-oauth-connect] token exchange failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to connect YouTube account" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!tokens.refresh_token) {
    // Google only returns a refresh_token the *first* time a given
    // Google account grants this scope to this OAuth client (or after
    // the user revokes and re-grants access) — not on every code
    // exchange. If we don't have one stored yet and didn't get one now,
    // we cannot silently refresh later, so the connect flow must be
    // retried after revoking app access at https://myaccount.google.com/permissions.
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: existing } = await serviceClient
      .from("youtube_oauth_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing?.refresh_token) {
      return new Response(
        JSON.stringify({
          error:
            "no_refresh_token: Google didn't return a refresh token. Revoke Diarino's access at " +
            "https://myaccount.google.com/permissions and try connecting again.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Best-effort: resolve the connected channel id for display purposes.
  let channelId: string | null = null;
  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channelData = await channelRes.json();
    channelId = channelData?.items?.[0]?.id ?? null;
  } catch (err) {
    console.warn("[youtube-oauth-connect] channel lookup failed (non-fatal):", err);
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    access_token: tokens.access_token,
    access_token_expires_at: expiresAt,
    scope: tokens.scope,
    youtube_channel_id: channelId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.refresh_token) upsertPayload.refresh_token = tokens.refresh_token;

  const { error: upsertError } = await serviceClient
    .from("youtube_oauth_tokens")
    .upsert(upsertPayload, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[youtube-oauth-connect] failed to store tokens:", upsertError);
    return new Response(JSON.stringify({ error: "Failed to save YouTube connection" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ connected: true, channelId }), {
    headers: { "Content-Type": "application/json" },
  });
});
