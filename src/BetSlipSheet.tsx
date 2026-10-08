import {
  animate,
  motion,
  useMotionValue,
  usePresence,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useVerticalSwipe } from './useVerticalSwipe';
import editIcon from './assets/edit.svg';
import { AmountKeypad, KEYPAD_H } from './AmountKeypad';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { ButtonPreviewMomios } from './ButtonPreviewMomios';
import { SelectionGroups } from './SelectionGroups';
import { SummaryOddsChangeCheckbox } from './SummaryOddsChangeCheckbox';
import { SummarizedBooster } from './SummarizedBooster';
import { SwipeToConfirm } from './SwipeToConfirm';
import { useStakeKeypad } from './useStakeKeypad';
import type { Selection } from './types';

/**
 * BetSlipSheet — the one-click bet slip, as a single morphing container.
 *
 * There is only ever ONE bet-slip element on screen. A single shell morphs
 * between two variants by animating its height (+ a squash/stretch pulse)
 * while the two content layers cross-fade — a Liquid-Glass-style morph, not a
 * hide/show of two components:
 *
 *   - COLLAPSED → the EXISTING collapsed bet slip, rendered by the real
 *                 `ButtonPreviewMomios` pill, untouched. This is the resting
 *                 collapsed state.
 *   - EXPANDED  → the purple-glass one-click card: selection(s) +
 *                 Monto/Momio/Ganancia + swipe-to-confirm. 1 selection =
 *                 straight bet; 2+ = parlay (header + horizontal selections).
 *
 * The glass background/border belong to the EXPANDED variant only (a layer
 * that fades in), so when collapsed the shell is transparent and only the
 * ButtonPreviewMomios pill shows — pixel-identical to before.
 *
 * Interaction: tap the pill → onExpand; swipe the card DOWN → onCollapse;
 * swipe the thumb RIGHT → onConfirm; tap × → onRemove; touch the thumb →
 * onKeepAlive (defers auto-collapse).
 */

const fmtOdds = (n: number) => `${n.toFixed(2)}x`;

// Morph geometry.
const COLLAPSED_H = 72; // ButtonPreviewMomios footprint (56px pill + 8/8 pad)
// The glass card's bottom-2 inset — the expanded card clears the navbar by the
// same 8px the collapsed pill does via its pb-2. Shell height = content + this.
const BOTTOM_INSET = 8;
// Fallback expanded shell height used until the content is measured. The real
// expanded height is now MEASURED from the content (it grows with the second
// stacked selection), see `expandedH` — so this is only the first-frame guess.
const EXPANDED_H = 203;

// The persistent glass SURFACE morphs between these two shapes. Both are
// bottom-anchored (bottom-2) and 16px inset (inset-x-4), so at collapsed the
// glass exactly overlaps the real ButtonPreviewMomios capsule (56px tall,
// rounded-[56px] ≈ radius 28) — the morph starts/ends on the pill's shape, so
// the hand-off is invisible and the surface never disappears.
const COLLAPSED_GLASS_H = 56;
const COLLAPSED_GLASS_RADIUS = 28; // capsule for a 56px-tall pill
const EXPANDED_GLASS_RADIUS = 20; // the card corners

