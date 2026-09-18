# Diarino (ديارينو) — React Native / Expo

Migrated from the original vanilla-JS single-page app (`app-viewer.html`) to
Expo Router + TypeScript + Supabase + YouTube Live (previously LiveKit —
see `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` for that migration).

## 1. Install

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL/anon key + Google web OAuth client id
```

This project uses native modules (Google Sign-In, the RTMP encoder,
react-native-maps, camera) that **do not work in Expo Go**. You must build
a Dev Client:

```bash
npx expo install expo-video   # picture-in-picture reel playback (new)
npx expo prebuild
npx expo run:android   # or: npx expo run:ios
```

## 2. Supabase setup

### Two separate projects

- **dev/preview** — `nlvrmmwujnwifwedhagy` (used by the `development` and
  `preview` profiles in `eas.json`)
- **production** — `nwbtzchtwyhqktoerbap` ("diarino production", used by the
  `production` profile)

Both need every migration in `supabase/migrations/` applied and every Edge
Function deployed — they're two independent databases, so a migration run
against one never reaches the other. The commands below target whichever
project you're currently linked to (`supabase link`), so run this whole
section twice: once per project.

Run every migration in `supabase/migrations/` in order (they're timestamped,
so `supabase db push` applies them correctly as long as none are skipped):

```bash
supabase db push
```

Then deploy the Edge Functions:

```bash
supabase functions deploy youtube-oauth-connect
supabase functions deploy youtube-create-broadcast
supabase functions deploy youtube-end-broadcast
supabase functions deploy youtube-process-queue --no-verify-jwt
supabase functions deploy send-push --no-verify-jwt
```
`youtube-process-queue` also needs to be put on a schedule (it does not
trigger itself) — see `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` §3.1.

### Required manual step: push notifications webhook

`send-push` needs a Database Webhook to actually fire (functions aren't
called automatically just by being deployed), **and** a shared secret so
that webhook is the only thing that can call it (RLS audit fix — the
function has no other way to verify a request is legitimate, since it
has to run with `--no-verify-jwt`).

1. `supabase secrets set PUSH_WEBHOOK_SECRET=<a long random string>`
2. Supabase Dashboard → Database → Webhooks → create one: table
   `notifications`, event `Insert`, type `Supabase Edge Function`,
   function `send-push`, then under **HTTP Headers** add
   `x-webhook-secret` = the same value from step 1.

See `supabase/functions/send-push/index.ts`'s header comment for the
full explanation.

### Required manual step: Cloudinary upload preset

Media (property videos/photos, avatars, chat images, live posters) uploads
directly from the device to Cloudinary (`lib/cloudinary.ts`), not Supabase
Storage. In the Cloudinary dashboard, the upload preset named in that file
(`Diarino_uploads`) must be set to **Unsigned** — that's what lets the app
upload without ever holding an API secret client-side. The three storage
buckets below are what older uploads (from before this switch) still point
at; new uploads no longer use them.

### Required secrets (`supabase secrets set KEY=value`)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-provided by Supabase to every deployed Edge Function for whichever
project it's deployed to — **don't** `secrets set` these three, they're
already there. Only the custom ones below need setting manually:

| Secret | Used by |
|---|---|
| `GOOGLE_CLIENT_ID` | youtube-oauth-connect, youtube-create-broadcast, youtube-end-broadcast, youtube-process-queue |
| `GOOGLE_CLIENT_SECRET` | same four |
| `YOUTUBE_QUEUE_CRON_SECRET` | youtube-process-queue only — a shared secret so this scheduled/service function (no user JWT) can't be triggered by an arbitrary caller |

Both come from the OAuth 2.0 "Web application" Client created in Google
Cloud Console — see `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` for the full
Cloud Console setup (enabling the YouTube Data API v3, the OAuth consent
screen and its `youtube.force-ssl` scope verification, per-platform
client ids for native Google Sign-In, and each host's YouTube channel
needing Live Streaming enabled). There is no more `RECORDING_S3_*` —
YouTube hosts every broadcast's VOD itself, so this app never stores
video files anywhere.

### Required manual step: YouTube/Google OAuth setup

Unlike LiveKit (a single server-side URL+keypair), YouTube Live auth is
per-host and needs real Google Cloud Console setup + Google's own review
for the `youtube.force-ssl` scope. This is **not** a `supabase secrets
set` one-liner — see `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` end to end
before testing a real broadcast.

### Required manual step: OAuth redirect

In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add:
```
diarino://auth-callback
```

### Required manual step: enabling guest mode ("المتابعة كضيف")

Every table's RLS `select` policy is scoped `to authenticated` — a "guest"
still needs a real Supabase session for reads to work at all, otherwise
RLS silently returns zero rows and the app looks empty. Guest mode uses
Supabase's **anonymous sign-ins** to give guests a real (anonymous)
session instead. Turn it on in Supabase Dashboard → Authentication →
Sign In / Providers → Anonymous Sign-Ins. Without this enabled,
`supabase.auth.signInAnonymously()` (called from `handleSkip()` in
`app/index.tsx`) returns an error and "المتابعة كضيف" won't work.

### Required manual step: granting yourself admin access

There is no in-app way to become an admin (by design — see the RLS policy
comment in `20260721000000_create_user_roles_table.sql`). After signing up
once, insert a row manually via the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role) values ('<your-user-uuid>', 'admin');
```

