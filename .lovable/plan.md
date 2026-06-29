## Fix

**Problem:** With the Sky accent active, the "Empty garage" hero card AND the "Log fuel" pill in the bottom bar are both the same accent blue → no visual hierarchy. Earlier fix only inverted the bar surface (stone) but kept the pill on accent, so when the card behind is also on accent they collide.

**Approach:** Decouple the primary pill from the active accent. The pill becomes a fixed "Apple-blue-on-dark" tone (or always-light pill on dark bar) regardless of accent, so it never matches any accent-tinted card. The Empty garage card stays accent.

### Changes

1. **`src/components/mobile-action-bar.tsx`**
   - Primary "Log fuel" pill: remove `bg-[var(--mint-accent)]`. Replace with a **white pill on the dark bar** (`bg-white text-stone-900` in light mode, `bg-stone-900 text-stone-50` in dark) — Apple control center style. Always contrasts with any accent card behind it.
   - Add a subtle inner highlight (`shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]`) and a soft outer shadow for that pressed-glass Apple feel.
   - Bar container: keep the inverted neutral surface but add `backdrop-blur-2xl` + translucent (`bg-stone-900/85`) so background hints through — more iOS-tab-bar like.

2. **Apple-like polish (small, contained)**
   - Bar: increase corner radius feel via taller pill (`h-12`), tighten gap, add `ring-1 ring-white/10 dark:ring-black/10` for that hairline edge.
   - Secondary icon buttons: switch to circular `bg-white/15` with `backdrop-blur` and `active:scale-95` haptic-style press (already via `.press`).
   - Add SF-style symbol weight: bump icon stroke to `strokeWidth={2.25}` on the three icons.
   - "Empty garage" hero (`src/routes/app.index.tsx`): soften with a subtle inner gradient overlay (`bg-gradient-to-br from-white/10 to-transparent`) and a top hairline (`ring-1 ring-white/20 inset`) so the flat blue gets depth without changing the accent.

### Files
- edit `src/components/mobile-action-bar.tsx` — pill becomes neutral white/dark, bar gets blur + hairline ring, icons get SF-weight strokes.
- edit `src/routes/app.index.tsx` — add inner-gradient + hairline ring overlay on the Empty/Active garage hero card for Apple-style depth.

No logic changes, no token changes (accent stays user-selectable).
