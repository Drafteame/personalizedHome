import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tierForOdds, type ButtonLiveState } from './ButtonPreviewMomios';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { playSelectionHaptic, playTierCrossingHaptic } from './haptics';
import { HomeScreenChrome, MOCK_PICKS, Navbar } from './HomeScreen';
import { BetSlipFullSheet } from './BetSlipFullSheet';
import { BetSlipSheet } from './BetSlipSheet';
import { EntryCreatedOverlay } from './EntryCreatedOverlay';
import { SuccessEntrySheet } from './SuccessEntrySheet';
import type { Selection, Tier } from './types';

// Lightning bet: how long the pressed pick shows its selected state before the
// entry-creation animation starts.
const LIGHTNING_SELECT_MS = 320;

// Default entry amount (whole pesos). The stake lives here as the single source
// of truth so it stays in sync across the summarized slip, the floating card and
// the success sheet; the numeric keypad edits it. Reset to this on a new entry.
const DEFAULT_STAKE = 200;

// The navbar-area dark treatment is structural framing, not a bet-slip effect.
// Keep it stable while selections, odds tiers, and slip height change.
const NAVBAR_UPPER_FADE = 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)';
const NAVBAR_BACKDROP =
  'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)';
const SUMMARY_ODDS_CHANGE_PREF_KEY =
  'one-click-bet.summary-slip.accept-odds-change-hidden';

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

function readSummaryOddsChangeHiddenPreference() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SUMMARY_ODDS_CHANGE_PREF_KEY) === 'true';
  } catch {
    return false;
  }
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

/* ============================================================ */
/*  SGP-mix demo set — used by the debug "Mezcla SGP" button.    */
/*  A representative slip that exercises same-game-parlay         */
/*  grouping: two SGP blocks (PSG·RMA ×3, ARS·RMA ×2) plus two    */
/*  standalone picks from other matches (FCB·PSG, LIV·MCI).       */
/* ============================================================ */
function sgpMixSelections(): Selection[] {
  const byId = (id: string) => MOCK_PICKS.find((p) => p.id === id)!;
  const picks = [
    byId('rma-w'), byId('lewa'), byId('mbappe'), // PSG vs RMA → SGP
    byId('ars-w'), byId('ars-saka'), // ARS vs RMA → SGP
    byId('fcb-w'), // Barcelona vs PSG → standalone
    byId('liv-w'), // Liverpool vs Man City → standalone
  ];
  return picks.map((p, i) => ({ ...p, id: `${p.id}-${i}` }));
}

