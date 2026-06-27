## Goal

Keep `/api/public/gcal/callback` (required by Google's OAuth redirect) but stop it from rendering as a bare, unstyled black page. Turn it into a small branded status screen that clearly tells the user what happened.

## Why we can't delete it

- Google Calendar OAuth posts the user back to this exact URL with `?code=...&state=...`.
- The handler in `src/routes/api.public.gcal.callback.ts` exchanges the code for tokens and stores them so the "Sync to Google Calendar" feature in Settings works.
- Removing the route breaks calendar connect entirely.

## What changes

Rewrite the HTML responses in `src/routes/api.public.gcal.callback.ts` so every branch renders the same themed shell instead of raw `<h2>` tags on a black page.

Three states to handle:

1. **Direct visit / no params** — friendly "Nothing to do here" card explaining this page is only used during Google Calendar connect, with a button back to Settings.
2. **Success** — green check, "Google Calendar connected", auto-close after 2s (if opened as popup) or "Back to OdoLog settings" link.
3. **Error** (invalid state, token exchange failed, missing user) — red icon, short human message, the raw error in a collapsed `<details>` for debugging, "Try again" link to `/app/settings`.

## Visual shell

- Dark gradient background matching OdoLog's cockpit theme (stone-900 → mint accent), not pure black.
- Centered glass card (max-width ~420px), rounded-3xl, subtle border.
- OdoLog wordmark at top.
- System font stack inline (route returns raw HTML, can't use Tailwind classes — use a small `<style>` block with CSS variables that mirror the app tokens).
- Mobile-safe padding.

## Technical details

```text
src/routes/api.public.gcal.callback.ts
  - extract `renderShell(title, bodyHtml, variant)` helper
  - variant: 'success' | 'error' | 'idle' -> picks accent color + icon
  - replace every `htmlResponse('<h2>...')` call with renderShell(...)
  - success branch: include a tiny <script> that does
      if (window.opener) { window.opener.postMessage({type:'gcal-connected'}, '*'); window.close(); }
    so popup flows close themselves cleanly
  - idle branch (no code & no error): render "This page is part of the Google
    Calendar connect flow. You can close it." with link to /app/settings
```

No DB changes, no other files touched.

## Out of scope

- Changing the OAuth flow itself (state parsing, token exchange) — that was fixed last turn.
- Wiring the popup `postMessage` listener in Settings (can be a follow-up if you want auto-refresh after connect).
