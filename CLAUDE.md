## personalizedHome exploration (2026-10-08)

- Independent public repository: `Drafteame/personalizedHome`; source history retained from `Drafteame/success-floating-card` as `upstream`. Push only to `origin`.
- Dev route: `http://localhost:5174/personalizedHome/`. Vite retains a repository subpath, now `/personalizedHome/`.
- `HomeScreen.tsx` lifts league selection to `HomeScreenChrome`. `Para ti` uses the supplied `assets/paraTiIcon.png` and renders `PersonalizedFeed`: Champions and Premier, each with a `FeaturedMatch` and the existing `PromoCarousel` of other matches.
- `PickButton` and `PlayerProfile` are extracted from the existing match/player implementation and shared. `FeaturedMatch` composes those with local markets and horizontally scrolling players. Player/team placeholders remain `player.svg` / `shield.svg`; two small stat SVGs come from the reference Figma node. Styling lives in the personalized feed section of `index.css`.
- Added picks stay in `MOCK_PICKS` so App's selection, long-press, grouping and slip flows work unchanged. Original feeds filter the new player picks and keep their original four-match carousel. Player lines include the threshold in slip copy.
- Inherited typecheck errors corrected with numeric MotionValue types, explicit promise callbacks, union narrowing and removal of unused declarations; no effects were retuned.

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
| `src/BetSlipSheet.tsx` | **The bet slip on `main`.** ONE persistent glass surface that morphs its *shape* (height + corner radius, bottom-anchored) between the collapsed `ButtonPreviewMomios` capsule and the expanded purple-glass **summarized** card — a liquid morph, never an empty frame. The summarized card shows **1–2 selections only**, rendered via the shared **`SelectionGroups`** (SGP grouping: 2 same-match picks → one SGP block with a match header; different matches → standalone rows with a divider between; see the SGP landmark). **No 2+ "Bets · Promos · Lista" header** — the slip keeps the single handle structure. Adding a **3rd** selection auto-collapses to the pill (`App.tsx`: `setExpanded(count <= 2)` on growth). **With 3+ selections the summarized slip never re-opens** — `App.tsx` routes `onExpand` (tap the pill / swipe up) to open the "Resumen" floating card (`BetSlipFullSheet`) instead of expanding. Expanded height is **measured** from the content (`expandedH` motion value via ResizeObserver), so the card springs taller/shorter as the 2nd row is added/removed. Driven by a single `collapseP` motion value; the collapse is gesture-driven (drag shrinks it with the finger). Owns gesture-collapse, swipe-**up**-to-open-full-card, tap-to-expand (or tap-to-open-card at 3+), swipe-to-confirm (shared `SwipeToConfirm`), appear/collapse squash-stretch pulses. |
| `src/BetSlipFullSheet.tsx` | "Resumen de tu entrada" **floating card** (Figma `newEntryCards` 33822:171090), opened by tapping the collapsed pill (or swiping the slip up) when there are **3+ selections**. NOT a full-screen sheet: a bottom-anchored floating card (all corners `rounded-[28px]`, side inset `left/right-4`, **drag handle** at top matching the slip) over a gradient scrim (transparent across the top `HEADER_UNDIM_PX` 88px band so the app header stays undimmed, then `black/0.7` below). **Content-adaptive height** — grows/shrinks with the selection count (list is content-exact, no trailing fade); **capped** so its top stops at `TOP_INSET_PX` (96px, below the ~88px sticky header, which stays visible), after which the selections list scrolls internally (scrollbar hidden via `no-scrollbar`). Bottom edge lines up with the navbar (`BOTTOM_GAP_PX` = 16px + safe-area). Inner content: header trash clears the slip, selections list, Monto/Momio/Ganancia, a **horizontal promos carousel** (Figma `freeBet` 34464:67899 + hidden booster 34464:67859 + `_row-promos`/Ver más 34464:67944, 8px `gap-2` spacing), accept-odds checkbox, and shared `SwipeToConfirm` at `heightPx={44}`. **Opens as a shape-morph, not a slide** — the card GROWS out of the slip footprint via a bottom-up `clip-path` reveal (from a `START_H` 56px capsule = the collapsed-pill height, up to the measured full height) while its content + the backdrop crossfade in, driven by one `openP` motion value — mirroring the pill↔card morph in `BetSlipSheet` so summarized slip → pill → this card all read as ONE surface changing shape. **Closes the same way, reversed** — × / backdrop-tap spring `openP` back to 0 (the card shrinks *in place* back into the pill, never a bottom-sheet slide) and **swipe-down drives the shrink directly** (the gesture writes `openP` from the finger offset 1:1, exactly like `BetSlipSheet`'s gesture-collapse — the card does NOT translate `y`). Both open and close use the same `OPEN_SPRING`. During the morph the card's **fill + border cross-fade to the purple pill** (a `PILL_BG`/`#4b20ff` layer under the dark `SHEET_BG`, driven by `cardDarkOpacity`) AND the card **rises `PILL_RISE_PX` (62px) up to the pill's line** (a `morphY` translate on a wrapper) — so the shrunk capsule lands ON the purple pill, not the dark navbar. During close the whole card **cross-fades against the real pill behind it** (`cardOpacity`, `openP` [0,0.12]) so the pill's content is revealed as the capsule fades — no "empty pill" gap — and a **close squash-&-stretch** pulse (`scaleX`/`scaleY`, same as the summarized slip's collapse) plays as it shrinks in. Close also collapses the bet slip; swipe-to-confirm → `confirmBet` closes the card + plays the success animation. Toggles + checkbox are CSS controls. |
| `src/EntryCreatedOverlay.tsx` | **Success animation** — ONE ticket/stub shape (Figma 35252:75429, **154.975×61**, notched mid-edges, drawn as the exact Figma vector `TICKET_FILL_PATH` in viewBox `16 16 154.975 61`; radial-green fill + soft white rim + wrapper `drop-shadow` glow), played as a **brief microinteraction**. Fires **after the floating success card (`SuccessEntrySheet`) is closed** (both close paths — `successNewEntry` / `successReuse` in `App.tsx` set `success`), and for the **lightning bet** (which skips the card). Shows the `success-check-3d.png` icon + uppercase italic "¡ENTRADA CREADA!"; enters via a **circular clip-path reveal** (`greenCircleIn`, 0.16s) + content pop, fires a **green spark burst + squash/stretch pop + glow flash** on reveal-complete (`onCovered`), holds `cfg.confirmedHoldMs` (**1700ms**, matching the compact source ticket), then a fast **genie flight** into "Mis entradas" (springs launched together, no anticipation; progress-driven squash/stretch, shrink envelope, rotation; **fades out just before the tab** so it never overlaps). `onCatch` bumps the tab icon; `onDone` (`finishEntryCreated`) records the entry + pops the count badge — **no "¿Reusar?" prompt** (reuse/share live in the success card). Completion is idempotent and guarded by `cfg.lifecycleMaxMs` so browser animation throttling cannot strand the success state. The "Entrada nueva" close path clears selections/stake immediately before this decorative animation, keeping the offer interactive independently of animation completion. All timing/geometry in its `cfg`. |
| `src/ButtonPreviewMomios.tsx` | The collapsed bet-slip pill (~1.7k LOC, all tier-gated effects; effects OFF on `main` via the master switch → static pill). Rendered by `BetSlipSheet` as the collapsed state. Full animated version preserved on the `bet-slip-progression` branch. |
| `src/buttonProgressionConfig.ts` | **Central tunables.** Every magic number lives here with a comment. |
| `src/types.ts` | `Tier = 0 | 1 | 2 | 3 | 4`, `Selection`, `TierConfig`. |
| `src/App.tsx` | Top-level orchestration: selection state, debug overlay, `selectionsForTier(N)` helper. |
| `src/HomeScreen.tsx` | `MATCHES` (4 matches: PSG·RMA, ARS·RMA, FCB·PSG, LIV·MCI) + `MOCK_PICKS` drive the offer. **Each pick carries its match** (`matchId` + `homeAbbrev`/`awayAbbrev`/`matchTime`) so the slip can SGP-group same-match picks. The offer is now **multi-match on the feed**: `PromoCarousel` is a horizontal **scroll-snap carousel** of per-match money-line cards (`MatchCard`, one dot per match, next card peeks), and there are **two player-prop markets** — `GOALS_MARKET` "Anota gol en cualquier momento" and `SHOTS_MARKET` "Tiros al arco" — each a `MarketAccordion` (same layout, filtered by `market === title`) showing players across ALL matches. So SGP (2+ same-match) vs standalone (different matches) can be built by tapping the real offer. `App.tsx` also has a debug 🎯 Cargar mezcla SGP seed. Owns the **sticky header** (`HomeScreenChrome` — ONE pinned sticky surface holding the logo/balance bar + leagues row + match tabs/pills, with the top decorative glow behind all of it; the **leagues row collapses on scroll-down / reappears on scroll-up** via `headerCollapsed`), the `Navbar` (entry-count badge + scroll-driven `compact` mode → icon-only 40px/200px centered bar, Figma 33885:39456), and `useLongPress` (long-press a pick → **Lightning Straight Bet**, tap → normal select). The scroll-direction signal (`navCompact` in `App.tsx`, ±4px deadband) drives BOTH the navbar compaction and the leagues-row collapse. |
| `src/BetSlipShell.tsx` | Entry/exit + velocity-derived landing squash wrapper. |
| `src/SwipeToConfirm.tsx` | **Shared "Desliza para jugar" swipe track** used by BOTH `BetSlipSheet` (summarized slip, default 40px) and `BetSlipFullSheet` (floating card, `heightPx={44}`). Owns the end-of-track confirm gate + spinner loader (`CONFIRM_LOADER_MS`). Resets thumb progress and loader state after submission, so retained/reopened instances start unswiped for each new entry. Props: `stake`, `onConfirm`, `onSwipeStart?`, `heightPx?`. In `BetSlipSheet` it's keyed on `expanded` so it remounts (resets swipe/loader state) on collapse. |
| `src/SelectionGroups.tsx` | **Shared SGP-grouped selections list** rendered by ALL THREE bet-slip views (summarized slip, floating card, success confirmation) so same-game-parlay grouping reads identically everywhere (Figma "SGP" 34367:176772). 2+ selections sharing a `matchId` collapse into an **SGP block** — a match-info header (`HOME vs AWAY · kickoff` + a group `×` that removes the whole match) followed by its member rows (indented under the header). A lone-match pick is a standalone row (market / pick / kickoff / odds). Every unit is separated from the next by a divider (SGP↔SGP, SGP↔single, single↔single). `onRemove` / `onRemoveGroup` are omitted for the read-only success view; `stopSwipePropagation` keeps taps on the × from starting the summarized slip's collapse gesture. |
| `src/betSlipGrouping.ts` | Pure `groupSelections(selections) → SelectionGroup[]` used by `SelectionGroups`. Groups by `matchId` preserving first-seen order; a match with ≥2 picks → `{kind:'sgp'}`, a lone pick → `{kind:'single'}`. |
| `src/SummarizedBooster.tsx` | **EXPERIMENTAL booster row** for the SUMMARIZED slip (`BetSlipSheet`) only — currently hidden on `main` via `SUMMARIZED_BOOSTER_ENABLED = false`. Exports `BoosterPromoTile` so the floating card carousel can reuse the exact hidden booster presentation without re-enabling it in the summarized slip. When enabled, `SummarizedBooster` renders the Figma "booster" 34464:67859 row (orange-bordered `#ffa65b` 20px-radius row · gradient illustration chip · "Booster NFL 20%" + caret · countdown pill `23h:23m` · **disabled** off-toggle). |
| `src/AmountKeypad.tsx` | **Shared numeric keypad** (Figma `keyboard` 34367:172671) for editing the entry amount — used by BOTH the summarized slip and the floating card. Presentational 3×4 grid (1-9 · Delete/`delete.svg`/0/**Hecho**), 40px rows, `KEYPAD_H`=160 export. Callbacks only (`onDigit`/`onDelete`/`onDone`); the parent owns the amount via `useStakeKeypad`. |
| `src/useStakeKeypad.ts` | **Shared stake-editing hook.** Manages the transient draft + open state for the keypad; on open it CLEARS the amount, Done with a typed value commits it (via `onCommit`), Done with nothing typed restores the pre-edit value. Whole pesos only (`MAX_STAKE_DIGITS`=6). The `stake` itself lives in `App.tsx` (single source of truth, `DEFAULT_STAKE`=200) and flows to both slips + the success sheet. |
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
| The **"Resumen de tu entrada" floating card** (promos carousel, accept-odds checkbox, swipe-to-play) — content-adaptive, capped below the header | `BetSlipFullSheet` |
| The green **"¡ENTRADA CREADA!" success ticket** (all flows: swipe-confirm, Resumen swipe-to-play, lightning) | `EntryCreatedOverlay` (`TicketFace`) |
| The **success card flying into the "Mis entradas" tab** (genie flight) | `GenieClone` in `EntryCreatedOverlay` |
| The **green spark burst / pop** when the success card appears | `makeBurst` + pop in `EntryCreatedOverlay` |
| The **home feed / pick cards** | `HomeScreen` (`MOCK_PICKS`) |
| The **sticky header** (topbar + match tabs/pills that pin) | `HomeScreenChrome` in `HomeScreen.tsx` |
| The **bottom navbar / entry-count badge / reuse-share-discard buttons** | `Navbar` in `HomeScreen.tsx` |
| **Long-press a pick → instant bet** (Lightning) | `useLongPress` (`HomeScreen`) + `lightningBet` (`App.tsx`) |
| The **rolling numbers** in the slip | `SlotNumber` |
| The **SGP group block** (match header "HOME vs AWAY · time" + grouped selections + dividers) in any slip view | `SelectionGroups` (grouping logic in `betSlipGrouping.ts`) |
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

## Implementation and Local Preview Verification

The following process is mandatory for every implementation, bug fix, and UI adjustment.

### 1. Verify the correct environment

- Confirm the active repository, working directory, branch, and relevant files before making changes.
- Confirm that the localhost preview is running from the same repository and branch being edited.
- Check whether the preview is using stale code, cached assets, or an outdated build.

### 2. Reproduce before modifying

- Reproduce the reported issue in the actual localhost preview before implementing a fix.
- Document the exact route, state, viewport, interactions, and data needed to reproduce it.
- Do not assume the issue based only on reading the code.

### 3. Implement the root-cause fix

- Identify and fix the underlying cause rather than applying a visual patch or temporary workaround.
- Check related component states, overlays, pointer events, scroll locks, z-index layers, timers, event listeners, cached state, and responsive variants when relevant.
- Reuse existing components and patterns when appropriate, but do not force reuse if it creates incorrect behavior.

### 4. Verify in the running preview

- Do not mark a task as complete based only on code changes, compilation, tests, or static inspection.
- Test the final behavior directly in the localhost browser preview.
- Restart the development server, rebuild the project, or clear relevant caches when changes are not reflected.
- If the requested change is not visible or the issue remains reproducible, continue debugging.

### 5. Test the requested case and nearby edge cases

- Validate the exact scenario reported by the user.
- Test adjacent states, thresholds, responsive layouts, and interaction paths likely to be affected.
- For UI changes, verify both desktop and mobile browser behavior when those views exist.
- Confirm that the change does not introduce regressions in related flows.

### 6. Do not claim unverified completion

- Never state that a task is completed, fixed, or implemented unless it has been verified in the actual local preview.
- If direct preview verification is not possible, clearly state that limitation and describe exactly what remains unverified.
- Never invent test results or imply that browser validation occurred when it did not.

### 7. Provide a completion report

After every task, report:

- Root cause or implementation rationale.
- Exact files changed.
- Summary of the changes.
- Localhost route and viewport tested.
- Reproduction and verification steps performed.
- Edge cases tested.
- Whether the dev server, build, or cache had to be restarted.
- Any remaining limitations or unverified behavior.

### 8. Preserve working changes

- Do not revert or overwrite unrelated user changes.
- Review the current diff before and after implementation.
- Keep the scope limited to the requested task unless a broader change is necessary to fix the root cause.
- Explicitly mention any additional changes that were required.

### 9. Use evidence

- When possible, include concrete evidence from the verification process, such as observed UI behavior, console output, test results, or screenshots.
- Completion claims must be supported by the performed checks.

### Definition of Done

- [ ] Correct repository and branch confirmed
- [ ] Issue or requested behavior reproduced
- [ ] Root cause or implementation path identified
- [ ] Change implemented
- [ ] Local preview refreshed or restarted
- [ ] Exact requested behavior verified in the browser
- [ ] Relevant edge cases tested
- [ ] No blocking overlay, stale state, console error, or regression found
- [ ] Diff reviewed
- [ ] Completion report provided

## Common gotchas

- **`tier === N` vs `tier >= N`** — new tiers don't inherit T3-only effects unless you change `===` to `>=`. Audit every gate when adding a tier (OddsRipple, fire sparks, outline ripple, tremor, glow loop, etc.).
- **`getComputedStyle().opacity`** can return stale values during framer-motion animations. Use `getBoundingClientRect` or `element.getAnimations()` to verify motion in evals.
- **`shellSize.w === 0`** on first render before the `ResizeObserver` fires. Gate any size-dependent SVG with `shellSize.w > 0`.
- **CSS `offset-path: inset(0 round Npx)` ⚠️ Safari 16+.** The OddsRipple uses this. If you target older browsers, fall back to keyframe-based motion.
- **`shellRef`/`shellSize` only used by the SVG stroke sweep.** Don't accidentally remove them or the sweep breaks at runtime.
- **Framer drag with `dragListener={false}` needs manual `touch-action`.** Any `dragControls`-driven card (expanded slip, `SuccessEntrySheet`, `BetSlipFullSheet`) must set `touch-action: none` itself — Framer only auto-applies it when it owns the listener. Without it, mobile browsers claim the vertical gesture as a scroll and swipe-down silently dies. If the card has an internal scroll region, give THAT `touch-action: pan-y` so it still scrolls. Also gate a dismissible overlay's `pointerEvents` on `usePresence`'s `isPresent` (→ `'none'` on exit), not only on the morph progress value, so a mid-close hiccup can't leave it blocking the feed.

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

- **Rescate + dark ticket artwork (`rescatePromoAndTicketStyle`)** — `ActivePromo` now includes `'rescate'`, keeping App's existing exclusive promo and placed-entry/ticket snapshots. Rescate uses the current 3+ selection eligibility and never changes slip values or amount formatting. `BetSlipFullSheet` reuses the carousel drag hook and `PromoSwitch`; the exact supplied `rescate.png` goes in the tile, `rescateWings.png` in the confirmation/ticket and `rescateBadge.png` under the confirmation heading. Quick Bet nodes 2215:31092 / 2215:31082 / 2139:17558 define the tile and confirmation. `promoConfig.ts` owns `ticketArtwork` / `ticketArtworkLayout`: exact Figma background and masked-light SVGs for default 2199:34521, booster 2198:31110, free bet 2198:31164 and Rescate 2198:31218. Their intrinsic glow bounds are offset −16px around the unchanged 154.975×61 animation wrapper; the exported 4px rims replace the old generated ticket face. Animation/callback/entry-count logic remains unchanged. Backup `backup/current-ticket-before-rescate` is the pre-change ticket baseline; `successIllustration` stays a separate PNG-ticket exploration, unmerged. Integration source: the preserved Rescate stash plus swipeTextVisualCentering. The complete PNG-ticket successIllustration experiment is excluded. Rescate payout labels wrap when needed; exported base SVG outer shadows are disabled so the original single wrapper glow/flash response is retained.

- **Success illustration + ticket rim refinements** — the default `SuccessEntrySheet` uses the exact supplied `src/assets/checkIlus.png` in its existing 72px slot; promo success illustrations remain rocket/gift. All `EntryCreatedOverlay` ticket faces (resting and flying, default/booster/free bet) share `cfg.ticket.rimWidthPx = 4`: an 8px SVG stroke clipped to the original fill path gives a 4px inside rim, preserving the path, size, assets and animation timings.

- **Promo carousel refinements (`promosImplementation`)** — `useHorizontalDragScroll.ts` adds mouse-only pointer-captured scrolling to the opened Resumen carousel. A 6px threshold preserves clicks; snapping pauses during dragging, restores on release/cancel, and the drag's click is suppressed. Touch stays native `pan-x`; `[data-scroll]` and propagation guards isolate the sheet's vertical close gesture. Quick Bet `2194:30544` replaces the old trailing Ver más tile with centered **Ver todas** below the carousel (8px gap/padding, bottom divider, exact exported 14px `promo-chevron-right.svg`). Supplied booster/free-bet PNGs now fill transparent 36px tile image slots. Promo business logic and success/ticket variants remain unchanged.

- **Exclusive promo flow (`promosImplementation`)** — `App.tsx` owns `ActivePromo` (`null | 'booster' | 'freebet'`) and freezes the confirmed promo/stake/base odds in `placedEntry` for the success card. A separate `ticketPromo` snapshot carries the theme through the subsequent decorative ticket, independently of fresh feed picks. The floating `BetSlipFullSheet` carousel is controlled; booster multiplies odds by 1.2, free bet locks the amount to $25 while retaining the paid stake. Promos require 3+ selections, clear below eligibility and on confirmation, and are not automatically reapplied by Reusar. `src/promoConfig.ts` centralizes offer values and exact Quick Bet Figma paints. `src/vite-env.d.ts` supplies standard Vite asset declarations; remaining typecheck errors predate this branch. `SuccessEntrySheet` / `EntryCreatedOverlay` reuse their default structures and ticket path/timing with conditional paints and the supplied `src/assets/booster.png` / `apuestaGratis.png`; no-promo and lightning remain green. Sources: Quick Bet `2194:29841`, `2194:30544`, `2138:162878`, `2139:16337`, `2154:21765`, `2154:22625`. The free-bet slip source still contains booster values; explicit product requirements take precedence (fixed $25, disabled input, no combined boost). Current repo is `Drafteame/success-floating-card`, local preview `/success-floating-card/` on port 5174; the earlier One Click Bet metadata above describes the fork's history.

- **Swipe confirmation resets after each submission** — shared `SwipeToConfirm` now stops/resets thumb progress and clears its loader state before handing off success, covering both summarized and Resumen slips even when exit animations retain their component instances. Ticket `cfg.confirmedHoldMs` is restored from 600ms to the compact source ticket’s 1700ms for readability; ticket visuals and all other timing values stay unchanged.

- **Summarized slip booster hidden on main** — `SummarizedBooster.tsx` now has `SUMMARIZED_BOOSTER_ENABLED = false`, using the existing kill switch instead of deleting the component. The summarized `BetSlipSheet` still keeps the one call site, but it renders `null`, so the measured expanded height shrinks naturally to the remaining content (Monto/keypad → swipe) and the floating `BetSlipFullSheet` promos remain untouched. Checkpoint before this change: tag **`checkpoint-pre-remove-summarized-booster-20260717`**.
- **Floating card promos are now a horizontal carousel** — replaced the old stacked freebet/booster promos box in `BetSlipFullSheet` with `PromoCarousel`: Freebet tile (Figma 34464:67899), `BoosterPromoTile` reused from the hidden summarized booster (34464:67859), and "Ver más" tile (34464:67944). The carousel is `no-scrollbar`/`snap-x` with `gap-2` = **8px** between components and `[data-scroll]` so horizontal promo scrolling does not start the card's swipe-down close gesture. It is full-bleed across the footer (`-mx-[10px]` + `px-[10px]`) so the next tile continues to the card edge instead of being chopped by the inner padding. In the 3+ floating card, freebet and booster switches are available/tappable (`aria-pressed` state, green when active); the summarized slip still keeps `SUMMARIZED_BOOSTER_ENABLED = false`.
- **Removed the silent 8-selection interaction cap** — `togglePick` no longer drops new market taps when a reused slip already contains 8 selections, and `buttonProgressionConfig.maxSelections` is gone. The debug counter now reports the live count without a misleading `/ 8`. This fixes the post-success "frozen offer" path: after closing the success card with **Reusar**, the clean DOM was interactive but the old max guard silently rejected every additional market. Entries with 9, 10, and more selections now continue normally; "Entrada nueva" still clears the placed slip immediately.
- **Flying ticket now plays AFTER the success card closes (brief microinteraction)** — the green "¡ENTRADA CREADA!" ticket (`EntryCreatedOverlay`) used to be lightning-only; the swipe-confirm / Resumen flows just showed the floating success card (`SuccessEntrySheet`) and bumped the count on close. Now **closing that card triggers the flying ticket**: `successNewEntry` / `successReuse` (`App.tsx`) set `success` instead of incrementing the count directly, and the ticket's `onDone` (`finishEntryCreated`) records the entry + pops the tab count badge once it lands. `preserveSelectionsOnFinishRef` protects both the intentionally reused slip and any fresh picks made after "Entrada nueva" clears the placed slip synchronously; only lightning still clears at ticket completion. The animation is **faster + briefer** (`cfg.confirmedHoldMs` 1700→**600ms**, entrance reveal 0.2→0.16s, burst 300–500ms, snappier genie springs). The **post-entry "¿Reusar o compartir?" action row (reuse/share/discard buttons) is REMOVED entirely** — those actions live inside the success card now, so the ticket flow shows ONLY the ticket + the count badge; `promptOpen`/`promptMounted` state, the JSX block, the `close/compartir/reusar` icon imports, and the `promptIn` keyframe are all deleted.
- **Experimental booster in the summarized slip** (`SummarizedBooster.tsx`, Figma "booster" 34464:67859) — a standalone orange-bordered booster row added to the SUMMARIZED slip (`BetSlipSheet`) only, sitting **directly below the Monto stake** (keypad closed) or **directly below the numeric keypad** (keypad open), since it's an in-flow child placed AFTER the bottom-anchored keypad slot and BEFORE the swipe. Its own `pt-[10px]` is the 10px gap above; the swipe's `pt-[10px]` is the gap below — so the 10px rhythm around the keypad is preserved. Rendered ALWAYS-DISABLED when enabled (the booster only unlocks at 3+ selections but the summarized slip only shows 1–2, so it's a visible incentive; non-interactive, no benefit — matches the Figma "Default-disabled" switch). **Currently hidden on `main`** via `SUMMARIZED_BOOSTER_ENABLED = false`; set it true or delete/restore the one call site to change visibility — zero effect on the rest of the slip. **Does NOT touch the floating card** (`BetSlipFullSheet` keeps its own promos-box booster). Checkpoint before this work: tag **`pre-summarized-booster`** + branch **`feature/summarized-booster`**.
- **Multi-match offer on the feed** — the offer now spans 4 matches (`MATCHES`: PSG·RMA, ARS·RMA, FCB·PSG, LIV·MCI) so SGP grouping and cross-match singles can be built + verified by tapping the real offer (not just the debug seed). The promo card section (`PromoCarousel`) is now a horizontal **scroll-snap carousel** of per-match money-line cards (`MatchCard`; a dot per match, the next card peeks; money-line label is by column position — 0=home, draw=EMPATE, else away — since pick names are full team names). Added a **second player market "Tiros al arco"** (`SHOTS_MARKET`) with the SAME layout as "Anota gol en cualquier momento" (`GOALS_MARKET`) — `MarketAccordion` is now parametrized by `title` and filters `MOCK_PICKS` by `market === title`, rendering player cards across every match (player name = `pick.pick`, position from `PLAYER_POSITION` default DEL, match/time from the Selection via `splitKickoff`). The old hardcoded `PLAYER_META` is gone. `MOCK_PICKS` expanded to full money lines + goal/shots players per match.
- **Same-game-parlay (SGP) grouping** — 2+ selections that share a `matchId` now collapse into one **SGP block** in the bet slip: a match-info header (`HOME vs AWAY · kickoff` + a group `×` that removes the whole match, Figma "SGP" 34367:176772) followed by its member rows, indented under the header. Lone-match picks stay standalone rows; every unit is separated from the next by a divider (SGP↔SGP, SGP↔single, single↔single). **SGP member rows hide their leg odds** (they roll up into the SGP's combined odds, per Figma); standalone legs in a MULTI-selection slip keep their own odds. SGP rows are compact (44px members, 40px header); standalone rows are lightly `padded` (py-1). **Dividers between units are conditional** (`dividers` prop): the summarized slip passes `'none'` (never), and the floating card + success view default to `'auto'` — dividers show ONLY when the slip contains at least one SGP group (a pure list of single-match bets shows none), with `my-2` spacing. The × is a tintable CSS-mask glyph (`CloseGlyph`): **group header × = white**, **SGP member × = the market-name color** (`rgba(251,251,251,0.5)`), standalone/straight-bet × = white. The summarized slip passes `showStandaloneDate={false}` so its 2-selection (two different-match singles) view drops the kickoff line AND those rows go `compact` (full 44px shield, no min-height, `py-1` gap → ~49px each, vs the dated ~56px); the floating card + success view keep the roomier dated standalone rows. **A slip with exactly ONE selection** is a **straight bet** → the ORIGINAL single-selection row (`StraightBetRow`): **date on the right, NO odds** (the odds already show in the Momio field next to the amount), market medium + pick bold. Implemented ONCE in the shared **`SelectionGroups`** component (grouping logic in **`betSlipGrouping.ts`**) and used by all three views — summarized slip (`BetSlipSheet`), floating card (`BetSlipFullSheet`), success confirmation (`SuccessEntrySheet`, read-only: no × chrome). The old per-view inline selection rows are gone. `Selection` gained `matchId` + `homeAbbrev`/`awayAbbrev`/`matchTime`; `MOCK_PICKS` carries match info and adds off-feed picks (ARS·RMA / FCB·PSG / LIV·MCI) so a cross-match slip can be built. `App.tsx` gained `removeGroup(matchId)` (wired to both slips) and a debug **🎯 Cargar mezcla SGP** seed (2 SGP blocks + 2 standalone picks). All existing morph/pulse/swipe/open-close animations untouched.
- **Numeric keypad for the entry amount** — tapping the **Monto** in either the summarized slip (`BetSlipSheet`) or the floating card (`BetSlipFullSheet`) opens a shared `AmountKeypad` (Figma 34367:172671) docked at the card's bottom edge. On open it CLEARS the amount so you type fresh; **Hecho** with a typed value saves it, Hecho with nothing typed restores the pre-edit value. The **stake is now lifted to `App.tsx`** (`DEFAULT_STAKE`=200, `stake`/`setStake`) as a single source of truth shared by both slips + `SuccessEntrySheet` (all their local `STAKE=200` consts are gone); reset to default on each new entry. Whole pesos only (no decimal key). The keypad always has **exactly 10px of vertical spacing above and below it** in both slips (fixed px, not responsive, consistent across open/closed states) — the gap ABOVE is a `pt-[10px]` baked into the keypad slot's inner wrapper (revealed as the slot springs open; the row above has no bottom spacing so it's exactly 10px), and the gap BELOW is a `pt-[10px]`/`mt-[10px]` on the element directly beneath it (which doubles as the closed-state gap). **Summarized slip:** the keypad is an **in-flow slot BETWEEN the Monto row and the swipe-to-confirm** (content is bottom-anchored, so the swipe stays pinned at the bottom while the keypad pushes Monto and above upward). `KEYPAD_SLOT` = `KEYPAD_H + 10` (the 10px top pad); the swipe wrapper's `pt-[10px]` is the gap below. Its height (spring-driven `keypadOffsetH`) is added deterministically to the shell/glass height; the `expandedH` ResizeObserver **skips measuring while the keypad is open** (`keypadOffsetH.get() > 0.5`) so its height isn't double-counted in the base. **Floating card:** the keypad is a spring-height in-flow slot **between the Monto row and the promos** (order: Monto → keyboard → promos → checkbox → swipe). The footer uses **explicit child margins, NOT a flex `gap`** (a `gap` would double around a 0-height closed slot), so the keypad slot has no top margin (its `pt-[10px]` is the gap above) and the promos box has `mt-[10px]` (gap below); the checkbox + swipe carry `mt-3` to restore the old inter-row spacing. It grows the footer: under the max card height the card grows; at max height the (flex-1) selections list shrinks so the stake + keypad + promos + swipe stay visible. Both use `useSpring(target)` (setting a bare `useSpring`'s own value does NOT animate — the slot lagged until switched to the source-target pattern). The **collapsed `ButtonPreviewMomios` pill also reflects the shared stake** (now takes a `stake` prop, default 200, instead of a hardcoded `$200`). While the keypad is open, **Monto / Ganancia / swipe all track the live draft** (`potentialWin` uses `keypad.displayValue`, not the committed stake). The keypad's **horizontal row dividers are a gradient** (`linear-gradient(90deg, transparent, rgba(251,251,251,0.34) 50%, transparent)`) rendered as a 1px absolute line so it fades at the edges per Figma; vertical dividers stay solid `rgba(251,251,251,0.16)`. While editing, the amount field shows a **blank value + a blinking caret** (`useStakeKeypad.displayText` is the raw draft — empty, not "0"; `@keyframes caretBlink` in index.css) and the field's **selected state is white** (`#fbfbfb` border + text, not purple). **Swipe-to-close works with the keyboard up:** the summarized slip's collapse gesture is no longer gated on `!keypad.open` (it collapses AND closes the keypad via the guard); and `AmountKeypad` has its own non-capturing down-drag detector (`onSwipeDown`, threshold 44px — plain pointerdown/up so key TAPS still register) wired to `onCollapse` (summarized) / `onClose` (floating card), so a downward drag over the keys closes the slip too.
- **Floating card opens as a shape-morph** — the "Resumen" `BetSlipFullSheet` no longer slides up from off-screen (`y: 900→0`) with a fading backdrop. It now **grows out of the bet-slip footprint**: an `openP` motion value drives a bottom-up `clip-path` reveal (from a `START_H` 56px capsule = the collapsed-pill height, up to the measured `fullH`) plus a content + backdrop crossfade, mirroring the pill↔card morph in `BetSlipSheet` — so summarized slip → pill → floating card all read as ONE surface changing shape (not a separate sheet placed on top). Close reverses `openP` to 0 (shrinks back into the slip). `y` is now used only for drag-to-close. Also removed the selections-list scroll indicator (`no-scrollbar`). Checkpoint before this change: tag **`pre-floating-card-morph`**.
- **Summarized slip → vertical selections + 1–2 cap** — the expanded `BetSlipSheet` no longer has a distinct "2+" parlay layout. The old horizontal selections + "Bets · Promos · Lista" header are gone; **every** count now uses the single-selection **handle** structure. 1 selection is unchanged (single stacked row, date on the right). 2 selections render as a **vertical stack** of Figma `newSelectionPreviewOSB` rows (33712:267101 — × + vertical divider · shield · uppercase 10px-bold market / medium pick · odds on the right). The summarized view is **capped at 2 rows** (latest first). Adding a **3rd** selection auto-collapses to the pill (`App.tsx`: `setExpanded(count <= 2)` on growth); at 3+ the summarized slip no longer re-opens — tapping the pill (or swiping up) opens the "Resumen" floating card (`onExpand` → `setListOpen(true)` when `selections.length > 2`). The expanded shell height is now **measured** from the content (`expandedH` motion value fed by a `ResizeObserver` — first measure snaps, later changes spring), so the card grows/shrinks smoothly as the 2nd row appears; the collapse-drag range derives from it. All existing morph/pulse/swipe microinteractions untouched.
- **`BetSlipFullSheet` → floating card** — the "Resumen de tu entrada" view is no longer a full-screen sheet. It's now a bottom-anchored **floating card** (Figma `newEntryCards` 33822:171090), with **content-adaptive height**: it grows/shrinks with the selection count, is capped below the ~88px sticky header (`TOP_INSET_PX` 96px) with the list scrolling internally past the cap, and its bottom lines up with the navbar (`BOTTOM_GAP_PX` 16px). Only the shell/positioning changed — the inner content is identical to the prior sheet. Refinements: the selections list is content-exact (removed the trailing fade that left dead space); no top purple glow; the overlay is a **gradient scrim that stays transparent across the top `HEADER_UNDIM_PX` (88px) band so the app header is never dimmed**, then ramps to `black/0.7` below; the swipe-to-play is the shared `SwipeToConfirm` component at `heightPx={44}`; a **drag handle** (same 32×4 grabber as the slip) sits at the top; swipe-to-confirm runs `confirmBet` (closes the card + plays the success animation, same as the slip).
- **Open behavior: 1–2 vs 3+ selections** — the summarized slip (`BetSlipSheet` expanded) applies ONLY at 1–2 selections. On the **3rd** selection the slip auto-collapses to the pill and the summarized view never re-opens; instead the user taps the pill (or swipes up), which `App.tsx` routes to open the `BetSlipFullSheet` floating card (`onExpand` → `setListOpen(true)` when `selections.length > 2`, growth effect uses `setExpanded(count <= 2)`). **The "Resumen" floating card is gated to 3+ selections on EVERY entry point.** At 1–2 selections it must never appear: swipe-to-confirm on the summarized slip runs its own flow (→ `SuccessEntrySheet`), and a **swipe-up** on the summarized slip is a **no-op** — `App.tsx` guards `onOpenList` with `if (selections.length > 2) setListOpen(true)` so an up-swipe at 1–2 leaves the slip expanded instead of opening the card. Revert point: tag **`pre-resumen-3plus-gate`** (drop that guard to restore swipe-up → Resumen at any count).
- **Shared `SwipeToConfirm`** — the "Desliza para jugar" swipe track was extracted from `BetSlipSheet` into [`src/SwipeToConfirm.tsx`](src/SwipeToConfirm.tsx) and is now used by both the summarized slip (default 40px) and the floating card (44px). Byte-identical gesture/loader logic; parametrized by `heightPx`.
- **Repo forked to "One Click Bet"** from `draftea-momios-prototype` as a base for new explorations. Original untouched.
- **`BetSlipSheet` liquid-glass morph** — the collapsed pill ↔ expanded card is now ONE persistent glass surface that morphs its *shape* (height + corner radius, bottom-anchored via `collapseP`) so it never fades to an empty frame. Card content fades out early; the real `ButtonPreviewMomios` pill fades in only over the last stretch, onto the identical capsule the surface has become (seamless hand-off). The collapse is **gesture-driven**: dragging down continuously shrinks the surface with the finger (top edge tracks it, bottom stays anchored 8px above the navbar). Swipe **up** opens the full-screen `BetSlipFullSheet`; swipe **down** or 10s inactivity collapses; tap re-expands. Subtle squash-&-stretch pulses on appear + collapse (`ENTRY_PULSE_*` / `COLLAPSE_PULSE_*`).
- **Swipe-to-confirm gate + loader** — the thumb only confirms when it reaches the **end of the track** (measured from the track/thumb widths, not a fixed px). On completion it pins and shows a spinner for `CONFIRM_LOADER_MS` (900ms, simulated ticket creation) before the success flow. Same in `BetSlipFullSheet`.
- **Success overlay redesign** (`EntryCreatedOverlay`) — the green card now enters via a **circular clip-path reveal** (`greenCircleIn`, 0.2s) with the check/text popping in; when the reveal completes it fires a **green spark burst** + a **squash/stretch "pop"** + **glow flash**, then a faster genie flight (no anticipation phase) that **fades out ~3px before the tab** so it never overlaps. The slip stays mounted until `onCovered` (no gap behind the reveal).
- **Lightning Straight Bet** — long-press (450ms) any pick to create an entry **instantly**, skipping the slip (and the floating success card) entirely — only the flying-ticket success animation + the count badge play. The pressed pick first shows its **selected state** (the pick is added, slip suppressed via the `lightning` flag), then the entry is created a beat later (`LIGHTNING_SELECT_MS`). `useLongPress` in `HomeScreen.tsx`; `lightningBet(id)` in `App.tsx`.
- **Success = ONE ticket shape for every flow** — the success confirmation is now a single green **ticket/stub** (Figma 35252:75429, **154.975×61**) used by swipe-to-confirm, the Resumen full-sheet swipe-to-play, AND lightning bets alike (the old full-width green card + the `lightning` prop branching are gone). Shape is the exact Figma vector (`TICKET_FILL_PATH`, viewBox `16 16 154.975 61`): radial-green fill (`#29C28A→#1DAC7C→#059669` @95%), 2px soft white rim stroke (`#FBFBFB` @32%, rendered as an inside stroke via viewport clipping), green glow (`#36E5A9`@36%) on a wrapper `drop-shadow`. Icon = `src/assets/success-check-3d.png` (36px, exact source-repo asset); message is uppercase **`¡ENTRADA CREADA!`** in Red Hat Display Black Italic 14px/18px across two lines rotated −3.7° beside the 3D check, with a 6px gap. `cfg.ticket` holds the geometry.
- **Scroll-direction navbar + leagues collapse** — `App.tsx` tracks scroll direction on the content area (`navCompact`, `lastScrollTopRef`, ±4px deadband, always-full when `scrollTop ≤ 8`). Scrolling **down** compacts the navbar to an icon-only bar (Figma 33885:39456 — 40px tall, 200px pill centered via a 248px bar, labels collapse, search 40px) AND collapses the leagues row (`headerCollapsed` → `max-h`/opacity fold); scrolling **up** restores both. All via 250ms CSS transitions. The `Navbar` `compact` prop and `HomeScreenChrome` `headerCollapsed` prop share the one `navCompact` signal.
- **Sticky/collapsing header** (`HomeScreenChrome`) — ONE sticky surface pinned at `top:0` (`sticky top-0 z-30 overflow-hidden bg-black`) holding the logo/balance bar + leagues row + match tabs + pill markets. It's a **single tier** (merged from the earlier two-tier topbar/leagues split) so the decorative top glow can span **behind all of it** as one continuous layer: an opaque `bg-black` base hides the scrolling feed, the blurred glow (`z-0`, `h-100`) floats above the base but below all content, and the content sits in a `relative z-10` wrapper — so the glow reads as light behind the header + leagues and never paints on top of any element. `overflow-hidden` clips the glow's blurred tail at the header's bottom edge so it can't bleed onto the feed (in either the expanded or collapsed state). The leagues row folds away on scroll-down / reappears on scroll-up (see the scroll-direction entry above). Merging removed the old measured-`topbarH` offset entirely (a single container needs none).
- **Mobile collapse fixes** — `overscroll-behavior-y: none` on html/body kills pull-to-refresh on the collapse swipe; `touch-action: none` on the expanded slip (added because the collapse drag uses `dragControls`/`dragListener=false`, so Framer doesn't auto-apply it) lets the downward drag grab instead of the browser scrolling.
- **Floating-card dismissal fixes (`SuccessEntrySheet` + `BetSlipFullSheet`)** — both draggable cards were missing the `touch-action: none` that the expanded slip already has, so on mobile the browser ate the swipe-down (pointercancel) and the card couldn't be swiped closed; a cancelled drag springs back open, leaving the card covering the feed. Fix: `touchAction: 'none'` on the draggable card + `touchAction: 'pan-y'` on the internal `data-scroll` selections list (so it still scrolls on touch). Also hardened teardown: the overlay's `pointerEvents` is now `isPresent ? overlayPE : 'none'` — the instant a close is committed the WHOLE overlay goes click-through, so it can never keep blocking interactions during/after the close animation (backed by the existing 600ms `safeToRemove` fallback unmount).
- **Entry-count badge** (Figma "navbarFooter" 33563:154460) — the "Entry counter": `#3d3d3d` pill, 2px `#191919` ring, bold white count at the icon's top-right; squash-stretch pop on appear (CSS `badgePop`, keyed per entry) + fade-out after a 5s window. **The old post-entry action row (reuse/share/discard buttons) is REMOVED** — those actions now live inside the floating success card (`SuccessEntrySheet`), so the ticket flow shows only the ticket + the count badge. `promptOpen`/`promptMounted` state + the `promptIn` keyframe are gone.
- **Backup branch `betslip-morph-v1`** — snapshot of the pre-liquid-glass (cross-fade) morph iteration.
- **Progression animations switched OFF on `main`** via the `cfg.animationsEnabled` master switch (see section above). The animated version is preserved on the `bet-slip-progression` branch. New "One Click Bet" explorations build on the static baseline.
- **T4 "Legendario" tier** added (≥ 50x). On `main`: boosted outer glow, white drop-shadow on all four numbers, denser edge-flash sparkles, faster + denser fire-sparks, more pronounced breath (amplitude 0.020 / 2200ms). Shake intentionally **excluded** on `main` (stays parked on `tier_4` branch).
- **OddsRipple** (`src/OddsRipple.tsx`) — T3+ ghost-text ripple on every selection add; pairs with a synchronized white drop-shadow flash on the source.
- **Italic typography at T3+** — the four bet-slip numbers switch to Red Hat Display Black Italic (matches Figma "Buscador" component).
- **Two parked exploration branches:** `odds-effect` (fire-sparks inflow direction — attracted from all sides), `explorations` (Magic UI shimmer-border via conic-gradient).

---

*If something significant about this project changes — architecture, file purposes, branch model, conventions, gotchas — update this file in the same commit.*
