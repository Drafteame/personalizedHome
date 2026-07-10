import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tierForOdds, type ButtonLiveState } from './ButtonPreviewMomios';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { playSelectionHaptic, playTierCrossingHaptic } from './haptics';
import { HomeScreenChrome, MOCK_PICKS, Navbar } from './HomeScreen';
import closeIcon from './assets/close.svg';
import compartirIcon from './assets/compartir.svg';
import reusarIcon from './assets/reusar.svg';
import { BetSlipFullSheet } from './BetSlipFullSheet';
import { BetSlipSheet } from './BetSlipSheet';
import { EntryCreatedOverlay } from './EntryCreatedOverlay';
import { SuccessEntrySheet } from './SuccessEntrySheet';
import type { Selection, Tier } from './types';

// Lightning bet: how long the pressed pick shows its selected state before the
// entry-creation animation starts.
const LIGHTNING_SELECT_MS = 320;

/* ============================================================ */
/*  Debug overlay helpers                                        */
/* ============================================================ */
function PhaseBar({ label, value }: { label: string; value: number }) {
  // Render a 0..1 motion phase as a thin progress strip.
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-[36px] text-[9px] uppercase tracking-wider text-amber-300/80">
        {label}
      </span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-300/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Debug flags from URL                                         */
/* ============================================================ */
function useDebug() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  }, []);
}

/* ============================================================ */
/*  Cumulative odds = multiplicative product of selections      */
/* ============================================================ */
function computeCumulativeOdds(selections: Selection[]): number {
  if (selections.length === 0) return 0;
  return selections.reduce((acc, s) => acc * s.odds, 1);
}

/* ============================================================ */
/*  Pre-built selection sets that land cleanly inside each tier  */
/*  Used by the debug jump-to-tier buttons.                      */
/* ============================================================ */
function selectionsForTier(target: Tier): Selection[] {
  // Hand-picked combos so each tier renders with a representative
  // odds value squarely inside its range (no overshoot into the next).
  const byId = (id: string) => MOCK_PICKS.find((p) => p.id === id)!;
  const stamp = (picks: Selection[]) =>
    picks.map((p, i) => ({ ...p, id: `${p.id}-${i}` }));

  switch (target) {
    case 0:
      return [];
    case 1:
      // 2.75x — sits in [2.00, 5.00)
      return stamp([byId('rma-w')]);
    case 2:
      // 2.75 * 3.80 = 10.45x — sits in [5.00, 15.00)
      return stamp([byId('rma-w'), byId('draw')]);
    case 3:
      // 2.75 * 3.80 * 1.95 * 2.10 ≈ 42.8x — comfortably > 15.00
      return stamp([byId('rma-w'), byId('draw'), byId('lewa'), byId('vini')]);
    case 4:
      // 2.75 * 3.80 * 9.00 ≈ 94.05x — comfortably > 50.00
      return stamp([byId('rma-w'), byId('draw'), byId('mbappe-htrick')]);
  }
}

