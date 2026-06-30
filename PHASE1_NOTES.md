# WEEKLY app — Phase 1 build notes

Scaffolded Expo (managed) + Expo Router + Supabase + EAS app, TypeScript. Logic
layer ported from the web repo (`DUO OC`) — web repo untouched.

## What's here
- **Routing** (`app/`): `(auth)/sign-in`, `(tabs)/{index,explore,drop,inbox,me}`,
  `chat/[id]`, `onboarding`, `settings/{index,edit-profile,blocked,delete-account,
  privacy,terms}`. Feature-screen bodies are placeholders (Phase 1 = skeleton +
  auth + ported logic).
- **Logic** (`src/`): `lib/{supabase,auth,constants,logger,planUtils,session}`,
  `features/{drop,matching,chat,profile,notifications,safety}`, `theme.ts`,
  `types/db.ts`. All typed; `npx tsc --noEmit` passes clean.
- **Auth**: Apple (`expo-apple-authentication` + nonce via `expo-crypto`) and
  Google (`@react-native-google-signin/google-signin`, native) → Supabase
  `signInWithIdToken`. Session persists via AsyncStorage; auth gate in
  `app/_layout.tsx` routes signed-out → sign-in, onboarding-incomplete →
  onboarding, else → tabs.
- **Migration**: `supabase/migrations/20260629000000_profile_seeding_trigger.sql`
  — `auth.users` AFTER INSERT trigger seeding `profiles(id, onboarding_complete)`.

## Scope nuance to know
`features/safety/safety.ts` is ported verbatim per the locked decision
("blocked-users mgmt in v1 — logic from safety.js"). It still contains the
duo-level helpers (`blocks`, `reports`, `duo_sanctions`, `duo_members`) the web
lib carried. The app builds **no** duo UI on top of them; only the user-level
`blockUser` / `reportUser` / `user_blocks` / `user_reports` paths are used in v1.
Left intact to avoid changing behavior; trim later if desired.

## Not in Expo Go
`@react-native-google-signin/google-signin` and `expo-apple-authentication`
require a **development build** (config-plugin prebuild), not Expo Go. Build a
dev client via EAS to test sign-in.

## HUMAN ACTION ITEMS
1. **Confirm bundle IDs** — `com.weekly.app` (iOS) and `com.weekly.app` (Android)
   in `app.json`.
2. **Enable Supabase Apple + Google providers** (dashboard, same project as web):
   - Apple: add the service config per Supabase Apple docs.
   - Google: paste the **Web client ID** as the authorized client.
3. **Run the profile-seeding migration** against the same Supabase project:
   ```bash
   supabase db push
   ```
4. **Apple Developer Team ID** — provide for EAS credentials.
5. **Google OAuth client IDs** (Google Cloud Console):
   - **iOS client ID** (bundle ID required)
   - **Web client ID** (used as `webClientId` — REQUIRED even on iOS)
   - **Android client ID** (SHA-1 from `eas credentials` after first build)
   Then fill `weekly-app/.env` (copy from `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   ```
   And replace `iosUrlScheme` in `app.json`
   (`@react-native-google-signin/google-signin` plugin) with the **reversed iOS
   client ID** (`com.googleusercontent.apps.<IOS_CLIENT_ID>`).
6. **Build a dev client**: `eas build --profile development` (iOS needs a Mac/cloud
   + the Apple Team ID + Sign in with Apple capability — `usesAppleSignIn` is set).
```
