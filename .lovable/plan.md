## Plan

### 1. Distinct bottom bar color
In `src/components/mobile-action-bar.tsx`, force the bar surface to always contrast with the mint "Active Vehicle" card:
- Switch container to `bg-stone-900 text-stone-50 dark:bg-stone-50 dark:text-stone-900` (inverted neutral) with a subtle ring, so it's never the same hue as any vehicle card regardless of accent.
- Keep "Log fuel" as the mint accent pill (now sits on dark surface → high contrast).
- Secondary buttons use translucent same-tone-as-bar (`bg-white/10` / `bg-black/10`) instead of `foreground/5`.

### 2. Reports visible on mobile
Currently Reports is only reachable from a top-bar shortcut on `app.index.tsx` which is hidden/cramped on mobile.
- Add a "Reports" entry to the mobile surface. Two options — I'll go with **(a)** since the bar already holds primary actions:
  - (a) Add a compact "Reports" link in the dashboard's mobile header row (visible `md:hidden`), next to Settings/Analytics icons, so it's one tap away.
  - Also add it to `/app/garage` header for parity.
- No change to the bottom bar (keeps the 3-button design the user approved).

### 3. Non-annoying install prompt
New `src/components/install-prompt.tsx`:
- Listens for `beforeinstallprompt` (Chrome/Edge/Android) and detects iOS Safari separately.
- Shows a small dismissible glass toast above the bottom bar **only when**:
  - Not running standalone (`display-mode: standalone` / `navigator.standalone`).
  - Not on a Lovable preview host.
  - User has visited at least 2 sessions (tracked via `odolog.visitCount`).
  - Not dismissed in the last 14 days (`odolog.installPromptDismissedAt`).
- "Install" button calls the saved `prompt()` event; iOS shows a one-liner with the share→Add to Home Screen hint.
- "Not now" sets the 14-day snooze. After 3 dismissals, never show again.
- Mount once in `src/routes/__root.tsx` so it appears app-wide without per-page wiring.

### Files
- edit `src/components/mobile-action-bar.tsx` — bar surface + secondary buttons
- edit `src/routes/app.index.tsx` — mobile header Reports link
- edit `src/routes/app.garage.tsx` — mobile header Reports link
- create `src/components/install-prompt.tsx`
- edit `src/routes/__root.tsx` — mount InstallPrompt

No backend or business-logic changes.