export function App() {
  const debug = useDebug();
  // MASTER SWITCH — see cfg.animationsEnabled. OR-ing it here suppresses the
  // T4 Siri vignette rotation (and, via the opacity gate below, the vignette
  // itself) alongside the OS-level reduced-motion preference.
  const reducedMotion =
    useReducedMotion() || !buttonProgressionConfig.animationsEnabled;
  const [selections, setSelections] = useState<Selection[]>([]);
  const [speedScale, setSpeedScale] = useState(1);
  const [live, setLive] = useState<ButtonLiveState | null>(null);
  // PASS 3 — Tier 3 odds effect selector (default flames; toggled in debug).
  const [tier3OddsEffect, setTier3OddsEffect] = useState<
    'flames' | 'smoke'
  >(buttonProgressionConfig.tier3OddsEffect);
  // PASS 3 — "Bouncy entry only on FIRST mount per session". Once the bet
  // slip has mounted (and started its bounce) once, this flips to true and
  // subsequent 0 → 1 transitions skip the bounce.
  const hasBouncedOnceRef = useRef(false);

  // Bet-slip view state. On any NEW selection the sheet expands; swiping it
  // down (or 4s of inactivity) morphs it back to the collapsed pill; tapping
  // the collapsed pill re-expands.
  const [expanded, setExpanded] = useState(false);
  // Full-screen "Resumen de tu entrada" sheet (opened from the Lista tab).
  const [listOpen, setListOpen] = useState(false);
  // Swipe-to-confirm success sequence: green "Entrada creada" card + ticket
  // fly into Mis entradas, then the "¿Reusar?" prompt + count badge.
  const [success, setSuccess] = useState(false);
  // NEW success flow (swipe-to-confirm from the summarized slip OR the floating
  // card): opens the "¡Entrada creada!" SuccessEntrySheet instead of the flying
  // ticket. The selections stay mounted so the sheet can list them; they're
  // cleared on "Entrada nueva" and kept on "Reusar". (Lightning still uses the
  // ticket via `success`.)
  const [entrySheet, setEntrySheet] = useState(false);
  // Lightning bet in progress — the pressed pick is added (so its button shows
  // the selected state) but the slip is suppressed; the entry is created a
  // beat later. See lightningBet().
  const [lightning, setLightning] = useState(false);
  const [entryCount, setEntryCount] = useState(0);
  const [entryBump, setEntryBump] = useState(0); // Mis entradas icon "catch" bump
  // Navbar compresses to an icon-only row while scrolling DOWN through the
  // offer, and springs back to full size on any scroll UP (or near the top).
  // The same signal collapses the leagues row (in HomeScreenChrome).
  // `lastScrollTopRef` holds the previous scrollTop so we can read direction.
  // `navLockRef` holds a timestamp until which direction flips are ignored:
  // collapsing the leagues row shrinks the scroll content, which fires reflow
  // scroll events in the OPPOSITE direction — without the lock those flip the
  // state straight back and the bars twitch. The lock spans the 250ms morph.
  const [navCompact, setNavCompact] = useState(false);
  const lastScrollTopRef = useRef(0);
  const navLockRef = useRef(0);
  const [promptOpen, setPromptOpen] = useState(false);
  // Entry-count badge over "Mis entradas": appears on each new entry, holds
  // 10s, then hides. Re-shown (timer reset) every time the count changes.
  const [badgeVisible, setBadgeVisible] = useState(false);
  // Post-entry: the count badge AND the action buttons appear together and
  // auto-hide TOGETHER after 5s of no interaction. One timer per entry, so
  // they disappear at the same moment.
  useEffect(() => {
    if (entryCount === 0) return;
    setBadgeVisible(true);
    const t = setTimeout(() => {
      setBadgeVisible(false);
      setPromptOpen(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [entryCount]);

  // Keep the action buttons mounted through a fade-out before unmounting —
  // same treatment as the badge, so both ease out instead of popping.
  const promptShown = promptOpen && selections.length === 0;
  const [promptMounted, setPromptMounted] = useState(false);
  useEffect(() => {
    if (promptShown) {
      setPromptMounted(true);
      return;
    }
    const t = setTimeout(() => setPromptMounted(false), 250); // after fade-out
    return () => clearTimeout(t);
  }, [promptShown]);
  // Bumped on swipe-to-confirm interaction to defer the auto-collapse timer.
  const [keepAliveNonce, setKeepAliveNonce] = useState(0);
  const prevCountRef = useRef(0);
  useEffect(() => {
    const count = selections.length;
    // On growth: the summarized slip only applies to 1–2 selections. Once a 3rd
    // is added the summarized slip auto-collapses to the pill — the user then
    // taps the pill to open the "Resumen" floating card (see onExpand below).
    if (count > prevCountRef.current) setExpanded(count <= 2);
    // No selections → nothing to show; reset for the next session.
    if (count === 0) setExpanded(false);
    prevCountRef.current = count;
  }, [selections.length]);

  // AUTO-COLLAPSE — once expanded, if the user only browses/scrolls (no new
  // selection, no swipe-to-confirm interaction) for 10s, morph back to the
  // collapsed pill. Resets when a selection is added/removed (selections
  // length changes) or the swipe thumb is touched (keepAliveNonce bumps).
  useEffect(() => {
    if (!expanded) return;
    const t = setTimeout(() => setExpanded(false), 10000);
    return () => clearTimeout(t);
  }, [expanded, selections.length, keepAliveNonce]);

  const selectedIds = useMemo(
    () => new Set(selections.map((s) => s.id)),
    [selections],
  );
  const cumulativeOdds = useMemo(
    () => computeCumulativeOdds(selections),
    [selections],
  );
  const tier: Tier = tierForOdds(cumulativeOdds);

  /* ---------- handlers ---------- */
  // REGRESSION FIX — removed `queueMicrotask` ref-flipping from setSelections
  // updaters. The microtask was firing BEFORE React re-rendered with the new
  // state, so BetSlipShell mounted with bouncy=false on its very first mount.
  // The ref is now flipped via BetSlipShell's onMounted callback (below).
  const addRandom = useCallback(() => {
    if (selections.length >= buttonProgressionConfig.maxSelections) return;
    const available = MOCK_PICKS.filter(
      (p) => !selections.some((s) => s.id.startsWith(p.id)),
    );
    const pool = available.length > 0 ? available : MOCK_PICKS;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setSelections((s) => [...s, { ...next, id: `${next.id}-${s.length}` }]);
    // HAPTIC — light selection tick on add. No-op on iOS Safari.
    playSelectionHaptic();
  }, [selections]);

  const togglePick = useCallback((id: string) => {
    // HAPTIC — light selection tick on every toggle (add OR remove). The
    // user's finger has already done the work; the haptic confirms it.
    // No-op on iOS Safari (no Web Haptics API in 2026).
    playSelectionHaptic();
    setSelections((current) => {
      const existing = current.find((s) => s.id.startsWith(id));
      if (existing) return current.filter((s) => s !== existing);
      if (current.length >= buttonProgressionConfig.maxSelections) return current;
      const pick = MOCK_PICKS.find((p) => p.id === id);
      if (!pick) return current;
      return [...current, { ...pick, id: `${pick.id}-${current.length}` }];
    });
  }, []);

  const removeLast = useCallback(() => {
    setSelections((s) => {
      if (s.length === 0) return s;
      // HAPTIC — same light tick as toggle/add so removal feels consistent.
      playSelectionHaptic();
      return s.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => setSelections([]), []);

  const jumpToTier = useCallback((target: Tier) => {
    setSelections(selectionsForTier(target));
  }, []);

  // Remove a single selection from the semi-expanded slip (× on its row).
  const removeSelection = useCallback((id: string) => {
    playSelectionHaptic();
    setSelections((s) => s.filter((sel) => sel.id !== id));
  }, []);

  // Place the bet from the semi-expanded slip (swipe-to-confirm). Prototype
  // behavior: clear the slip, as a placed bet would. Wire to real
  // bet-placement here when a backend exists.
  // Swipe-to-confirm (summarized slip OR floating card) → open the new
  // "¡Entrada creada!" success sheet. The floating card (if open) closes and the
  // slip collapses; the success sheet grows out of the slip footprint. The
  // selections stay mounted so the sheet can list them.
  const confirmBet = useCallback(() => {
    setListOpen(false);
    setExpanded(false);
    setEntrySheet(true);
  }, []);

  // Entrada nueva / swipe-down / backdrop-tap on the success sheet → record the
  // entry, clear the slip, and return Home.
  const successNewEntry = useCallback(() => {
    setEntrySheet(false);
    setSelections([]);
    setExpanded(false);
    setEntryCount((c) => c + 1);
    setEntryBump((n) => n + 1);
  }, []);

  // Reusar → record the entry but KEEP the selections so a fresh slip rebuilds
  // (the sheet shrinks back into the re-mounted pill).
  const successReuse = useCallback(() => {
    setEntrySheet(false);
    setEntryCount((c) => c + 1);
    setEntryBump((n) => n + 1);
  }, []);

  // LIGHTNING STRAIGHT BET — long-press a pick to create the entry instantly.
  // First applies the SELECTED state to the pressed pick (add it, so its button
  // lights up) while suppressing the slip via `lightning`; a beat later plays
  // only the green success animation. `finishEntryCreated` then runs the usual
  // post-entry actions (badge bump, count, "¿Reusar?" prompt) and clears it.
  const lightningBet = useCallback((id: string) => {
    const pick = MOCK_PICKS.find((p) => p.id === id);
    if (!pick) return;
    playSelectionHaptic();
    setListOpen(false);
    setExpanded(false);
    setLightning(true);
    setSelections([{ ...pick, id: `${pick.id}-0` }]); // button → selected
    // Hold the selected state briefly, then create the entry.
    window.setTimeout(() => setSuccess(true), LIGHTNING_SELECT_MS);
  }, []);

  // Fired when the green ticket has flown into Mis entradas.
  const finishEntryCreated = useCallback(() => {
    setSuccess(false);
    setLightning(false);
    setSelections([]);
    setExpanded(false);
    setEntryCount((c) => c + 1);
    setPromptOpen(true);
  }, []);

  /* ---------- tier-crossing haptic ---------- */
  // Watch `tier` for changes. On any transition between adjacent tiers
  // (or jumps spanning multiple at once via the debug buttons), fire a
  // medium-impact haptic. Skip the initial mount so we don't vibrate on
  // page load. No-op on iOS Safari.
  const prevTierRef = useRef<Tier>(tier);
  useEffect(() => {
    if (prevTierRef.current !== tier) {
      playTierCrossingHaptic();
      prevTierRef.current = tier;
    }
  }, [tier]);

  // Map selected pick ids back to base ids (without -N suffix) for the
  // market accordion so it can highlight which picks are in the slip.
  const baseSelectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const sel of selections) {
      // id format: "psg-w-0" -> base "psg-w"
      const lastDash = sel.id.lastIndexOf('-');
      s.add(sel.id.slice(0, lastDash));
    }
    return s;
  }, [selections]);

  // Whether the bet slip (collapsed pill OR expanded summarized card) is on
  // screen. Drives BOTH the slip mount and the size of the dark gradient
  // behind the navbar: the gradient only needs to extend up far enough to
  // separate the slip from the content when the slip is present. When it's
  // absent, the reserved slot collapses so the gradient shrinks to just the
  // navbar band.
  const betSlipVisible =
    selections.length > 0 && !lightning && !success && !entrySheet;

  /* ============================================================ */
  /*  Render                                                      */
  /* ============================================================ */
  return (
    // RESPONSIVE LAYOUT — split at 431px (phone-only breakpoint).
    //   ≤ 430px  (real mobile browsers): full-bleed, no mockup chrome.
    //                                    Inner fills 100dvh × 100vw, square
    //                                    corners, no bezel, no shadow, notch
    //                                    hidden (real device has its own).
    //                                    430 is the widest current iPhone
    //                                    portrait width (14 Pro Max / 15
    //                                    Pro Max / 16 Pro Max), so the
    //                                    cutoff fires at 431+ to make sure
    //                                    those devices land in mobile mode.
    //   ≥ 431px  (desktop demo + tablets): 390×844 phone mockup centered
    //                                      with bezel, rounded corners,
    //                                      shadow, notch — preserves the
    //                                      original desktop preview.
    //   ≥ 640px  (sm): extra outer padding so the mockup floats away
    //                  from the viewport edges.
    // 100dvh (dynamic viewport height) accounts for iOS Safari's URL bar
    // expand/collapse — uses the *current* viewport so the navbar doesn't
    // get pushed under browser chrome.
    <div className="flex min-h-[100dvh] w-full items-stretch justify-center min-[431px]:items-center min-[431px]:p-2 min-[640px]:p-6">
      {/* Phone frame */}
      <div className="relative w-full min-[431px]:w-auto">
        <div className="min-[431px]:rounded-[44px] min-[431px]:bg-black/40 min-[431px]:p-3 min-[431px]:shadow-[0_30px_80px_rgba(75,32,255,0.25)] min-[431px]:ring-1 min-[431px]:ring-white/10">
          <div
            className="relative h-[100dvh] w-full overflow-hidden min-[431px]:h-[844px] min-[431px]:w-[390px] min-[431px]:rounded-[36px]"
            style={{
              // Matches the Figma newLeagueMarkets card bg (#000000) so the
              // chrome around the card and the card itself read as one
              // continuous surface. The outer bezel (`bg-black/40` above)
              // is a stylistic phone-mockup frame; leave it.
              background: '#000000',
            }}
          >
            {/* Notch — desktop mockup only. On real mobile the device has
                its own physical notch / dynamic island, so we hide ours. */}
            <div className="absolute left-1/2 top-2 z-30 hidden h-6 w-28 -translate-x-1/2 rounded-full bg-black min-[431px]:block" />

            {/* T4 SIRI-STYLE VIGNETTE.
                Multi-color perimeter glow modeled on iOS 26 Siri
                activation. A heavily-blurred conic gradient with
                Apple-Intelligence-style colors (pink/magenta, purple,
                blue-purple, warm amber) rotates around the screen.
                A radial mask keeps the gradient clipped to the
                perimeter — inner 55% of the radius stays transparent
                so the markets/offers in the center column are
                untouched.

                Structure:
                  outer motion.div = the mask layer + fade-in opacity
                  inner motion.div = the rotating conic gradient

                The inner div is sized at 200% × 200% with inset -50%
                so rotation never reveals empty corners.

                Sits at z-[15] — ABOVE scrollable content (z-10) so it
                tints the edges of the cards, but BELOW the bet slip +
                navbar (z-20) so the CTA stays at full brightness.

                Tunables live at `cfg.tier4.vignette`. */}
            <motion.div
              aria-hidden
              className="vignette-shape-breathe pointer-events-none absolute inset-0 z-[15]"
              style={{
                overflow: 'hidden',
                // The radial mask is built from CSS custom properties
                // declared in src/index.css (.vignette-shape-breathe).
                // Those properties oscillate over an 18s loop so the
                // mask's ellipse subtly morphs (width, height, center,
                // and inner-stop each animate on slightly different
                // phases). Same trick the iOS 26 Siri activation uses
                // — continuous color rotation + organic shape morph.
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity:
                  tier === 4 && !reducedMotion
                    ? buttonProgressionConfig.tier4.vignette.opacityMax
                    : 0,
              }}
              transition={{
                duration:
                  buttonProgressionConfig.tier4.vignette.fadeInMs / 1000,
                ease: 'easeOut',
              }}
            >
              <motion.div
                style={{
                  position: 'absolute',
                  inset: '-50%',
                  width: '200%',
                  height: '200%',
                  // Conic gradient using the SAME two-color palette as
                  // the bet-slip outer glow swirl (see .outer-glow-swirl
                  // in src/index.css): #4e7bff (blue) alternating with
                  // #9730ff (purple). 5 stops at 90deg intervals create
                  // two visible "color crests" of each hue as the
                  // gradient rotates — so two waves of blue→purple
                  // sweep across the perimeter per rotation. Keeps the
                  // vignette tonally locked to the button's own glow
                  // so the screen edges and the bet slip read as one
                  // color system.
                  backgroundImage:
                    'conic-gradient(from 0deg, #4e7bff, #9730ff, #4e7bff, #9730ff, #4e7bff)',
                  // Heavy blur so the conic reads as soft light, not
                  // hard-edged color wedges.
                  filter: 'blur(40px)',
                  // Hardware-accelerate the rotation so it stays
                  // smooth on mobile.
                  willChange: 'transform',
                }}
                animate={
                  tier === 4 && !reducedMotion ? { rotate: 360 } : { rotate: 0 }
                }
                transition={
                  tier === 4 && !reducedMotion
                    ? {
                        // 16-second full rotation — slow enough to feel
                        // meditative, fast enough that the colors are
                        // visibly moving when the user looks at the screen.
                        duration: 16,
                        repeat: Infinity,
                        ease: 'linear',
                      }
                    : { duration: 0.3 }
                }
              />
            </motion.div>

            {/* Top decorative light moved into the sticky topbar
                (HomeScreenChrome) so it stays with the pinned header. */}

            {/* Scrollable content area */}
            <div
              className="no-scrollbar absolute inset-0 z-10 overflow-y-auto pb-[160px]"
              onScroll={(e) => {
                const st = e.currentTarget.scrollTop;
                const delta = st - lastScrollTopRef.current;
                lastScrollTopRef.current = st;
                // Ignore scroll events during the post-toggle lock window so
                // the collapse-driven reflow can't flip the state back.
                if (Date.now() < navLockRef.current) return;
                let next: boolean | null = null;
                if (st <= 8) next = false; // full near the top
                else if (delta > 8) next = true; // scrolling down
                else if (delta < -8) next = false; // scrolling up
                if (next === null) return;
                const target = next;
                setNavCompact((c) => {
                  if (c !== target) navLockRef.current = Date.now() + 320;
                  return target;
                });
              }}
            >
              <HomeScreenChrome
                picks={MOCK_PICKS}
                selectedIds={baseSelectedIds}
                onTogglePick={togglePick}
                onLightningBet={lightningBet}
                headerCollapsed={navCompact}
              />
              {/* Debug controls inline (only visible with ?debug=true) */}
              {debug && (
                <div className="mx-3 mb-2 mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                  <div className="mb-2 text-[11px] font-bold text-amber-300">
                    DEBUG · jump to tier
                  </div>
                  <div className="mb-2 flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((t) => (
                      <button
                        key={t}
                        onClick={() => jumpToTier(t as Tier)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${
                          tier === t
                            ? 'bg-amber-300 text-black'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        T{t}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSpeedScale((s) => (s === 1 ? 3 : 1))}
                    className="w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    Animation speed: {speedScale === 1 ? '1× normal' : '3× slow'}
                  </button>
                  {/* Debug — fire the swipe-to-confirm success flow without the
                      drag gesture (opens the SuccessEntrySheet). */}
                  <button
                    onClick={confirmBet}
                    disabled={selections.length === 0}
                    className="mt-1.5 w-full rounded-md bg-emerald-500/80 px-2 py-1.5 text-[11px] font-bold text-black disabled:opacity-40"
                  >
                    ▶ Simular confirmación
                  </button>
                  {/* PASS 3 — Tier 3 odds effect variant toggle. */}
                  <button
                    onClick={() =>
                      setTier3OddsEffect((e) =>
                        e === 'flames' ? 'smoke' : 'flames',
                      )
                    }
                    className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    T3 odds effect: {tier3OddsEffect === 'flames' ? '🔥 flames' : '💨 smoke'}
                  </button>
                </div>
              )}

              {/* Action controls — Add / Remove / Reset */}
              <div className="mx-3 mb-2 mt-3 flex gap-2">
                <button
                  onClick={addRandom}
                  disabled={
                    selections.length >= buttonProgressionConfig.maxSelections
                  }
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#4b20ff] to-[#9730ff] px-3 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  + Añadir selección
                </button>
                <button
                  onClick={removeLast}
                  disabled={selections.length === 0}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white/90 disabled:opacity-30"
                >
                  − Quitar
                </button>
                <button
                  onClick={reset}
                  disabled={selections.length === 0}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white/90 disabled:opacity-30"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Fixed bottom: gradient fade + button slot + navbar.
                PASS 3 — The bet slip is now conditionally mounted via
                AnimatePresence (mode="wait" queues the entry until any
                in-flight exit finishes). A reserved-height slot keeps the
                navbar pinned even when the button is unmounted.

                RESPONSIVE — pb-safe-bottom uses env(safe-area-inset-bottom)
                so on iOS phones with a home indicator the navbar floats
                above it instead of being half-obscured. No-op on desktop
                (the env value is 0) and on devices without a home
                indicator. */}
            <div
              className="absolute inset-x-0 bottom-0 z-20"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Upper fade above the bet-slip area.
                  T0-T3: full 0.8 → transparent to anchor the slip
                         visually against the markets above.
                  T4:    much softer (0.35 max) so the dark backdrop
                         doesn't compete with the Siri vignette's
                         colored perimeter bloom — at T4 the vignette
                         alone provides plenty of perimeter framing,
                         and pushing the dark backdrop to full strength
                         creates a visible rectangular "panel" on top
                         of the colored bloom. */}
              <div
                className="pointer-events-none absolute inset-x-0 -top-10 h-10"
                style={{
                  background:
                    tier === 4
                      ? 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)'
                      : 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                }}
              />
              <div
                className="relative"
                style={{
                  // Same tier-conditional rule as the upper fade above
                  // — the lower gradient softens at T4 so it doesn't
                  // read as a rectangular panel against the rotating
                  // vignette colors. Start opacity matches the upper
                  // fade's end opacity so there's never a discontinuity
                  // at the boundary regardless of tier.
                  background:
                    tier === 4
                      ? 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)'
                      : 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
                  // Smooth-fade the gradient swap during tier change so
                  // the dark backdrop fades up/down with the vignette
                  // rather than snapping.
                  transition: 'background 700ms ease-out',
                }}
              >
                {/* Reserved-height slot. The slip is anchored to its BOTTOM
                    (against the navbar), so this height only controls how far
                    the dark gradient extends ABOVE the slip. It reserves the
                    full height while the slip (or the post-success prompt) is
                    on screen — giving the gradient enough reach to separate
                    the slip from the content — and collapses to 0 otherwise so
                    the gradient shrinks to just the navbar band. */}
                <div
                  className="relative transition-[height] duration-300 ease-out"
                  style={{
                    height:
                      betSlipVisible || promptMounted
                        ? buttonProgressionConfig.slotReservedHeightPx
                        : 0,
                  }}
                >
                  {/* BET SLIP — a single morphing sheet (collapsed pill ↔
                      expanded card). Anchored to the slot's bottom baseline;
                      overflows upward when expanded. The 8px gap above the
                      navbar comes from the pill's own pb-2 (collapsed) and the
                      glass card's bottom-2 inset (expanded). Only one bet-slip
                      element ever exists, so nothing shows behind it. */}
                  <div className="absolute inset-x-0 bottom-0 z-10">
                    <AnimatePresence>
                      {betSlipVisible && (
                        <BetSlipSheet
                          key="bet-slip-sheet"
                          selections={selections}
                          cumulativeOdds={cumulativeOdds}
                          expanded={expanded}
                          onExpand={() =>
                            selections.length > 2
                              ? setListOpen(true)
                              : setExpanded(true)
                          }
                          onCollapse={() => setExpanded(false)}
                          onRemove={removeSelection}
                          onConfirm={confirmBet}
                          onKeepAlive={() => setKeepAliveNonce((n) => n + 1)}
                          onOpenList={() => setListOpen(true)}
                        />
                      )}
                    </AnimatePresence>

                    {/* Post-success "¿Reusar o compartir tu entrada?" prompt —
                        shown once an entry is created (slip gone). */}
                    {promptMounted && (
                      <div
                        key={entryCount}
                        className={`absolute inset-x-0 bottom-3 flex items-center justify-between gap-2 px-4 transition-opacity duration-200 ease-out ${
                          promptShown
                            ? 'opacity-100 animate-[promptIn_0.4s_ease-out]'
                            : 'opacity-0'
                        }`}
                        style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                      >
                        {/* Post-entry actions — Figma "entry actions"
                            (33563:154461): text + reuse/share pill buttons, a
                            divider, then the discard (×) button. All three are
                            44px circles: #191919 fill, rgba(251,251,251,0.16)
                            border, 20px icons. */}
                        <p className="w-[127px] text-[14px] font-normal leading-[21px] text-[#fbfbfb]">
                          ¿Reusar o compartir tu entrada?
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            aria-label="Reusar entrada"
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={reusarIcon} alt="" className="size-5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Compartir entrada"
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={compartirIcon} alt="" className="size-5" />
                          </button>
                          <div className="h-[21px] w-px bg-[rgba(251,251,251,0.16)]" />
                          <button
                            type="button"
                            aria-label="Descartar"
                            onClick={() => setPromptOpen(false)}
                            className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,251,251,0.16)] bg-[#191919] transition-transform active:scale-95"
                          >
                            <img src={closeIcon} alt="" className="size-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <Navbar
                  entryCount={entryCount}
                  bump={entryBump}
                  badgeVisible={badgeVisible}
                  compact={navCompact}
                />
              </div>
            </div>

            {/* Full-screen "Resumen de tu entrada" sheet — opens from the
                parlay Lista tab; swipe down or × closes it and collapses the
                bet slip. */}
            <AnimatePresence>
              {listOpen && selections.length > 0 && (
                <BetSlipFullSheet
                  key="bet-slip-full-sheet"
                  selections={selections}
                  cumulativeOdds={cumulativeOdds}
                  onRemove={removeSelection}
                  onClearAll={() => {
                    setSelections([]);
                    setListOpen(false);
                  }}
                  onClose={() => {
                    setListOpen(false);
                    setExpanded(false);
                  }}
                  onConfirm={confirmBet}
                />
              )}
            </AnimatePresence>

            {/* Swipe-to-confirm success — green "Entrada creada" card that
                flies into Mis entradas, then finishEntryCreated() pops the
                badge + "¿Reusar?" prompt. Used ONLY by the lightning bet now;
                swipe-to-confirm opens the SuccessEntrySheet below. */}
            {success && (
              <EntryCreatedOverlay
                onCatch={() => setEntryBump((n) => n + 1)}
                onDone={finishEntryCreated}
              />
            )}

            {/* "¡Entrada creada!" success sheet — opened by swipe-to-confirm
                from the summarized slip or the floating card. Grows out of the
                slip footprint (same morph as BetSlipFullSheet). */}
            <AnimatePresence>
              {entrySheet && selections.length > 0 && (
                <SuccessEntrySheet
                  key="success-entry-sheet"
                  selections={selections}
                  cumulativeOdds={cumulativeOdds}
                  onNewEntry={successNewEntry}
                  onReuse={successReuse}
                />
              )}
            </AnimatePresence>

            {/* Debug overlay (tier badge + live ambient phases) */}
            {debug && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-2 bottom-[170px] z-40 w-[156px] rounded-lg border border-amber-400/40 bg-black/85 px-2.5 py-1.5 text-left"
              >
                <div className="text-[9px] font-bold uppercase tracking-widest text-amber-300">
                  Debug
                </div>
                <div className="text-[12px] font-black text-white">
                  Tier {tier} · {buttonProgressionConfig.tiers[tier].name}
                </div>
                <div className="text-[10px] font-medium text-white/70">
                  Odds {cumulativeOdds.toFixed(2)}x
                </div>
                <div className="text-[10px] font-medium text-white/70">
                  {selections.length} / {buttonProgressionConfig.maxSelections} picks
                </div>
                {/* Live phase readouts — driven by ButtonPreviewMomios useMotionValueEvent */}
                <div className="mt-1 flex items-center justify-between border-t border-amber-400/20 pt-1">
                  <span className="text-[9px] uppercase tracking-wider text-amber-300/80">
                    Tremor
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      live?.tremorActive ? 'bg-amber-300' : 'bg-white/20'
                    }`}
                  />
                </div>
                <PhaseBar label="Glow" value={live?.borderPhase ?? 0} />
                <PhaseBar label="Breath" value={live?.breathPhase ?? 0} />
                {/* T3 odds effect toggle — pinned here so it's always reachable */}
                <button
                  onClick={() =>
                    setTier3OddsEffect((e) =>
                      e === 'flames' ? 'smoke' : 'flames',
                    )
                  }
                  className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-white"
                >
                  T3: {tier3OddsEffect === 'flames' ? '🔥 flames' : '💨 smoke'}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
