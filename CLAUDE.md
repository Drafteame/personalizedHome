# CLAUDE.md — One Click Bet

Project memory for any Claude session opened in this repo. Read first; **keep this file updated in the same commit as any change that meaningfully shifts architecture, conventions, branch model, or "where things live."**

---

## What this is

**One Click Bet** — an exploration repo forked from `Drafteame/draftea-momios-prototype` (the buttonPreviewMomios progressive-engagement prototype) and used as a base for new explorations. The original repo is left untouched; iterate here.

The current baseline is a high-fidelity interactive prototype of a **Draftea sportsbook bet-slip CTA** that escalates user engagement across 5 tiers (T0 → T4) using motion, light, and behavior — **not color shifts**. Built from Figma "Buscador" frames via the Figma MCP connector.

**Live preview:** https://drafteame.github.io/one-click-bet/
**Repo:** `Drafteame/one-click-bet` (public)
**Forked from:** `Drafteame/draftea-momios-prototype` (private)
**Local path:** `~/development/one-click-bet`

## Stack

- **Vite 5** + **React 18** + **TypeScript (strict)** + **Tailwind 3** + **Framer Motion 11**
- Build: `npm run build` (uses `vite build` only — `tsc` is intentionally **dropped** because pre-existing TS errors in `App.tsx`, `BetSlipShell.tsx` etc. would block CI. Run type-checking via `npm run typecheck` when you need it.)
- Dev: `npm run dev` → **http://localhost:5174/one-click-bet/** (note the subpath — root `/` 302-redirects there because of `base:` in `vite.config.ts`).

## Tier system

Cumulative odds → tier via the pure `tierForOdds()` function:

| Tier | Name | Threshold |
|---|---|---|
| T0 | Default | < 2.00x |
| T1 | Intermedio | ≥ 2.00x |
| T2 | Súper | ≥ 5.00x |
| T3 | Máximo | ≥ 15.00x |
| T4 | Legendario | ≥ 50.00x |

Tiers are **additive** — T3 includes everything in T2, etc. Differentiate with `cfg.tier{N}.*` overrides.

## File map