### Android Maps API key

`app.json`'s `android.config.googleMaps.apiKey` has a placeholder —
replace it with a real Google Maps API key **before** building for Android
(`eas build`), or the map in the geo-search screen won't render, and fixing
it after a build ships means bumping `versionCode` and rebuilding, not just
re-uploading.

Only **Maps SDK for Android** needs to be enabled in Google Cloud — the app
has no Places/Directions/Geocoding API calls (address-to-coordinates lookup
in `app/publish/create-listing.tsx` uses `expo-location`'s on-device
geocoder, no Google API or key involved). iOS needs no key at all — the map
components never set `PROVIDER_GOOGLE`, so iOS uses Apple Maps by default.

When restricting the key by SHA-1 fingerprint, you need **two** fingerprints,
not one: the EAS build/upload key (`eas credentials` → Android → production →
Keystore) available before any release, and — only after the first upload —
the actual Play App Signing certificate (Play Console → Release → Setup →
App integrity → App signing key certificate), which is what real users'
installs are signed with and is usually different from the upload key. Add
both to the same Maps API key's Android restriction. Full walkthrough,
including exact commands and the correct app.json-before-eas-build order:
`docs/deployment-guide.md` section ٠.

## 3. Storage buckets

Three buckets are created by migrations (`chat-images`, `property-media`,
`avatars`), all public-read with folder-based ownership RLS
(`<uploader_user_id>/...`). A fourth, `live-recordings`, must be created
**manually** in the dashboard (see the S3 Connection step above) since
Egress writes to it via the S3-compatible API, not through a migration.

## 4. What's real vs. what's still local-only

Everything reads/writes real Supabase tables now: properties, requests,
chats/messages (with Realtime), favorites, profiles, live rooms +
recordings, follows, in-app notifications (DB-triggered, Realtime), the
full admin dashboard (reels/lives/reports/users/features/analytics — all
live queries, no mock dataset or AsyncStorage left), and the Cloudinary
media ledger. Nothing is local-device-only anymore.