// Drag thresholds.
const COLLAPSE_OFFSET_PX = 64;
const COLLAPSE_VELOCITY = 450;
// Swipe UP on the expanded slip opens the full-screen "Resumen" sheet.
const OPEN_LIST_OFFSET_PX = 48;
const OPEN_LIST_VELOCITY = 450;
// The shell itself does NOT translate with the finger — it stays anchored and
// the collapse is expressed as a continuous HEIGHT morph (see collapseP). The
// gesture is read from the raw pointer offset (useVerticalSwipe).
// Spring for programmatic / release transitions of the morph progress.
const COLLAPSE_SPRING = { type: 'spring', stiffness: 320, damping: 34 } as const;
// Gentler spring for the measured-height GROW/shrink when a selection is
// added/removed. Softer + slightly slower than COLLAPSE_SPRING (which drives
// the snappy pill↔card morph) so the card eases open to fit the new row rather
// than snapping — no overshoot (near-critical) so it never bounces past.
const ADD_GROW_SPRING = { type: 'spring', stiffness: 210, damping: 30 } as const;
// Subtle squash while morphing — peaks mid-transition, neutral at both rest
// states so neither the pill nor the card is ever left deformed.
const MORPH_DEFORM_X = 1.03;
const MORPH_DEFORM_Y = 0.98;
// Selection-add squash pulse — a liquid squash applied to the WHOLE slip
// (shellScaleX/shellScaleY, anchored bottom-center) each time a selection is
// added, so the eye reads "the same slip flexed to absorb a new pick", not a
// component swap. Tuned subtler than the original (was 1.04/0.95, damping 13):
// a lighter ~3% deform and a slightly better-damped spring so it gives ONE
// satisfying overshoot and settles — noticeable, but not bouncy, and it no
// longer piles up when two picks are added back-to-back.
const ADD_PULSE_SCALE_X = 1.03;
const ADD_PULSE_SCALE_Y = 0.97;
const ADD_PULSE_SPRING = { stiffness: 300, damping: 15 } as const;
// Squash & stretch pulses. On APPEAR the slip stretches (taller/narrower) then
// settles; on COLLAPSE it squashes (shorter/wider) then settles. Both spring
// back with a touch of overshoot for a liquid feel. Kept small — subtle.
const ENTRY_PULSE_SCALE_X = 0.92;
const ENTRY_PULSE_SCALE_Y = 1.11;
// Springier settle for the appear pulse → a touch of overshoot makes the
// squash & stretch clearly visible without feeling heavy.
const ENTRY_PULSE_SPRING = { stiffness: 320, damping: 12 } as const;
const COLLAPSE_PULSE_SCALE_X = 1.03;
const COLLAPSE_PULSE_SCALE_Y = 0.95;
const PULSE_SPRING = { stiffness: 300, damping: 16 } as const;

const GLASS_BG = 'linear-gradient(64.6deg, #14083d 0%, #230c3e 100%)';

type Props = {
  selections: Selection[];
  cumulativeOdds: number;
  /** Entry amount (shared stake from App). */
  stake: number;
  /** Commit a new amount from the keypad. */
  onStakeChange: (next: number) => void;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onRemove: (id: string) => void;
  /** Remove every selection from one match (× on an SGP group header). */
  onRemoveGroup: (matchId: string) => void;
  onConfirm: () => void;
  /** Called on swipe-to-confirm interaction so the 4s auto-collapse resets. */
  onKeepAlive: () => void;
  showSummaryOddsChangeCheckbox: boolean;
  summaryOddsChangeChecked: boolean;
  onToggleSummaryOddsChange: () => void;
  /** Parlay "Lista" tab — opens the full-screen summary sheet. */
  onOpenList: () => void;
};

