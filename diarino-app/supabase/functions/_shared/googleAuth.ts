// @ts-nocheck
// supabase/functions/_shared/googleAuth.ts
//
// Shared by youtube-oauth-connect (initial exchange) and every
// youtube-* function that needs to call the YouTube Data API on a
// host's behalf (create/end broadcast). Access tokens from Google
// expire after ~1 hour; this always returns a token with at least 60s
// of life left, refreshing via the stored refresh_token when needed.
//
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET must be set as Supabase Edge
// Function secrets (`supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`)
// — these come from the OAuth 2.0 Client ID created in Google Cloud
// Console for this project (see docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md).
// They are never sent to the client.

export class YouTubeNotConnectedError extends Error {
  constructor() {
    super("youtube_not_connected");
    this.name = "YouTubeNotConnectedError";
  }
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export async function exchangeAuthCodeForTokens(
  authCode: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Server misconfiguration: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[googleAuth] authorization_code exchange failed:", data);
    throw new Error(data?.error_description || data?.error || "Failed to exchange Google auth code");
  }
  return data;
}

// Returns a fresh access_token for this user, refreshing it against
// Google and persisting the new value if the cached one has expired
// (or is close to it). Throws YouTubeNotConnectedError if the user has
// never connected a YouTube account.
export async function getFreshYouTubeAccessToken(
  serviceClient: any,
  userId: string
): Promise<{ accessToken: string; channelId: string | null }> {
  const { data: row, error } = await serviceClient
    .from("youtube_oauth_tokens")
    .select("access_token, refresh_token, access_token_expires_at, youtube_channel_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!row) throw new YouTubeNotConnectedError();

  const expiresAt = new Date(row.access_token_expires_at).getTime();
  if (expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return { accessToken: row.access_token, channelId: row.youtube_channel_id ?? null };
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Server misconfiguration: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[googleAuth] refresh_token exchange failed:", data);
    // A revoked/expired refresh_token surfaces here (e.g. user revoked
    // app access from their Google Account settings) — treat the same
    // as "never connected" so the client re-prompts the connect flow.
    throw new YouTubeNotConnectedError();
  }

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await serviceClient
    .from("youtube_oauth_tokens")
    .update({ access_token: data.access_token, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { accessToken: data.access_token, channelId: row.youtube_channel_id ?? null };
}
