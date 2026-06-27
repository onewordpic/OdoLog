
## 1. Guest Garage — "Borrowed wheels, full receipts"

A separate section for vehicles you don't own but want to log trips/fuel for (road trip in a friend's car, rental, etc.).

- **Data model**: add `is_guest boolean default false` and `owner_name text` to `vehicles` (migration + grants stay as-is; RLS already scoped to user). Default `false` so existing rows are unaffected.
- **Add Vehicle modal**: new toggle "This is a borrowed / friend's vehicle". When on, reveal an "Owner's name" field (e.g. "Akhil's Thar"). Skips insurance/PUC/depreciation prompts since those aren't yours to track.
- **Home (`app.index.tsx`)**: split garage into two stacks — **My Garage** and **Guest Garage** (subheading: "Borrowed wheels, full receipts"). Guest cards get a small "Borrowed" chip + owner name.
- **Vehicle page**: hide Insurance/PUC alerts, depreciation card, and 15-year fitness reminder for guest vehicles. Keep refuel + trip + maintenance logging.
- **Analytics**: exclude guest vehicles from "Total spent" and running-cost-per-vehicle by default, with a toggle "Include borrowed vehicles".

## 2. Default greeting + occasional name nudge

- In `app.index.tsx` greeting, when `profile.display_name` is empty, render "Good morning, User" instead of "Good morning,".
- Add a lightweight, dismissible inline prompt under the greeting: "What should we call you?" with a small input + Save. Shows at most once per session (sessionStorage flag `odolog.nameNudgeShown`) and only if name is still empty. No modal — non-intrusive.

## 3. Fix `/api/public/gcal/callback`

**Root cause found**: the OAuth `state` is built as `` `${userId}:${origin}` `` where `origin` is `https://...lovable.app`. In the callback, `state.split(":")` returns `["<uuid>", "https", "//...lovable.app"]`, and destructuring `[userId, origin]` makes `origin = "https"`. The token exchange then sends `redirect_uri = "https/api/public/gcal/callback"`, which Google rejects → silent failure, no connection.

**Fix**:
- In `src/lib/gcal.functions.ts`: change the separator from `:` to `|` (won't appear in URLs/UUIDs). Example: `` `${context.userId}|${data.origin}` ``.
- In `src/routes/api.public.gcal.callback.ts`: parse with `const sep = state.indexOf("|"); const userId = state.slice(0, sep); const origin = state.slice(sep + 1);` and validate both.
- Also surface real errors instead of swallowing them: log `tokenRes` status + body server-side and render a clearer message in the HTML response so the next failure is debuggable.
- Sanity-check that both `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` secrets are set; if missing, the callback already returns a helpful message — leave that path intact.

## Files touched

- `supabase/migrations/<new>.sql` — add `is_guest`, `owner_name` to `vehicles`.
- `src/lib/data-store.ts` — extend `Vehicle` type and add/update inputs.
- `src/routes/app.index.tsx` — split garage, default-user greeting, name nudge.
- `src/routes/app.vehicle.$id.tsx` — hide ownership-only cards when guest.
- `src/routes/app.analytics.tsx` — guest-include toggle.
- Add-vehicle modal component — borrowed toggle + owner name field.
- `src/lib/gcal.functions.ts` + `src/routes/api.public.gcal.callback.ts` — state separator fix and clearer errors.

## Not in this plan

- Home Assistant integration — skipped per your choice. Easy to add later as a token-protected REST sensor endpoint when you want it.