export function BetSlipSheet({
  selections,
  cumulativeOdds,
  stake,
  onStakeChange,
  expanded,
  onExpand,
  onCollapse,
  onRemove,
  onRemoveGroup,
  onConfirm,
  onKeepAlive,
  showSummaryOddsChangeCheckbox,
  summaryOddsChangeChecked,
  onToggleSummaryOddsChange,
  onOpenList,
}: Props) {
  // Numeric keypad for editing the amount. Opening it clears the value and
  // grows the slip (the keypad renders inside the measured content, so the
  // existing ResizeObserver → `expandedH` spring absorbs it). Every keypad
  // interaction also bumps onKeepAlive so the 10s auto-collapse can't fire
  // mid-edit, and the collapse swipe is disabled while it's open.
  const keypad = useStakeKeypad(stake, onStakeChange);
  const openKeypad = () => {
    onKeepAlive();
    keypad.openKeypad();
  };
  const onKeypadDigit = (d: string) => {
    onKeepAlive();
    keypad.pressDigit(d);
  };
  const onKeypadDelete = () => {
    onKeepAlive();
    keypad.pressDelete();
  };
  // Winnings track the amount being edited (draft while the keypad is open,
  // otherwise the saved stake) so Monto / Ganancia / swipe all stay in sync.
  const potentialWin = Math.round(cumulativeOdds * keypad.displayValue);
  // If the slip collapses while the keypad is open (e.g. a 3rd selection was
  // added, which auto-collapses to the pill), commit + close the keypad so it
  // doesn't reappear on the next expand.
  useEffect(() => {
    if (!expanded && keypad.open) keypad.done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Keypad slot height (0 → keypad). Added DETERMINISTICALLY to the shell/glass
  // height (below) so the slip grows to fit the keypad WITHOUT depending on the
  // content ResizeObserver — the keypad is a separate layer, not measured by the
  // RO, so there's no double-count with `expandedH`. Springs open/closed so the
  // keypad slides into a growing slot.
  const KEYPAD_SLOT = KEYPAD_H + 10; // keypad + 10px top spacing (gap above)
  // A spring that FOLLOWS a target motion value: setting the target animates the
  // output toward it (the canonical useSpring pattern). Setting a bare
  // useSpring's own value does NOT animate, which made the slot lag behind
  // `keypad.open`. Feeds the shell/glass height math below deterministically.
  const keypadTarget = useMotionValue(0);
  const keypadOffsetH = useSpring(keypadTarget, ADD_GROW_SPRING);
  useEffect(() => {
    keypadTarget.set(keypad.open ? KEYPAD_SLOT : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keypad.open]);
  // Summarized slip shows AT MOST 2 selections (latest first). Once a 3rd is
  // added the slip auto-collapses (App.tsx), so the expanded card only ever
  // renders 1 or 2 rows. Rendered via the shared SelectionGroups so SGP grouping
  // (2 picks from the same match → one SGP block) reads identically to the
  // floating card + success views.
  const visibleSelections = [...selections].reverse().slice(0, 2); // latest first

  // Mount/unmount slide (mirrors BetSlipShell — declarative initial/animate
  // strands at `initial` under React 18 StrictMode, so animate by hand).
  const [isPresent, safeToRemove] = usePresence();
  const y = useMotionValue(260);
  const opacity = useMotionValue(0);
  useEffect(() => {
    if (isPresent) {
      const a1 = animate(y, 0, { type: 'spring', stiffness: 420, damping: 34 });
      const a2 = animate(opacity, 1, { duration: 0.2 });
      return () => {
        a1.stop();
        a2.stop();
      };
    }
    const a1 = animate(y, 260, { duration: 0.25, ease: [0.7, 0, 0.84, 0] });
    const a2 = animate(opacity, 0, { duration: 0.2 });
    let done = false;
    Promise.all([a1.then(() => undefined), a2.then(() => undefined)]).then(() => {
      if (done) return;
      done = true;
      safeToRemove?.();
    });
    return () => {
      done = true;
      a1.stop();
      a2.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  // MORPH PROGRESS — the single source of truth for the expanded↔collapsed
  // transition. 0 = full card, 1 = collapsed pill. Height, the layer
  // cross-fade and a subtle squash all derive from it, so the slip reads as
  // ONE component morphing rather than two layers being swapped. A downward
  // drag drives it directly (onCollapseDragMove); otherwise it springs to
  // match the `expanded` prop.
  const collapseP = useMotionValue(expanded ? 0 : 1);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return; // an active drag owns the progress
    const a = animate(collapseP, expanded ? 0 : 1, COLLAPSE_SPRING);
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Expanded shell height is MEASURED from the content, so the card grows when
  // the second stacked selection is added (and shrinks when it's removed). The
  // content is measured via a ResizeObserver below; `expandedH` holds the
  // resulting shell height (content + BOTTOM_INSET). First measurement snaps in;
  // later changes spring, so adding a 2nd selection grows the card smoothly.
  const expandedH = useMotionValue(EXPANDED_H);
  const contentRef = useRef<HTMLDivElement>(null);
  const measuredOnceRef = useRef(false);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // The keypad now lives INSIDE the measured content (between Monto and the
      // swipe). Its height is added to the shell separately via `keypadOffsetH`,
      // so skip measuring while it's open/animating — otherwise its height would
      // be double-counted in `expandedH`. Base height is captured when closed.
      if (keypadOffsetH.get() > 0.5) return;
      const target = el.offsetHeight + BOTTOM_INSET;
      if (target <= 0) return; // pre-layout
      if (!measuredOnceRef.current) {
        measuredOnceRef.current = true;
        expandedH.set(target);
      } else if (Math.abs(target - expandedH.get()) > 0.5) {
        animate(expandedH, target, ADD_GROW_SPRING);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bottom-anchored shell height morph — the card's top edge descends toward
  // the navbar as it collapses into the pill (defines layout + clip region).
  // Blends the MEASURED expanded height with the collapsed pill footprint by
  // `collapseP` (0 = expanded → expandedH, 1 = collapsed → COLLAPSED_H).
  const height = useTransform(
    [collapseP, expandedH, keypadOffsetH],
    ([p, eh, kh]: number[]) => {
      const expanded = eh + kh; // base content + keypad slot
      return expanded + (COLLAPSED_H - expanded) * p;
    },
  );

  // THE SINGLE MORPHING SURFACE — always opaque, so there's never an empty
  // frame. Its height and corner radius reshape continuously between the card
  // and the pill capsule; at collapsed it overlaps the real pill exactly.
  const glassHeight = useTransform(
    [collapseP, expandedH, keypadOffsetH],
    ([p, eh, kh]: number[]) => {
      const gExpanded = eh + kh - BOTTOM_INSET;
      return gExpanded + (COLLAPSED_GLASS_H - gExpanded) * p;
    },
  );
  // Keypad fades in over the first part of its reveal.
  const keypadOpacity = useTransform(
    keypadOffsetH,
    [0, KEYPAD_SLOT * 0.5],
    [0, 1],
    { clamp: true },
  );
  const glassRadius = useTransform(collapseP, [0, 1], [EXPANDED_GLASS_RADIUS, COLLAPSED_GLASS_RADIUS]);
  // Card CONTENT fades out over the first part of the collapse (it can't morph
  // into pill content), leaving the bare surface to finish reshaping.
  const cardContentOpacity = useTransform(collapseP, [0, 0.6], [1, 0], { clamp: true });
  // The real pill fades in only at the very end, where the surface has already
  // taken its capsule shape — so the hand-off onto the identical shape is
  // seamless and the collapsed pill still renders unchanged at rest.
  const pillOpacity = useTransform(collapseP, [0.8, 1], [0, 1], { clamp: true });

  // Subtle morph squash (peaks mid-transition, neutral at both ends), composed
  // with the selection-add pulse below onto the same shell scale.
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const morphDeformX = useTransform(collapseP, [0, 0.5, 1], [1, MORPH_DEFORM_X, 1]);
  const morphDeformY = useTransform(collapseP, [0, 0.5, 1], [1, MORPH_DEFORM_Y, 1]);
  const shellScaleX = useTransform(() => scaleX.get() * morphDeformX.get());
  const shellScaleY = useTransform(() => scaleY.get() * morphDeformY.get());

  // SELECTION-ADD PULSE — a subtle squash & stretch each time a new selection
  // lands (count grows). Perturb the scale, then spring back with overshoot so
  // it settles with a liquid wobble. Declared AFTER the morph effect so, in the
  // rare frame where both fire (adding while collapsed → expands + grows), this
  // pulse wins the shared scale values.
  const prevCountRef = useRef(selections.length);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = selections.length;
    if (selections.length <= prev) return; // only on add, not remove/mount
    scaleX.set(ADD_PULSE_SCALE_X);
    scaleY.set(ADD_PULSE_SCALE_Y);
    const ax = animate(scaleX, 1, { type: 'spring', ...ADD_PULSE_SPRING });
    const ay = animate(scaleY, 1, { type: 'spring', ...ADD_PULSE_SPRING });
    return () => {
      ax.stop();
      ay.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections.length]);

  // Perturb the shell scale then spring it back to rest — the shared squash &
  // stretch used on appear and on collapse.
  const pulseScale = (
    px: number,
    py: number,
    spring: { stiffness: number; damping: number } = PULSE_SPRING,
  ) => {
    scaleX.set(px);
    scaleY.set(py);
    const ax = animate(scaleX, 1, { type: 'spring', ...spring });
    const ay = animate(scaleY, 1, { type: 'spring', ...spring });
    return () => {
      ax.stop();
      ay.stop();
    };
  };

  // APPEAR — a visible stretch when the slip first mounts.
  useEffect(() => {
    return pulseScale(ENTRY_PULSE_SCALE_X, ENTRY_PULSE_SCALE_Y, ENTRY_PULSE_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // COLLAPSE — subtle squash whenever the slip goes expanded → collapsed
  // (swipe-down, auto-collapse, or after a placed bet).
  const prevExpandedRef = useRef(expanded);
  useEffect(() => {
    const was = prevExpandedRef.current;
    prevExpandedRef.current = expanded;
    if (was && !expanded) {
      return pulseScale(COLLAPSE_PULSE_SCALE_X, COLLAPSE_PULSE_SCALE_Y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Collapse swipe via raw pointer events (useVerticalSwipe) rather than
  // Framer's drag, which failed to grab the touch gesture on real mobile
  // browsers. It never fires from a pointerdown on the swipe thumb or the
  // ×/Lista buttons (excluded via `button`); swiping the card body collapses.
  const swipe = useVerticalSwipe({
    // Enabled whenever the slip is expanded — INCLUDING while the keypad is open,
    // so swipe-down still closes the slip (it collapses AND closes the keypad via
    // the guard effect). Keypad KEYS are `<button>`s, excluded below, so tapping
    // a digit never starts a collapse.
    enabled: () => expanded,
    exclude: 'button',
    onStart: () => {
      draggingRef.current = true;
      onKeepAlive();
    },
    // Downward drag drives the collapse morph directly (finger → progress).
    // Upward keeps it expanded (an up-swipe opens the full sheet on release).
    onMove: (dy) => {
      // Finger distance mapping to a full expand→collapse equals the height
      // delta so the card's TOP edge tracks the finger 1:1 as it shrinks. Uses
      // the MEASURED expanded height PLUS the open keypad slot so the mapping
      // stays 1:1 whether or not the keypad is showing.
      const range = Math.max(
        1,
        expandedH.get() + keypadOffsetH.get() - COLLAPSED_H,
      );
      collapseP.set(dy > 0 ? Math.min(1, dy / range) : 0);
    },
    onEnd: (dy, vy) => {
      draggingRef.current = false;
      // Swipe UP → open the full-screen "Resumen" sheet; settle the morph open.
      if (dy < -OPEN_LIST_OFFSET_PX || vy < -OPEN_LIST_VELOCITY) {
        animate(collapseP, 0, COLLAPSE_SPRING);
        onOpenList();
        return;
      }
      // Swipe DOWN past the threshold → commit. `expanded` flips false and the
      // resting-spring effect finishes the morph from where the finger left off.
      if (dy > COLLAPSE_OFFSET_PX || vy > COLLAPSE_VELOCITY) {
        onCollapse();
        return;
      }
      // Not far enough → cancel: spring the morph back open.
      animate(collapseP, 0, COLLAPSE_SPRING);
    },
  });

  return (
    <motion.div
      className="w-full"
      style={{ y, opacity, fontFamily: "'Red Hat Display', sans-serif" }}
    >
      {/* SHELL — a single element that MORPHS: height, the layer cross-fade
          and a subtle squash are all driven by `collapseP`, so a downward drag
          continuously shrinks the card into the pill (top edge tracks the
          finger; bottom stays anchored). Transparent itself — the glass
          background belongs to the expanded face. */}
      <motion.div
        className="relative w-full overflow-hidden"
        style={{
          height,
          scaleX: shellScaleX,
          scaleY: shellScaleY,
          transformOrigin: 'bottom center',
          // `none` when expanded so the browser doesn't scroll-steal the
          // swipe — the raw pointer handlers (useVerticalSwipe) drive the
          // collapse/open-list gesture. `auto` when collapsed so the tiny pill
          // never blocks page scroll.
          touchAction: expanded ? 'none' : 'auto',
        }}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
        {/* THE MORPHING SURFACE — one persistent, always-opaque glass element
            that reshapes (height + corner radius) between the card and the
            pill capsule. Bottom-anchored + inset-x-4 so at collapsed it
            overlaps the real pill exactly; never fades out, so there is no
            empty frame during the transition. */}
        <motion.div
          className="absolute inset-x-4 bottom-2 border border-[#4b20ff]"
          style={{
            backgroundImage: GLASS_BG,
            height: glassHeight,
            borderRadius: glassRadius,
          }}
          aria-hidden
        />

        {/* ---------- COLLAPSED: the real pill (fades in over the identical
             capsule the surface has already morphed into) ---------- */}
        <motion.div
          className="absolute inset-x-0 bottom-0 cursor-pointer"
          style={{
            opacity: pillOpacity,
            pointerEvents: expanded ? 'none' : 'auto',
          }}
          aria-hidden={expanded}
          onClick={expanded ? undefined : onExpand}
          role={expanded ? undefined : 'button'}
          tabIndex={expanded ? undefined : 0}
        >
          <ButtonPreviewMomios
            selectionCount={selections.length}
            cumulativeOdds={cumulativeOdds}
            stake={stake}
            speedScale={1}
            tier3OddsEffect={buttonProgressionConfig.tier3OddsEffect}
          />
        </motion.div>

        {/* ---------- EXPANDED: full slip content (over the surface) ----------
             BOTTOM-anchored (bottom-2, matching the glass surface) — NOT top-0.
             The shell is bottom-anchored and grows upward, so pinning the
             content to the bottom keeps the swipe/Monto controls fixed in place
             and lets the card grow UPWARD to reveal the newly-added row at the
             top. (Top-anchoring made the whole content block slide up as the
             card grew, which read as an abrupt "jump" when a selection landed.)
             At rest content top == shell top either way, so only the grow/shrink
             transition differs — and the glass grows in lockstep behind it. */}
        <motion.div
          ref={contentRef}
          className="absolute inset-x-4 bottom-2 flex flex-col"
          style={{
            opacity: cardContentOpacity,
            pointerEvents: expanded ? 'auto' : 'none',
          }}
          aria-hidden={!expanded}
        >
          {/* HANDLE — the slip keeps the single-selection structure at every
              count (the old 2+ "Bets · Promos · Lista" header is gone). The
              bottom padding is the ONLY gap to the selections below (8px). */}
          <div className="flex items-center justify-center px-3 pt-3 pb-2">
            <div className="h-1 w-8 rounded-full bg-[rgba(251,251,251,0.32)]" />
          </div>

          {/* SELECTIONS — shared SGP-grouped list (2 picks from the same match
              collapse into one SGP block; different matches stay standalone rows
              separated by a divider). `stopSwipePropagation` keeps taps on the ×
              from starting the collapse gesture. */}
          <div className="px-[10px] pb-3 pt-0">
            <SelectionGroups
              selections={visibleSelections}
              onRemove={onRemove}
              onRemoveGroup={onRemoveGroup}
              stopSwipePropagation
              dividers="none"
              showStandaloneDate={false}
            />
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-[rgba(251,251,251,0.1)]" />

          {/* Entry info — Monto / Momio / Ganancia */}
          <div className="flex w-full items-center gap-3 px-[10px] pt-[10px]">
            <button
              type="button"
              onClick={openKeypad}
              className="flex min-w-px flex-1 flex-col items-center justify-center rounded-lg active:scale-95"
            >
              <div className="flex items-center gap-1">
                <img src={editIcon} alt="" className="size-3" />
                <p className="text-[14px] font-black leading-[21px] text-[#fbfbfb]">
                  ${keypad.displayText}
                  {keypad.open && (
                    <span
                      aria-hidden
                      className="ml-px inline-block h-[0.95em] w-[2px] animate-[caretBlink_1s_step-end_infinite] bg-current align-middle"
                    />
                  )}
                </p>
              </div>
              <p className="text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
                Monto
              </p>
            </button>
            <div className="flex min-w-px flex-1 flex-col items-center justify-center">
              <p className="text-[14px] font-black leading-[21px] text-[#fbfbfb]">
                {fmtOdds(cumulativeOdds)}
              </p>
              <p className="text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
                Momio
              </p>
            </div>
            <div className="flex min-w-px flex-1 flex-col items-center justify-center">
              <p className="text-[14px] font-black leading-[21px] text-[#fbbf24]">
                ${potentialWin}
              </p>
              <p className="text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
                Ganancia
              </p>
            </div>
          </div>

          {/* NUMERIC KEYPAD — sits BETWEEN the Monto row and the swipe button.
              An in-flow slot whose height (`keypadOffsetH`) grows the slip: the
              content is bottom-anchored so the swipe stays pinned at the bottom
              while the keypad pushes Monto (and above) upward. Its height is
              added to the shell/glass height separately (and excluded from the
              RO base measurement), so no ResizeObserver dependency / double-count. */}
          <motion.div
            className="w-full overflow-hidden"
            style={{
              height: keypadOffsetH,
              opacity: keypadOpacity,
              pointerEvents: keypad.open ? 'auto' : 'none',
            }}
            aria-hidden={!keypad.open}
          >
            {/* 10px top pad = the gap ABOVE the keypad (revealed as the slot
                springs open; Monto row has no bottom padding so it's exactly
                10px). The gap BELOW comes from the swipe's pt-[10px]. */}
            <div className="pt-[10px]">
              <AmountKeypad
                onDigit={onKeypadDigit}
                onDelete={onKeypadDelete}
                onDone={keypad.done}
                onSwipeDown={onCollapse}
              />
            </div>
          </motion.div>

          {/* BOOSTER — experimental incentive row. Sits directly below the Monto
              stake (keypad closed) or directly below the keypad (keypad open),
              since the bottom-anchored keypad slot above grows between them. Its
              own pt-[10px] is the 10px gap above; the swipe's pt-[10px] is the
              gap below — so all sections keep the 10px rhythm. Self-contained:
              returns null when SUMMARIZED_BOOSTER_ENABLED is false (then the
              swipe's pt-[10px] becomes the keypad→swipe / Monto→swipe gap as
              before), so it never affects the rest of the slip when removed. */}
          <SummarizedBooster />

          {showSummaryOddsChangeCheckbox && (
            <SummaryOddsChangeCheckbox
              checked={summaryOddsChangeChecked}
              onToggle={onToggleSummaryOddsChange}
            />
          )}

          {/* Swipe to confirm — shared component (remounts on collapse via key
              so its swipe/loader state resets). Stays pinned at the card bottom;
              the keypad slot above pushes the rest up. `pt-[10px]` is the 10px
              gap BELOW the keypad (and the Monto→swipe gap when it's closed). */}
          <div className="flex w-full flex-col px-[10px] pb-[10px] pt-[10px]">
            <SwipeToConfirm
              key={expanded ? 'expanded' : 'collapsed'}
              stake={keypad.displayValue}
              onConfirm={onConfirm}
              onSwipeStart={onKeepAlive}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