**Dark mode is fully implemented across the entire app** — every screen
in `app/` and every component in `components/` supports light, dark, and
"follow system" modes via `lib/hooks/useThemeColors.ts`, wired into
`Appearance.setColorScheme()` so native chrome (React Navigation, iOS
`Alert`) picks it up too. This followed the **Media Theming Rule**: any
video/camera surface and its direct overlays (reel action icons, the
info block's gradient+text, live-stream controls, comment/heart overlays)
stay fixed white-on-dark for guaranteed legibility over unpredictable
media content — everything else (bottom tab bar, sheets, modals, forms,
lists) follows the theme. Two deliberate, documented exceptions:
`components/menu/AdBannerCarousel.tsx` (fixed dark banner, same media
rule) and `components/shared/ErrorBoundary.tsx` (a class component by
necessity — React Error Boundaries can't use hooks — kept
dependency-free so it renders even if the theme system itself crashed).
Full rollout history and the exact rule text are in
`docs/deferred-tasks.md`.

## 5. Push notifications setup

In-app notifications (the bell) were already real; this adds the
OS-level push on top, for when the app is backgrounded or closed.

1. `supabase functions deploy send-push --no-verify-jwt`
2. `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=...`
3. `supabase secrets set PUSH_WEBHOOK_SECRET=<a long random string>`
4. Supabase Dashboard → Database → Webhooks → create one:
   Table `notifications`, event `Insert`, type `Supabase Edge Function`,
   function `send-push`, then under **HTTP Headers** add
   `x-webhook-secret` = the same value from step 3. The dashboard wires
   the Authorization header itself — the `x-webhook-secret` one is the
   part you add by hand (RLS audit fix — proves the request actually
   came from this webhook, not just anyone who found the function's URL).

Full detail in `supabase/functions/send-push/index.ts`'s header comment.
The client side (`lib/hooks/usePushNotifications.ts`) registers each
signed-in device's Expo push token automatically — no extra setup there
beyond running the `20260819000000_push_tokens.sql` migration and
building a Dev Client (push tokens don't work in Expo Go either).

## 6. Known deferred items

- Full RTL layout mirroring on language toggle reloads the app
  automatically via `expo-updates` in a Dev Client / production build.
  Plain Expo Go / a dev build with no OTA channel configured can't
  reload programmatically (an Expo/React Native platform constraint, not
  something this app can work around) — `lib/hooks/useLanguage.ts` falls
  back to asking the person to restart manually only in that case.
- Ad edit/pin has a 24h window (`canEditAd`); there's no UI for extending it.
- No automated tests.
- **Reel Picture-in-Picture**: implemented for real — the reel video
  engine was migrated from `expo-av` to `expo-video`
  (`components/reel/ReelVideoPlayer.tsx`), with `allowsPictureInPicture`
  wired to the user's opt-in preference (`lib/hooks/usePiPPreference.ts`)
  and the official `expo-video` config plugin added to `app.json`. This
  requires a Dev Client build (`npx expo run:android` /
  `npx expo run:ios`) — it will not work in Expo Go, and needs real
  device testing on both platforms before shipping (not something that
  could be verified without physical devices). `expo-av` is still used
  elsewhere in the app (background music, admin reel preview, live
  replay, mic permissions) — see `docs/deferred-tasks.md` §2 for the
  full list and a known coexistence caveat to watch for.
- **Reel captions**: UI, preference storage, and `captions_ar`/`captions_en`
  DB columns exist and render real data when present, but there's no
  speech-to-text/translation pipeline populating them yet. See
  `docs/deferred-tasks.md` §3 for a concrete Whisper + Translation API
  integration guide.

## 7. Deliberate security decisions

- **`profiles.phone`/`bio`/full-row reads are now real RLS, not just
  UI-gated** (as of `20260825000000_profile_privacy_rls.sql`). The
  `profiles are readable by authenticated users` (`using (true)`) policy
  this section used to describe is gone — replaced with: self, or
  `is_public = true`, or an existing chat partner, or staff
  (`public.is_admin()`). Everything that only ever needed a display
  name/avatar for general browsing (property cards, live-host chips,
  notification actors, follower lists) reads the new `profiles_public`
  view instead (`id, full_name, avatar_url, verified, is_public` + the
  four contact-visibility preference booleans — no phone, no bio). The
  view is owned by the migration role, so it reads the underlying table
  with the owner's privileges and is unconditionally visible regardless
  of `is_public` — that's intentional and safe *because* its column list
  hard-excludes anything sensitive, not because of who's asking.
  `app/property/[id].tsx`'s WhatsApp/call buttons are the one place that
  still needs a real phone number; that screen has its own dedicated
  `usePropertyDetail()` query (`lib/hooks/useProperties.ts`) embedding
  the real `profiles` table, so for a private seller with no open chat
  with the viewer, phone/bio correctly come back null and those buttons
  don't render (see `!!property.seller.phone` guard there) instead of
  silently exposing them the way the old `using (true)` policy did.
- **Live comments/likes are relayed server-side, not published directly**
  (as of the YouTube Live migration — see
  `docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md` — superseding the LiveKit-era
  design this bullet used to describe). Chat is a plain Postgres table
  now (`live_messages`, `20260911000000_youtube_live_streaming.sql`)
  delivered to clients via Supabase Realtime `postgres_changes` — there
  is no separate relay step to trust, because the enforcement lives in a
  `BEFORE INSERT` trigger (`enforce_live_message_rules()`) on the same
  statement that delivers the message: it re-checks a per-user-per-room-
  per-second counter in Postgres (`bump_live_message_rate()`, reused
  as-is from the LiveKit era) — 3 comments/sec, 5 likes/sec, same numbers
  as before — validates the room is actually `status = 'live'`, and
  checks the sender isn't chat-blocked (`live_blocked_viewers`). A client
  cannot bypass any of this by calling the table directly with a
  modified app, because the INSERT *is* the only way the message reaches
  anyone — same guarantee the old Edge-Function relay was built to
  provide, just enforced one layer closer to the data. Housekeeping:
  `live_message_rate_buckets` is still pruned hourly via the existing
  `pg_cron` job; `cleanup_old_live_messages()` (new) should be scheduled
  the same way for `live_messages` itself — see the migration guide.
- **Going live is restricted to non-anonymous accounts**
  (`20260825000000_profile_privacy_rls.sql`'s `lives` INSERT policy adds
  `coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false`).
  Supabase anonymous ("guest") sessions can browse, publish listings,
  chat, and watch live broadcasts, but can't start one — broadcasting
  video of yourself is a real moderation/legal liability, and an
  anonymous account isn't traceable the way a Google-authenticated one
  is. `app/(tabs)/menu.tsx`, `app/(tabs)/account.tsx`, and
  `app/live/broadcast.tsx` all show a clear "sign in with Google to go
  live" message client-side before a guest ever reaches a camera/mic
  permission prompt, but the actual, unbypassable enforcement is this
  RLS policy — it's what makes the client-side checks a UX nicety rather
  than the real security boundary. Note this is the one place in the app
  where guest and Google-authenticated sessions are treated differently;
  everywhere else (chat, publishing, browsing) both work identically.
- **Admin audit log coverage** (`admin_audit_log`, triggers across
  `20260810000000_admin_audit_and_permission_enforcement.sql` and
  `20260828000000_admin_audit_coverage_extension.sql`): every admin
  write to properties/lives moderation, ad banners, sponsored reels,
  menu items, feature flags, ad-carousel settings, and
  suggestion/support-message dismissal is logged with who/when/before/
  after — readable at `components/admin/AdminAuditLog.tsx`. Deliberately
  NOT logged: a user's own inserts into `suggestions`/`support_messages`
  (that's normal user activity, tracked instead in
  `user_activity_log`/`useAuditLogs.ts`, not an *admin* action) and reads
  of any admin screen (only writes are audited — read access is already
  fully gated by `admin_has_permission()`, so there's no write to log).

## Project structure

```
app/                     Expo Router routes (file-based)
  _layout.tsx             Root layout — providers, RTL startup
  index.tsx               Auth gate / login screen
  (tabs)/                 Bottom tab group: reels, search, menu, requests, account
  property/[id].tsx       Property details
  seller/[id].tsx         Seller profile
  chat/                   Chat list + conversation
  live/                   Broadcast, viewer, replay
  publish/                Create-listing, create-request forms
  admin/                  Admin dashboard (gated by useIsAdmin)
components/               Organized by feature (reel/, live/, chat implied via app/, account/, admin/, shared/, publish/, search/, requests/, notifications/)
lib/
  hooks/                  All data hooks (React Query-backed where real, useSyncExternalStore for the remaining local stores)
  supabase.ts             Native Supabase client (AsyncStorage session storage)
  youtube.ts              YouTube Live client calls (connect account, create/end broadcast, chat, moderation)
  youtube-platform.{tsx,native.tsx,web.tsx}  Google Sign-In + RTMP camera broadcaster (native) / stream-key panel (web)
  geo.ts                  Haversine distance helper
  types.ts                Property/Seller/MediaItem types
data/                     Static reference data (locations, demo properties, i18n dictionary, mock notifications/chats/admin seed)
supabase/
  migrations/             All SQL, timestamped, apply in order
  functions/               youtube-oauth-connect, youtube-create-broadcast, youtube-end-broadcast, youtube-process-queue, send-push
scripts/
  deploy-commands.sh      Every production deploy command in one copy-paste-ready file, no explanation
  publish-test.mjs         Local smoke-test script for the publish flow
docs/
  YOUTUBE_LIVE_MIGRATION_GUIDE.md  Full LiveKit → YouTube Live migration writeup: setup, manual steps, known limitations
  deployment-guide.md      Full step-by-step production deploy guide (Arabic): prerequisites incl. Google Maps API key, command list, checklist, rollback plan, first-24-hours monitoring
  deferred-tasks.md        Post-launch-deferred and accepted-as-is items from the security review
assets/music/             5 synthesized background-music tracks (WAV)
```

## 8. Deploying to production

Full walkthrough (Arabic) — prerequisites (including the Google Maps API key
setup and the correct `app.json`-before-`eas build` order), the complete
command sequence, a pre/post checklist, a rollback plan, and what to monitor
in the first 24 hours after release — is in `docs/deployment-guide.md`. A
stripped-down, copy-paste-only version of every command is in
`scripts/deploy-commands.sh`.