| File | Purpose |
|---|---|
| `src/BetSlipSheet.tsx` | **The bet slip on `main`.** ONE persistent glass surface that morphs its *shape* (height + corner radius, bottom-anchored) between the collapsed `ButtonPreviewMomios` capsule and the expanded purple-glass **summarized** card — a liquid morph, never an empty frame. The summarized card shows **1–2 selections only**: 1 selection keeps its original single stacked row (date on the right, bold pick); 2 render as a **vertical stack** of Figma `newSelectionPreviewOSB` rows (33712:267101 — × + vertical divider · shield · uppercase 10px market / medium pick · odds). **No 2+ "Bets · Promos · Lista" header anymore** — every count uses the single-selection handle structure. Adding a **3rd** selection auto-collapses to the pill (`App.tsx`: `setExpanded(count <= 2)` on growth). **With 3+ selections the summarized slip never re-opens** — `App.tsx` routes `onExpand` (tap the pill / swipe up) to open the "Resumen" floating card (`BetSlipFullSheet`) instead of expanding. Expanded height is **measured** from the content (`expandedH` motion value via ResizeObserver), so the card springs taller/shorter as the 2nd row is added/removed. Driven by a single `collapseP` motion value; the collapse is gesture-driven (drag shrinks it with the finger). Owns gesture-collapse, swipe-**up**-to-open-full-card, tap-to-expand (or tap-to-open-card at 3+), swipe-to-confirm (shared `SwipeToConfirm`), appear/collapse squash-stretch pulses. |
| `src/BetSlipFullSheet.tsx` | "Resumen de tu entrada" **floating card** (Figma `newEntryCards` 33822:171090), opened by tapping the collapsed pill (or swiping the slip up) when there are **3+ selections**. NOT a full-screen sheet: a bottom-anchored floating card (all corners `rounded-[28px]`, side inset `left/right-4`, **drag handle** at top matching the slip) over a gradient scrim (transparent across the top `HEADER_UNDIM_PX` 88px band so the app header stays undimmed, then `black/0.7` below). **Content-adaptive height** — grows/shrinks with the selection count (list is content-exact, no trailing fade); **capped** so its top stops at `TOP_INSET_PX` (96px, below the ~88px sticky header, which stays visible), after which the selections list scrolls internally (scrollbar hidden via `no-scrollbar`). Bottom edge lines up with the navbar (`BOTTOM_GAP_PX` = 16px + safe-area). The **inner content is unchanged** from the prior sheet (header trash clears the slip, selections list, Monto/Momio/Ganancia, free-bet/Booster promos box `freebet.png`/`booster.png`, accept-odds checkbox) except the swipe-to-play is the shared `SwipeToConfirm` at `heightPx={44}`. **Opens as a shape-morph, not a slide** — the card GROWS out of the slip footprint via a bottom-up `clip-path` reveal (from a `START_H` 56px capsule = the collapsed-pill height, up to the measured full height) while its content + the backdrop crossfade in, driven by one `openP` motion value — mirroring the pill↔card morph in `BetSlipSheet` so summarized slip → pill → this card all read as ONE surface changing shape. **Closes the same way, reversed** — × / backdrop-tap spring `openP` back to 0 (the card shrinks *in place* back into the pill, never a bottom-sheet slide) and **swipe-down drives the shrink directly** (the gesture writes `openP` from the finger offset 1:1, exactly like `BetSlipSheet`'s gesture-collapse — the card does NOT translate `y`). Both open and close use the same `OPEN_SPRING`. During the morph the card's **fill + border cross-fade to the purple pill** (a `PILL_BG`/`#4b20ff` layer under the dark `SHEET_BG`, driven by `cardDarkOpacity`) AND the card **rises `PILL_RISE_PX` (62px) up to the pill's line** (a `morphY` translate on a wrapper) — so the shrunk capsule lands ON the purple pill, not the dark navbar. During close the whole card **cross-fades against the real pill behind it** (`cardOpacity`, `openP` [0,0.12]) so the pill's content is revealed as the capsule fades — no "empty pill" gap — and a **close squash-&-stretch** pulse (`scaleX`/`scaleY`, same as the summarized slip's collapse) plays as it shrinks in. Close also collapses the bet slip; swipe-to-confirm → `confirmBet` closes the card + plays the success animation. Toggles + checkbox are CSS controls. One asset still pending: the countdown **clock icon**. |
| `src/EntryCreatedOverlay.tsx` | **Success animation** — ONE ticket/stub shape (Figma 33822:171080, **233×108**, notched mid-edges, drawn as the exact Figma vector `TICKET_FILL_PATH` in viewBox `16 16 233 108`; radial-green fill + gradient rim + wrapper `drop-shadow` glow) used by **every** success flow (swipe-to-confirm, Resumen swipe-to-play, AND lightning). Shows the `success-check.png` icon + uppercase italic "¡ENTRADA CREADA!"; enters via a **circular clip-path reveal** (`greenCircleIn`) + content pop, fires a **green spark burst + squash/stretch pop + glow flash** on reveal-complete (`onCovered`), then a **genie flight** into "Mis entradas" (springs launched together, no anticipation; progress-driven squash/stretch, shrink envelope, rotation; **fades out just before the tab** so it never overlaps). `onCatch` bumps the tab icon; `onDone` triggers the count badge + "¿Reusar?" prompt. All timing/geometry in its `cfg`. |
| `src/ButtonPreviewMomios.tsx` | The collapsed bet-slip pill (~1.7k LOC, all tier-gated effects; effects OFF on `main` via the master switch → static pill). Rendered by `BetSlipSheet` as the collapsed state. Full animated version preserved on the `bet-slip-progression` branch. |
| `src/buttonProgressionConfig.ts` | **Central tunables.** Every magic number lives here with a comment. |
| `src/types.ts` | `Tier = 0 | 1 | 2 | 3 | 4`, `Selection`, `TierConfig`. |
| `src/App.tsx` | Top-level orchestration: selection state, debug overlay, `selectionsForTier(N)` helper. |
| `src/HomeScreen.tsx` | `MOCK_PICKS` array drives the pick cards. Owns the two-tier **sticky header** (`HomeScreenChrome` — topbar pins; leagues row + match tabs/pills pin below it, and the **leagues row collapses on scroll-down / reappears on scroll-up** via `headerCollapsed`), the `Navbar` (entry-count badge + scroll-driven `compact` mode → icon-only 40px/200px centered bar, Figma 33885:39456), and `useLongPress` (long-press a pick → **Lightning Straight Bet**, tap → normal select). The scroll-direction signal (`navCompact` in `App.tsx`, ±4px deadband) drives BOTH the navbar compaction and the leagues-row collapse. |
| `src/BetSlipShell.tsx` | Entry/exit + velocity-derived landing squash wrapper. |
| `src/SwipeToConfirm.tsx` | **Shared "Desliza para jugar" swipe track** used by BOTH `BetSlipSheet` (summarized slip, default 40px) and `BetSlipFullSheet` (floating card, `heightPx={44}`). Owns the end-of-track confirm gate + spinner loader (`CONFIRM_LOADER_MS`). Props: `stake`, `onConfirm`, `onSwipeStart?`, `heightPx?`. In `BetSlipSheet` it's keyed on `expanded` so it remounts (resets swipe/loader state) on collapse. |
| `src/SlotNumber.tsx` | Per-digit slot animation for changing numbers. |
| `src/OddsRipple.tsx` | T3+ ghost-text ripple component. |
| `src/OutlineRipple.tsx` | T2+ button-outline ripple. |
| `src/OddsEffects.tsx` | `<OddsSmokeEffect>` (T3 odds variant). |
| `EFFECTS.md` | **Canonical effect catalog** — every animation/microinteraction, grouped by tier. |

## What you see → what I call it

Translation layer for describing changes by the **on-screen thing**, not the code name. You never need the file/component name — name the visible surface + behavior and this maps it.

| On screen | Component / file |
|---|---|
| The **collapsed pill** (small bet capsule above the navbar) | collapsed state of `BetSlipSheet` (renders `ButtonPreviewMomios`) |
| The **expanded slip / purple-glass card** (summarized, 1–2 selections; 2 = vertical stack) | expanded state of `BetSlipSheet` |
| The **"Resumen de tu entrada" floating card** (free-bet/Booster promos, accept-odds checkbox, swipe-to-play) — content-adaptive, capped below the header | `BetSlipFullSheet` |
| The green **"¡ENTRADA CREADA!" success ticket** (all flows: swipe-confirm, Resumen swipe-to-play, lightning) | `EntryCreatedOverlay` (`TicketFace`) |
| The **success card flying into the "Mis entradas" tab** (genie flight) | `GenieClone` in `EntryCreatedOverlay` |
| The **green spark burst / pop** when the success card appears | `makeBurst` + pop in `EntryCreatedOverlay` |
| The **home feed / pick cards** | `HomeScreen` (`MOCK_PICKS`) |
| The **sticky header** (topbar + match tabs/pills that pin) | `HomeScreenChrome` in `HomeScreen.tsx` |
| The **bottom navbar / entry-count badge / reuse-share-discard buttons** | `Navbar` in `HomeScreen.tsx` |
| **Long-press a pick → instant bet** (Lightning) | `useLongPress` (`HomeScreen`) + `lightningBet` (`App.tsx`) |
| The **rolling numbers** in the slip | `SlotNumber` |
| Any **magic number / timing / threshold** | `buttonProgressionConfig.ts` (or the `cfg` block in the relevant component) |

## Conventions

- **Effects gated by tier** with `tier === N` (exclusive) or `tier >= N` (inclusive). Watch this distinction — it's the #1 source of bugs when adding a new tier.
- **Every tunable** goes in `buttonProgressionConfig.ts` under `cfg.tier{N}.*` or shared sections like `cfg.breath` / `cfg.sparkles`. No magic numbers in the component.
- **`prefers-reduced-motion`** must be respected — gate ambient effects with `!reduced`.
- **`EFFECTS.md` is updated in the same commit** as any added/removed/retuned/moved effect. Don't expand README's effect section — point users to EFFECTS.md.
- **Debug overlay** (`?debug=true`) has tier-jump buttons, speed-scale (1× or 3× slow), and a T3 odds-effect toggle (flames / smoke). Add a button when you add a tier.
- **Effects that extend outside the pill** must be siblings of the rounded shell (which has `overflow:hidden`), not children. The fire-sparks wrapper / outline-ripple / odds-ripple already follow this.

## ⚠️ Master switch — progression animations are OFF on `main`

`cfg.animationsEnabled` in `src/buttonProgressionConfig.ts` is **`false`** on `main`. The bet-slip button renders **static**: all tier ambient effects, on-event micro-interactions, tier-crossing flourishes, the T4 vignette, haptics, and sound are suppressed. Only the slip **entry/exit** (`BetSlipShell`) and **number rolls** (`SlotNumber`) still play. The fully-animated version is snapshotted on the **`bet-slip-progression`** branch. Flip the flag to `true` to restore everything.

Wiring (intentionally minimal — reuses the reduced-motion gates): `ButtonPreviewMomios` OR-s the flag into `reduced`; `App.tsx` OR-s it into `reducedMotion` and gates the vignette opacity; `haptics.ts` early-returns. See the "Master switch" section in `EFFECTS.md`. When adding a NEW effect, gate it on `!reduced` (or `!reducedMotion` in App) so the master switch keeps covering it automatically.

## Branch model + deploy

- **`main`** is deployable, and currently ships the **static** button (master switch off — see above). GitHub Pages auto-publishes via `.github/workflows/deploy-pages.yml` on every push.
- **`bet-slip-progression`** — snapshot of the full animated progression system (master switch on). Reference / restore point for the effects.
- Feature/exploration branches off `main`: `tier_4`, `odds-effect`, `explorations`, etc. These do NOT auto-deploy.
- Promote work to `main` via merge or by `git checkout <sha> -- <files>` from the feature branch (handy when you want some files but not others — e.g., merge T4 minus the shake).
- **`vite.config.ts`** has `base: '/one-click-bet/'` for the Pages subpath. Don't remove it.

## Working-style defaults (carry across chats)

- **Always ask clarifying questions** in short polls (`AskUserQuestion`) before coding when the request is ambiguous — never guess. Especially for: tier scope (T-only vs additive), color choices, threshold numbers, intensity tradeoffs.
- **Be concise.** Iterate on small tuning changes; users typically expect multiple rounds of refinement (slower / dimmer / further / etc.).
- **Save checkpoints with git tags** before risky changes (e.g., `pre-stroke-thin-t3`, `pre-attracted-sparks`). User explicitly says "save this version" when they want one.
- **Never reinterpret, invent, or recreate icons / SVGs / PNGs / images.** Wait for the user to upload the asset file and tell you which to use. If a component needs visual assets that aren't yet provided, ASK — don't substitute placeholder shapes, emojis, or paths drawn from imagination. The current uploaded asset set lives in `src/assets/`.

## Common gotchas

- **`tier === N` vs `tier >= N`** — new tiers don't inherit T3-only effects unless you change `===` to `>=`. Audit every gate when adding a tier (OddsRipple, fire sparks, outline ripple, tremor, glow loop, etc.).
- **`getComputedStyle().opacity`** can return stale values during framer-motion animations. Use `getBoundingClientRect` or `element.getAnimations()` to verify motion in evals.
- **`shellSize.w === 0`** on first render before the `ResizeObserver` fires. Gate any size-dependent SVG with `shellSize.w > 0`.
- **CSS `offset-path: inset(0 round Npx)` ⚠️ Safari 16+.** The OddsRipple uses this. If you target older browsers, fall back to keyframe-based motion.
- **`shellRef`/`shellSize` only used by the SVG stroke sweep.** Don't accidentally remove them or the sweep breaks at runtime.

## For Flutter engineers (this repo is a POC for a Flutter mobile feature)

The React/Framer Motion code here is **not a direct translation source** — DOM/CSS and Flutter render very differently. But the repo IS a high-fidelity spec.

**Read in this order:**
1. The live site at `?debug=true` — visual ground truth, with jump-to-tier buttons and 3× slow-mo.
2. **`EFFECTS.md`** — plain-English feature spec, grouped by tier.
3. **`src/buttonProgressionConfig.ts`** — every magic number documented. **Copy values verbatim into Dart.**
4. **`FLUTTER_PORTING.md`** at the repo root — API mapping table (Framer Motion → AnimationController, conic-gradient → CustomPainter, etc.) + per-effect porting notes + branch reference.
5. The TS code only as a reference for *when* things fire and the relationships between effects.

Key design principle to preserve: **no base color shifts across tiers** — escalation comes from motion, light, and behavior.

## Where to start a new exploration

1. Branch from `main`: `git checkout -b feature/whatever`.
2. Make changes (touching `EFFECTS.md` in the same commit).
3. Verify locally at `http://localhost:5174/one-click-bet/?debug=true` — use the debug tier buttons to skip ahead.
4. When ready, merge or cherry-pick to `main` → auto-deploys in ~30s.
5. Tag with `git tag -a <name> -m "..."` before destructive changes.

## Recent landmarks (rolling — keep current)

- **Floating card opens as a shape-morph** — the "Resumen" `BetSlipFullSheet` no longer slides up from off-screen (`y: 900→0`) with a fading backdrop. It now **grows out of the bet-slip footprint**: an `openP` motion value drives a bottom-up `clip-path` reveal (from a `START_H` 56px capsule = the collapsed-pill height, up to the measured `fullH`) plus a content + backdrop crossfade, mirroring the pill↔card morph in `BetSlipSheet` — so summarized slip → pill → floating card all read as ONE surface changing shape (not a separate sheet placed on top). Close reverses `openP` to 0 (shrinks back into the slip). `y` is now used only for drag-to-close. Also removed the selections-list scroll indicator (`no-scrollbar`). Checkpoint before this change: tag **`pre-floating-card-morph`**.
- **Summarized slip → vertical selections + 1–2 cap** — the expanded `BetSlipSheet` no longer has a distinct "2+" parlay layout. The old horizontal selections + "Bets · Promos · Lista" header are gone; **every** count now uses the single-selection **handle** structure. 1 selection is unchanged (single stacked row, date on the right). 2 selections render as a **vertical stack** of Figma `newSelectionPreviewOSB` rows (33712:267101 — × + vertical divider · shield · uppercase 10px-bold market / medium pick · odds on the right). The summarized view is **capped at 2 rows** (latest first). Adding a **3rd** selection auto-collapses to the pill (`App.tsx`: `setExpanded(count <= 2)` on growth); at 3+ the summarized slip no longer re-opens — tapping the pill (or swiping up) opens the "Resumen" floating card (`onExpand` → `setListOpen(true)` when `selections.length > 2`). The expanded shell height is now **measured** from the content (`expandedH` motion value fed by a `ResizeObserver` — first measure snaps, later changes spring), so the card grows/shrinks smoothly as the 2nd row appears; the collapse-drag range derives from it. All existing morph/pulse/swipe microinteractions untouched.
- **`BetSlipFullSheet` → floating card** — the "Resumen de tu entrada" view is no longer a full-screen sheet. It's now a bottom-anchored **floating card** (Figma `newEntryCards` 33822:171090), with **content-adaptive height**: it grows/shrinks with the selection count, is capped below the ~88px sticky header (`TOP_INSET_PX` 96px) with the list scrolling internally past the cap, and its bottom lines up with the navbar (`BOTTOM_GAP_PX` 16px). Only the shell/positioning changed — the inner content is identical to the prior sheet. Refinements: the selections list is content-exact (removed the trailing fade that left dead space); no top purple glow; the overlay is a **gradient scrim that stays transparent across the top `HEADER_UNDIM_PX` (88px) band so the app header is never dimmed**, then ramps to `black/0.7` below; the swipe-to-play is the shared `SwipeToConfirm` component at `heightPx={44}`; a **drag handle** (same 32×4 grabber as the slip) sits at the top; swipe-to-confirm runs `confirmBet` (closes the card + plays the success animation, same as the slip).
- **Open behavior: 1–2 vs 3+ selections** — the summarized slip (`BetSlipSheet` expanded) applies ONLY at 1–2 selections. On the **3rd** selection the slip auto-collapses to the pill and the summarized view never re-opens; instead the user taps the pill (or swipes up), which `App.tsx` routes to open the `BetSlipFullSheet` floating card (`onExpand` → `setListOpen(true)` when `selections.length > 2`, growth effect uses `setExpanded(count <= 2)`).
- **Shared `SwipeToConfirm`** — the "Desliza para jugar" swipe track was extracted from `BetSlipSheet` into [`src/SwipeToConfirm.tsx`](src/SwipeToConfirm.tsx) and is now used by both the summarized slip (default 40px) and the floating card (44px). Byte-identical gesture/loader logic; parametrized by `heightPx`.
- **Repo forked to "One Click Bet"** from `draftea-momios-prototype` as a base for new explorations. Original untouched.
- **`BetSlipSheet` liquid-glass morph** — the collapsed pill ↔ expanded card is now ONE persistent glass surface that morphs its *shape* (height + corner radius, bottom-anchored via `collapseP`) so it never fades to an empty frame. Card content fades out early; the real `ButtonPreviewMomios` pill fades in only over the last stretch, onto the identical capsule the surface has become (seamless hand-off). The collapse is **gesture-driven**: dragging down continuously shrinks the surface with the finger (top edge tracks it, bottom stays anchored 8px above the navbar). Swipe **up** opens the full-screen `BetSlipFullSheet`; swipe **down** or 10s inactivity collapses; tap re-expands. Subtle squash-&-stretch pulses on appear + collapse (`ENTRY_PULSE_*` / `COLLAPSE_PULSE_*`).
- **Swipe-to-confirm gate + loader** — the thumb only confirms when it reaches the **end of the track** (measured from the track/thumb widths, not a fixed px). On completion it pins and shows a spinner for `CONFIRM_LOADER_MS` (900ms, simulated ticket creation) before the success flow. Same in `BetSlipFullSheet`.
- **Success overlay redesign** (`EntryCreatedOverlay`) — the green card now enters via a **circular clip-path reveal** (`greenCircleIn`, 0.2s) with the check/text popping in; when the reveal completes it fires a **green spark burst** + a **squash/stretch "pop"** + **glow flash**, then a faster genie flight (no anticipation phase) that **fades out ~3px before the tab** so it never overlaps. The slip stays mounted until `onCovered` (no gap behind the reveal).
- **Lightning Straight Bet** — long-press (450ms) any pick to create an entry **instantly**, skipping the slip entirely (only the success animation + post-entry actions play). The pressed pick first shows its **selected state** (the pick is added, slip suppressed via the `lightning` flag), then the entry is created a beat later (`LIGHTNING_SELECT_MS`). `useLongPress` in `HomeScreen.tsx`; `lightningBet(id)` in `App.tsx`.
- **Success = ONE ticket shape for every flow** — the success confirmation is now a single green **ticket/stub** (Figma 33822:171080, **233×108**) used by swipe-to-confirm, the Resumen full-sheet swipe-to-play, AND lightning bets alike (the old full-width green card + the `lightning` prop branching are gone). Shape is the exact Figma vector (`TICKET_FILL_PATH`, viewBox `16 16 233 108`): radial-green fill (`#29C28A→#1DAC7C→#059669` @95%), gradient rim stroke (`#34D399`@56%→`#1B6D4F`, rendered as an inside stroke via viewport clipping), green glow (`#36E5A9`@36%) on a wrapper `drop-shadow`. Icon = `src/assets/success-check.png` (36px, uploaded asset); message is uppercase **`¡ENTRADA CREADA!`** in Red Hat Display Black Italic 14px/21px. `cfg.ticket` holds the geometry.
- **Scroll-direction navbar + leagues collapse** — `App.tsx` tracks scroll direction on the content area (`navCompact`, `lastScrollTopRef`, ±4px deadband, always-full when `scrollTop ≤ 8`). Scrolling **down** compacts the navbar to an icon-only bar (Figma 33885:39456 — 40px tall, 200px pill centered via a 248px bar, labels collapse, search 40px) AND collapses the leagues row (`headerCollapsed` → `max-h`/opacity fold); scrolling **up** restores both. All via 250ms CSS transitions. The `Navbar` `compact` prop and `HomeScreenChrome` `headerCollapsed` prop share the one `navCompact` signal.
- **Sticky/collapsing header** (`HomeScreenChrome`) — two-tier CSS sticky: the topbar (status + logo/balance, with the top glow) pins at `top:0`; the **leagues row + match tabs + pill markets** pin just below it (offset = measured topbar height) as one stack. The leagues row now lives at the TOP of that pinned stack (no longer in normal flow) and folds away on scroll-down / reappears on scroll-up (see the scroll-direction entry above) instead of just scrolling out of view.
- **Mobile collapse fixes** — `overscroll-behavior-y: none` on html/body kills pull-to-refresh on the collapse swipe; `touch-action: none` on the expanded slip (added because the collapse drag uses `dragControls`/`dragListener=false`, so Framer doesn't auto-apply it) lets the downward drag grab instead of the browser scrolling.
- **Entry-count badge + post-entry action buttons** (Figma "navbarFooter" 33563:154460) — badge restyled to the "Entry counter": `#3d3d3d` pill, 2px `#191919` ring, bold white count at the icon's top-right; squash-stretch pop on appear (CSS `badgePop`, keyed per entry) + fade-out. Action row = 44px circular reuse/share/discard buttons (`#191919` fill, `rgba(251,251,251,0.16)` border), 12px above the navbar, fade in/out. **Badge and buttons share ONE 5s timer and disappear together.**
- **Backup branch `betslip-morph-v1`** — snapshot of the pre-liquid-glass (cross-fade) morph iteration.
- **Progression animations switched OFF on `main`** via the `cfg.animationsEnabled` master switch (see section above). The animated version is preserved on the `bet-slip-progression` branch. New "One Click Bet" explorations build on the static baseline.
- **T4 "Legendario" tier** added (≥ 50x). On `main`: boosted outer glow, white drop-shadow on all four numbers, denser edge-flash sparkles, faster + denser fire-sparks, more pronounced breath (amplitude 0.020 / 2200ms). Shake intentionally **excluded** on `main` (stays parked on `tier_4` branch).
- **OddsRipple** (`src/OddsRipple.tsx`) — T3+ ghost-text ripple on every selection add; pairs with a synchronized white drop-shadow flash on the source.
- **Italic typography at T3+** — the four bet-slip numbers switch to Red Hat Display Black Italic (matches Figma "Buscador" component).
- **Two parked exploration branches:** `odds-effect` (fire-sparks inflow direction — attracted from all sides), `explorations` (Magic UI shimmer-border via conic-gradient).

---

*If something significant about this project changes — architecture, file purposes, branch model, conventions, gotchas — update this file in the same commit.*