export function App() {
  const debug = useDebug();
  // MASTER SWITCH — see cfg.animationsEnabled. OR-ing it here suppresses the
  // T4 Siri vignette rotation (and, via the opacity gate below, the vignette
  // itself) alongside the OS-level reduced-motion preference.
  const reducedMotion =
    useReducedMotion() || !buttonProgressionConfig.animationsEnabled;
  const [selections, setSelections] = useState<Selection[]>([]);
  // Entry amount (shared across both bet-slip views + the success sheet). Edited
  // via the numeric keypad; reset to the default on each new entry.
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [summaryOddsChangeHidden, setSummaryOddsChangeHidden] = useState(
    readSummaryOddsChangeHiddenPreference,
  );
  const [summaryOddsChangeChecked, setSummaryOddsChangeChecked] = useState(false);
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
  // Whether ticket completion must preserve the CURRENT selections. Reusar
  // keeps the placed slip; Entrada nueva clears it immediately, then also sets
  // this flag so picks made while the decorative ticket is flying are not
  // erased when its delayed onDone callback arrives. Lightning leaves it false.
  const preserveSelectionsOnFinishRef = useRef(false);
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
  // Entry-count badge over "Mis entradas": appears on each new entry, holds
  // 5s, then hides. Re-shown (timer reset) every time the count changes. (The
  // old "¿Reusar o compartir?" action row that used to appear alongside it is
  // gone — those actions now live inside the floating success card.)
  const [badgeVisible, setBadgeVisible] = useState(false);
  useEffect(() => {
    if (entryCount === 0) return;
    setBadgeVisible(true);
    const t = setTimeout(() => setBadgeVisible(false), 5000);
    return () => clearTimeout(t);
  }, [entryCount]);

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
  const togglePick = useCallback((id: string) => {
    // HAPTIC — light selection tick on every toggle (add OR remove). The
    // user's finger has already done the work; the haptic confirms it.
    // No-op on iOS Safari (no Web Haptics API in 2026).
    playSelectionHaptic();
    setSelections((current) => {
      const existing = current.find((s) => s.id.startsWith(id));
      if (existing) return current.filter((s) => s !== existing);
      const pick = MOCK_PICKS.find((p) => p.id === id);
      if (!pick) return current;
      return [...current, { ...pick, id: `${pick.id}-${current.length}` }];
    });
  }, []);

  const jumpToTier = useCallback((target: Tier) => {
    setSelections(selectionsForTier(target));
  }, []);

  // Remove a single selection from the semi-expanded slip (× on its row).
  const removeSelection = useCallback((id: string) => {
    playSelectionHaptic();
    setSelections((s) => s.filter((sel) => sel.id !== id));
  }, []);

  // Remove every selection from one match (× on an SGP group header).
  const removeGroup = useCallback((matchId: string) => {
    playSelectionHaptic();
    setSelections((s) => s.filter((sel) => sel.matchId !== matchId));
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

  const persistSummaryOddsChangePreference = useCallback(() => {
    if (!summaryOddsChangeChecked) return;
    setSummaryOddsChangeHidden(true);
    try {
      window.localStorage.setItem(SUMMARY_ODDS_CHANGE_PREF_KEY, 'true');
    } catch {
      // Ignore storage failures; the in-memory flag still hides the row for
      // this session.
    }
  }, [summaryOddsChangeChecked]);

  // Entrada nueva / swipe-down / backdrop-tap on the success sheet → close the
  // card and play the flying-ticket microinteraction. The entry is recorded (+
  // the count badge pops) only once the ticket lands, in finishEntryCreated.
  const successNewEntry = useCallback(() => {
    persistSummaryOddsChangePreference();
    preserveSelectionsOnFinishRef.current = true;
    // Release the offer immediately. Previously the placed selections stayed
    // in state until EntryCreatedOverlay's flight animation called onDone().
    // That made the retained slip look stale even though the success card was
    // already gone. The ticket is purely decorative and pointer-free, so
    // interaction state must not depend on it.
    setSelections([]);
    setStake(DEFAULT_STAKE);
    setEntrySheet(false);
    setExpanded(false);
    setSuccess(true);
  }, [persistSummaryOddsChangePreference]);

  // Reusar → same flying-ticket close, but KEEP the selections so a fresh slip
  // rebuilds once the ticket lands (finishEntryCreated skips the clear).
  const successReuse = useCallback(() => {
    persistSummaryOddsChangePreference();
    preserveSelectionsOnFinishRef.current = true;
    setEntrySheet(false);
    setExpanded(false);
    setSuccess(true);
  }, [persistSummaryOddsChangePreference]);

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
    preserveSelectionsOnFinishRef.current = false;
    setLightning(true);
    setSelections([{ ...pick, id: `${pick.id}-0` }]); // button → selected
    // Hold the selected state briefly, then create the entry.
    window.setTimeout(() => setSuccess(true), LIGHTNING_SELECT_MS);
  }, []);

  // Fired when the green ticket has flown into Mis entradas. Records the entry
  // and pops the tab count badge. NOTE: no "¿Reusar o compartir?" prompt — the
  // reuse/share actions now live inside the floating success card, so the
  // ticket flow shows ONLY the ticket + the count badge.
  const finishEntryCreated = useCallback(() => {
    setSuccess(false);
    setLightning(false);
    // Reusar preserves the placed slip. Entrada nueva already cleared the
    // placed slip synchronously and preserves any picks made during the ticket.
    // Lightning is the only path that still needs completion-time cleanup.
    if (!preserveSelectionsOnFinishRef.current) {
      setSelections([]);
      setStake(DEFAULT_STAKE); // fresh slip → default amount
    }
    preserveSelectionsOnFinishRef.current = false;
    setExpanded(false);
    setEntryCount((c) => c + 1);
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
                  {/* Load a mixed slip that shows SGP grouping: 2 SGP blocks +
                      2 standalone picks from different matches. */}
                  <button
                    onClick={() => setSelections(sgpMixSelections())}
                    className="mt-1.5 w-full rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white"
                  >
                    🎯 Cargar mezcla SGP
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
              {/* Upper fade above the bet-slip area. This structural framing
                  stays identical across tiers and slip states. */}
              <div
                className="pointer-events-none absolute inset-x-0 -top-10 h-10"
                style={{
                  background: NAVBAR_UPPER_FADE,
                }}
              />
              <div
                className="relative"
                style={{
                  background: NAVBAR_BACKDROP,
                  transition: 'background 700ms ease-out',
                }}
              >
                {/* Reserved-height slot. The slip is anchored to its BOTTOM
                    (against the navbar), so this height only controls how far
                    the dark gradient extends ABOVE the slip. It reserves the
                    full height while the slip is on screen — giving the
                    gradient enough reach to separate the slip from the content
                    — and collapses to 0 otherwise so the gradient shrinks to
                    just the navbar band. */}
                <div
                  className="relative transition-[height] duration-300 ease-out"
                  style={{
                    height: betSlipVisible
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
                          stake={stake}
                          onStakeChange={setStake}
                          expanded={expanded}
                          onExpand={() =>
                            selections.length > 2
                              ? setListOpen(true)
                              : setExpanded(true)
                          }
                          onCollapse={() => setExpanded(false)}
                          onRemove={removeSelection}
                          onRemoveGroup={removeGroup}
                          onConfirm={confirmBet}
                          onKeepAlive={() => setKeepAliveNonce((n) => n + 1)}
                          showSummaryOddsChangeCheckbox={
                            !summaryOddsChangeHidden
                          }
                          summaryOddsChangeChecked={
                            summaryOddsChangeChecked
                          }
                          onToggleSummaryOddsChange={() =>
                            setSummaryOddsChangeChecked((checked) => !checked)
                          }
                          // The "Resumen" floating card (BetSlipFullSheet) is
                          // reserved for 3+ selections. At 1–2 selections the
                          // summarized slip is the only surface, so a swipe-up
                          // is a no-op (it stays expanded) instead of opening
                          // the floating card. Revert point: tag
                          // `pre-resumen-3plus-gate` (drop the guard to restore
                          // swipe-up → Resumen at any count).
                          onOpenList={() => {
                            if (selections.length > 2) setListOpen(true);
                          }}
                        />
                      )}
                    </AnimatePresence>
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
                  stake={stake}
                  onStakeChange={setStake}
                  onRemove={removeSelection}
                  onRemoveGroup={removeGroup}
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

            {/* Flying-ticket microinteraction — the green ticket that flies
                into Mis entradas, then finishEntryCreated() records the entry +
                pops the count badge (no reuse/share prompt). Plays AFTER the
                floating success card is closed (successNewEntry / successReuse
                set `success`), and for the lightning long-press. */}
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
                  stake={stake}
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
                  {selections.length} picks
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
